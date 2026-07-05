const express = require('express');
const path = require('path');
const fs = require('fs');
const mysql = require('mysql2');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { loadServerEnv } = require('./load-env');
const envLoad = loadServerEnv(__dirname);
const envPath = envLoad.path;
const { hashPassword, verifyPassword, signToken, authenticate, requireSuperAdmin, requireAdminRole, requireDoctorManager, requireBloodManager, requireHospitalIdAccess } = require('./auth');
const { sendOtpEmail, isEmailConfigured } = require('./email-service');
const crypto = require('crypto');

const app = express();
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

if (IS_PRODUCTION) {
    app.set('trust proxy', 1);
}

// Security headers
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
}));

const PUBLIC_SITE_HOSTS = new Set(['livehospital.org', 'www.livehospital.org']);
const ADMIN_PANEL_HOSTS = new Set(['panel.livehospital.org']);
const ADMIN_PANEL_BASE_URL = String(process.env.ADMIN_PANEL_BASE_URL || 'https://panel.livehospital.org').replace(/\/$/, '');

// Middleware
app.use(cors(IS_PRODUCTION ? {
    origin: [
        'https://livehospital.org',
        'https://www.livehospital.org',
        'https://panel.livehospital.org',
    ],
    credentials: true
} : {}));

// Production: admin HTML only on panel subdomain (public site redirects admin URLs)
if (IS_PRODUCTION) {
    app.use((req, res, next) => {
        const host = String(req.hostname || '').toLowerCase();
        if (!PUBLIC_SITE_HOSTS.has(host)) return next();
        const p = req.path || '/';
        if (/^\/(admin|hospital-admin|blood-admin)(\.html)?\/?$/i.test(p)) {
            const normalized = (p.replace(/\/$/, '') || '/admin').replace(/\.html$/i, '');
            return res.redirect(301, `${ADMIN_PANEL_BASE_URL}${normalized}`);
        }
        return next();
    });
}
app.use(express.json());

const authLoginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 15,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many login attempts. Please try again in 15 minutes.' }
});

const forgotPasswordLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many OTP requests. Please try again in 15 minutes.' }
});

const contactSubmitLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'बहुत ज़्यादा संदेश भेजे गए। 15 मिनट बाद कोशिश करें।' }
});

const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 150,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests. Please slow down.' }
});

app.use('/api/', apiLimiter);

// ============ SITE SETTINGS (early: maintenance gate, static cache, API merge) ============
const SITE_SETTINGS_PATH = path.join(__dirname, 'data', 'site-settings.json');
let siteSettingsCache = null;

function defaultSiteSettings() {
    return {
        publicBaseUrl: '',
        adminPanelBaseUrl: 'https://panel.livehospital.org',
        basic: {
            siteTitle: '',
            tagline: '',
            maintenanceMode: false,
            maintenanceMessage: 'हम साइट अपडेट कर रहे हैं। कृपया बाद में फिर कोशिश करें। / We are updating. Please check back soon.'
        },
        contact: {
            phone: '',
            whatsapp: '',
            supportEmail: 'support@livehospital.org',
            privacyEmail: 'privacy@livehospital.org',
            ownerEmail: '',
            hours: 'सोमवार - शनिवार (9AM - 6PM)'
        },
        social: {
            facebook: '',
            instagram: '',
            youtube: '',
            twitter: '',
            whatsapp: ''
        },
        integrations: {
            googleAnalyticsMeasurementId: '',
            googleTagManagerId: '',
            notes: ''
        },
        seo: { pages: {} },
        robots: { allowAll: true, disallowPaths: ['/admin', '/hospital-admin', '/blood-admin', '/api/'] },
        sitemap: { extraPaths: [] },
        images: { logoAlt: '', guidelines: '' },
        backup: { notes: '', lastRun: '' },
        caching: { enabled: true, staticMaxAge: 86400, notes: '' }
    };
}

function loadSiteSettings() {
    try {
        const raw = fs.readFileSync(SITE_SETTINGS_PATH, 'utf8');
        siteSettingsCache = JSON.parse(raw);
    } catch (e) {
        siteSettingsCache = defaultSiteSettings();
    }
    return siteSettingsCache;
}

function saveSiteSettings(data) {
    fs.mkdirSync(path.dirname(SITE_SETTINGS_PATH), { recursive: true });
    fs.writeFileSync(SITE_SETTINGS_PATH, JSON.stringify(data, null, 2), 'utf8');
    siteSettingsCache = data;
}

function mergeDeep(target, src) {
    if (src == null || typeof src !== 'object' || Array.isArray(src)) return target;
    const out = JSON.parse(JSON.stringify(target));
    Object.keys(src).forEach((k) => {
        if (src[k] !== null && typeof src[k] === 'object' && !Array.isArray(src[k])
            && out[k] !== null && typeof out[k] === 'object' && !Array.isArray(out[k])) {
            out[k] = mergeDeep(out[k], src[k]);
        } else {
            out[k] = src[k];
        }
    });
    return out;
}

loadSiteSettings();

function isMaintenanceExempt(reqPath, method) {
    if (method !== 'GET' && method !== 'HEAD') return true;
    if (reqPath.startsWith('/admin') || reqPath.startsWith('/hospital-admin') || reqPath.startsWith('/blood-admin')) return true;
    if (/^\/(admin|hospital-admin|blood-admin)\.html$/i.test(reqPath)) return true;
    if (reqPath.startsWith('/api')) return true;
    if (/\.(css|js|mjs|png|jpg|jpeg|gif|webp|svg|ico|woff2?|ttf|eot|map)$/i.test(reqPath)) return true;
    return false;
}

function escapeMaintenanceHtml(s) {
    return String(s || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function maintenancePageHtml(settings) {
    const b = settings.basic || {};
    const title = escapeMaintenanceHtml(trimStr(b.siteTitle) || 'Website');
    const msg = escapeMaintenanceHtml(trimStr(b.maintenanceMessage) || 'We are updating the site. Please try again soon.');
    return `<!DOCTYPE html><html lang="hi"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} — Maintenance</title><style>body{font-family:system-ui,sans-serif;background:#0d1117;color:#e5e7eb;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;padding:24px;text-align:center;}main{max-width:520px;line-height:1.5}h1{font-size:1.4rem;margin-bottom:12px}a{color:#60a5fa}</style></head><body><main><h1>${title}</h1><p>${msg}</p><p style="margin-top:24px;font-size:.88rem;opacity:.75"><a href="/admin">Admin login</a></p></main></body></html>`;
}

app.use((req, res, next) => {
    const s = siteSettingsCache || loadSiteSettings();
    if (!(s.basic && s.basic.maintenanceMode)) return next();
    const p = req.path || '/';
    if (isMaintenanceExempt(p, req.method)) return next();
    if (p === '/' && !req.accepts('html')) return next();
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    res.status(503)
        .setHeader('Retry-After', '3600')
        .type('html')
        .send(maintenancePageHtml(s));
});

// MySQL Connection Pool (Better performance)
if (!process.env.DB_USER || !process.env.DB_NAME) {
    console.error('Missing DB env vars after loading:', envPath);
    console.error('File exists:', envLoad.exists, '| Keys loaded:', Object.keys(envLoad.env || {}).join(', ') || '(none)');
    console.error('DB_USER=', process.env.DB_USER || '(empty)');
    console.error('Run: node check-env.js');
}

const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Test Database Connection
db.getConnection((err, connection) => {
    if (err) {
        console.error('MySQL connection error:', err);
        return;
    }
    console.log('MySQL Connected Successfully!');
    connection.release();
    ensurePasswordResetTable();
    ensureContactMessagesTable();
});

function ensurePasswordResetTable() {
    const sql = `CREATE TABLE IF NOT EXISTS password_reset_otps (
        id INT AUTO_INCREMENT PRIMARY KEY,
        admin_id INT NOT NULL,
        email VARCHAR(100) NOT NULL,
        otp_hash VARCHAR(255) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        used TINYINT(1) NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE,
        INDEX idx_email_expires (email, expires_at)
    )`;
    db.query(sql, (err) => {
        if (err) console.error('password_reset_otps table:', err.message);
    });
}

function ensureContactMessagesTable() {
    const sql = `CREATE TABLE IF NOT EXISTS contact_messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        mobile VARCHAR(20) NOT NULL,
        email VARCHAR(255) NOT NULL,
        subject VARCHAR(50) NOT NULL,
        subject_text VARCHAR(255) DEFAULT NULL,
        message TEXT NOT NULL,
        status ENUM('pending', 'replied') NOT NULL DEFAULT 'pending',
        reply TEXT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        replied_at TIMESTAMP NULL DEFAULT NULL,
        INDEX idx_status_created (status, created_at)
    )`;
    db.query(sql, (err) => {
        if (err) console.error('contact_messages table:', err.message);
    });
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function generateOtp() {
    return String(crypto.randomInt(100000, 1000000));
}

function dbQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.query(sql, params, (err, results) => {
            if (err) reject(err);
            else resolve(results);
        });
    });
}

function requireDoctorAccess(req, res, next) {
    if (req.admin.role === 'superadmin') {
        next();
        return;
    }
    if (req.admin.role !== 'hospital_admin' && req.admin.role !== 'admin') {
        res.status(403).json({ error: 'Hospital admin access required' });
        return;
    }
    const doctorId = parseInt(req.params.id, 10);
    if (!isValidId(doctorId)) {
        res.status(400).json({ error: 'Invalid doctor id' });
        return;
    }
    db.query('SELECT hospital_id FROM doctors WHERE id = ?', [doctorId], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (!rows.length) {
            res.status(404).json({ error: 'Doctor not found' });
            return;
        }
        if (req.admin.hospital_id !== rows[0].hospital_id) {
            res.status(403).json({ error: 'Access denied for this doctor' });
            return;
        }
        next();
    });
}

function requireBloodRequestAccess(req, res, next) {
    if (req.admin.role === 'superadmin') {
        next();
        return;
    }
    if (req.admin.role !== 'blood_admin') {
        res.status(403).json({ error: 'Blood admin access required' });
        return;
    }
    const requestId = parseInt(req.params.id, 10);
    if (!isValidId(requestId)) {
        res.status(400).json({ error: 'Invalid blood request id' });
        return;
    }
    db.query('SELECT hospital_id FROM blood_requests WHERE id = ?', [requestId], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (!rows.length) {
            res.status(404).json({ error: 'Blood request not found' });
            return;
        }
        if (req.admin.hospital_id !== rows[0].hospital_id) {
            res.status(403).json({ error: 'Access denied for this blood request' });
            return;
        }
        next();
    });
}

function requireBodyHospitalAccess(req, res, next) {
    if (req.admin.role === 'superadmin') {
        next();
        return;
    }
    const hospitalId = parseInt(req.body.hospital_id, 10);
    if (!isValidId(hospitalId) || req.admin.hospital_id !== hospitalId) {
        res.status(403).json({ error: 'Access denied for this hospital' });
        return;
    }
    next();
}

function requireParamHospitalAccess(req, res, next) {
    return requireHospitalIdAccess(parseInt(req.params.id, 10))(req, res, next);
}

// ============ VALIDATION HELPERS ============
function trimStr(s) { return (s != null && typeof s === 'string') ? s.trim() : ''; }
function isValidId(id) { const n = parseInt(id, 10); return !isNaN(n) && n > 0; }
function isValidLat(lat) { if (lat == null || lat === '') return true; const n = parseFloat(lat); return !isNaN(n) && n >= -90 && n <= 90; }
function isValidLng(lng) { if (lng == null || lng === '') return true; const n = parseFloat(lng); return !isNaN(n) && n >= -180 && n <= 180; }
const HOSPITAL_TYPES = ['GOV', 'PRIVATE'];
const DOCTOR_STATUSES = ['available', 'busy', 'leave'];
const BLOOD_TYPES = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];
const HOSPITAL_ADMIN_ROLES = ['hospital_admin', 'admin'];
const ADMIN_STATUSES = ['active', 'inactive'];

async function resolveHospitalIdFromName(hospitalName) {
    const name = trimStr(hospitalName);
    if (!name) return null;
    const exact = await dbQuery('SELECT id FROM hospitals WHERE name = ? LIMIT 1', [name]);
    if (exact.length) return exact[0].id;
    const partial = await dbQuery('SELECT id FROM hospitals WHERE name LIKE ? LIMIT 1', [`%${name}%`]);
    return partial.length ? partial[0].id : null;
}

function formatScopedAdminRow(row) {
    return {
        id: row.id,
        email: row.username,
        name: row.name || '',
        mobile: row.mobile || '',
        status: row.status || 'active',
        hospital_id: row.hospital_id,
        hospital_name: row.hospital_name || '',
        created_at: row.created_at
    };
}

// ============ ROOT ROUTE ============
// Browser (HTML) → website; API clients (JSON) → API info
app.get('/', (req, res) => {
    const host = String(req.hostname || '').toLowerCase();
    if (ADMIN_PANEL_HOSTS.has(host) && req.accepts('html')) {
        res.sendFile(path.join(__dirname, '..', 'admin.html'));
        return;
    }
    if (req.accepts('html')) {
        res.sendFile(path.join(__dirname, '..', 'index.html'));
        return;
    }
    res.json({
        message: 'Hospital Doctor Availability API',
        status: 'Server is running!',
        version: '2.0',
        endpoints: {
            hospitals: '/api/hospitals',
            doctors: '/api/doctors',
            blood: '/api/blood-requests',
            search: '/api/search?q=term',
            stats: '/api/stats',
            admin: '/api/admin/login',
            siteSettings: '/api/site-settings',
            fullBackupExport: '/api/full-backup/export',
            fullBackupImport: 'POST /api/full-backup/import',
            sitemap: '/sitemap.xml',
            robots: '/robots.txt'
        }
    });
});

// Serve admin & other HTML pages by path (direct — no redirect)
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, '..', 'admin.html')));
app.get('/hospital-admin', (req, res) => res.sendFile(path.join(__dirname, '..', 'hospital-admin.html')));
app.get('/blood-admin', (req, res) => res.sendFile(path.join(__dirname, '..', 'blood-admin.html')));
app.get('/admin.html', (req, res) => res.sendFile(path.join(__dirname, '..', 'admin.html')));
app.get('/hospital-admin.html', (req, res) => res.sendFile(path.join(__dirname, '..', 'hospital-admin.html')));
app.get('/blood-admin.html', (req, res) => res.sendFile(path.join(__dirname, '..', 'blood-admin.html')));
app.get('/index.html', (req, res) => res.sendFile(path.join(__dirname, '..', 'index.html')));

// Permalink-style URLs (user-friendly paths)
app.get('/privacy', (req, res) => res.sendFile(path.join(__dirname, '..', 'privacy.html')));
app.get('/terms', (req, res) => res.sendFile(path.join(__dirname, '..', 'terms.html')));
app.get('/cookies', (req, res) => res.sendFile(path.join(__dirname, '..', 'cookies.html')));
app.get('/contact', (req, res) => res.sendFile(path.join(__dirname, '..', 'contact.html')));
app.get('/privacy.html', (req, res) => res.sendFile(path.join(__dirname, '..', 'privacy.html')));
app.get('/terms.html', (req, res) => res.sendFile(path.join(__dirname, '..', 'terms.html')));
app.get('/cookies.html', (req, res) => res.sendFile(path.join(__dirname, '..', 'cookies.html')));
app.get('/contact.html', (req, res) => res.sendFile(path.join(__dirname, '..', 'contact.html')));

app.get('/sitemap.xml', (req, res) => {
    const s = siteSettingsCache || loadSiteSettings();
    const base = (trimStr(s.publicBaseUrl) || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
    const paths = ['/', '/privacy', '/terms', '/cookies', '/contact'];
    if (Array.isArray(s.sitemap && s.sitemap.extraPaths)) {
        s.sitemap.extraPaths.forEach((p) => {
            if (!p || typeof p !== 'string') return;
            const norm = p.startsWith('/') ? p : `/${p}`;
            if (!paths.includes(norm)) paths.push(norm);
        });
    }
    const lines = paths.map((p) => {
        const loc = p === '/' ? `${base}/` : `${base}${p}`;
        const pri = p === '/' ? '1.0' : '0.8';
        return `  <url><loc>${loc}</loc><changefreq>weekly</changefreq><priority>${pri}</priority></url>`;
    });
    res.type('application/xml');
    res.send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${lines.join('\n')}\n</urlset>`);
});

app.get('/robots.txt', (req, res) => {
    const s = siteSettingsCache || loadSiteSettings();
    const base = (trimStr(s.publicBaseUrl) || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
    const lines = ['User-agent: *'];
    if (s.robots && s.robots.allowAll === false) {
        lines.push('Disallow: /');
    } else {
        lines.push('Allow: /');
        (s.robots && s.robots.disallowPaths ? s.robots.disallowPaths : []).forEach((d) => {
            if (!d) return;
            lines.push(`Disallow: ${d.startsWith('/') ? d : `/${d}`}`);
        });
    }
    lines.push(`Sitemap: ${base}/sitemap.xml`);
    res.type('text/plain');
    res.send(lines.join('\n'));
});

// Static files + cache headers (HTML always fresh; assets cacheable when enabled)
const staticRoot = path.join(__dirname, '..');
app.use(express.static(staticRoot, {
    setHeaders: (res, filepath) => {
        const s = siteSettingsCache || loadSiteSettings();
        const ext = path.extname(filepath).toLowerCase();
        if (ext === '.html') {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            return;
        }
        const cacheable = ['.css', '.js', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ico', '.woff', '.woff2'].includes(ext);
        if (s.caching && s.caching.enabled && cacheable) {
            const sec = parseInt(s.caching.staticMaxAge, 10);
            res.setHeader('Cache-Control', `public, max-age=${!isNaN(sec) && sec >= 0 ? sec : 86400}`);
        } else {
            res.setHeader('Cache-Control', 'no-cache');
        }
    }
}));

// API root (browser GET /api was 404 — explicit handler)
app.get('/api', (req, res) => {
    res.json({
        message: 'Hospital Doctor Availability API',
        status: 'Server is running!',
        version: '2.0',
        endpoints: {
            hospitals: '/api/hospitals',
            doctors: '/api/doctors',
            blood: '/api/blood-requests',
            search: '/api/search?q=term',
            stats: '/api/stats',
            admin: '/api/admin/login',
            siteSettings: '/api/site-settings',
            fullBackupExport: '/api/full-backup/export',
            fullBackupImport: 'POST /api/full-backup/import',
            sitemap: '/sitemap.xml',
            robots: '/robots.txt'
        }
    });
});

// ============ HOSPITAL ROUTES ============

// Get all hospitals (with avg rating and rating count)
app.get('/api/hospitals', (req, res) => {
    const query = `SELECT h.*, 
        COALESCE(ROUND(AVG(r.rating), 1), 0) AS avg_rating, 
        COUNT(r.id) AS rating_count 
        FROM hospitals h 
        LEFT JOIN hospital_ratings r ON h.id = r.hospital_id 
        GROUP BY h.id`;
    db.query(query, (err, results) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(results);
    });
});

// Get single hospital
app.get('/api/hospitals/:id', (req, res) => {
    if (!isValidId(req.params.id)) {
        res.status(400).json({ error: 'Invalid hospital id' });
        return;
    }
    const query = 'SELECT * FROM hospitals WHERE id = ?';
    db.query(query, [req.params.id], (err, results) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(results[0]);
    });
});

// Add new hospital
app.post('/api/hospitals', authenticate, requireSuperAdmin, (req, res) => {
    const name = trimStr(req.body.name);
    const location = trimStr(req.body.location);
    const city = trimStr(req.body.city);
    const type = (req.body.type || '').toUpperCase();
    const total_doctors = parseInt(req.body.total_doctors, 10) || 0;
    const lat = req.body.lat;
    const lng = req.body.lng;
    const card_branding = trimStr(req.body.card_branding) || null;
    if (!name || name.length > 255) {
        res.status(400).json({ error: 'Hospital name is required (max 255 characters)' });
        return;
    }
    if (!location || location.length > 255) {
        res.status(400).json({ error: 'Location is required (max 255 characters)' });
        return;
    }
    if (!city || city.length > 100) {
        res.status(400).json({ error: 'City is required (max 100 characters)' });
        return;
    }
    if (!HOSPITAL_TYPES.includes(type)) {
        res.status(400).json({ error: 'Type must be GOV or PRIVATE' });
        return;
    }
    if (!isValidLat(lat) || !isValidLng(lng)) {
        res.status(400).json({ error: 'Invalid latitude or longitude' });
        return;
    }
    const cols = 'name, location, city, type, total_doctors, lat, lng, card_branding';
    const query = `INSERT INTO hospitals (${cols}) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
    db.query(query, [name, location, city, type, total_doctors, lat || null, lng || null, card_branding], (err, result) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ id: result.insertId, message: 'Hospital added successfully' });
    });
});

// Update hospital
app.put('/api/hospitals/:id', authenticate, requireSuperAdmin, (req, res) => {
    if (!isValidId(req.params.id)) {
        res.status(400).json({ error: 'Invalid hospital id' });
        return;
    }
    const name = trimStr(req.body.name);
    const location = trimStr(req.body.location);
    const city = trimStr(req.body.city);
    const type = (req.body.type || '').toUpperCase();
    const total_doctors = parseInt(req.body.total_doctors, 10) || 0;
    const lat = req.body.lat;
    const lng = req.body.lng;
    const card_branding = trimStr(req.body.card_branding) || null;
    if (!name || name.length > 255) {
        res.status(400).json({ error: 'Hospital name is required (max 255 characters)' });
        return;
    }
    if (!location || location.length > 255) {
        res.status(400).json({ error: 'Location is required (max 255 characters)' });
        return;
    }
    if (!city || city.length > 100) {
        res.status(400).json({ error: 'City is required (max 100 characters)' });
        return;
    }
    if (!HOSPITAL_TYPES.includes(type)) {
        res.status(400).json({ error: 'Type must be GOV or PRIVATE' });
        return;
    }
    if (!isValidLat(lat) || !isValidLng(lng)) {
        res.status(400).json({ error: 'Invalid latitude or longitude' });
        return;
    }
    const query = 'UPDATE hospitals SET name=?, location=?, city=?, type=?, total_doctors=?, lat=?, lng=?, card_branding=? WHERE id=?';
    db.query(query, [name, location, city, type, total_doctors, lat || null, lng || null, card_branding || null, req.params.id], (err, result) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ message: 'Hospital updated successfully' });
    });
});

// Update hospital card branding only
app.patch('/api/hospitals/:id/branding', authenticate, requireDoctorManager, requireParamHospitalAccess, (req, res) => {
    if (!isValidId(req.params.id)) {
        res.status(400).json({ error: 'Invalid hospital id' });
        return;
    }
    const card_branding = trimStr(req.body.card_branding) || null;
    const query = 'UPDATE hospitals SET card_branding=? WHERE id=?';
    db.query(query, [card_branding, req.params.id], (err, result) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ message: 'Card branding updated successfully' });
    });
});

// Delete hospital
app.delete('/api/hospitals/:id', authenticate, requireSuperAdmin, (req, res) => {
    if (!isValidId(req.params.id)) {
        res.status(400).json({ error: 'Invalid hospital id' });
        return;
    }
    const query = 'DELETE FROM hospitals WHERE id = ?';
    db.query(query, [req.params.id], (err, result) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ message: 'Hospital deleted successfully' });
    });
});

// Submit hospital rating (1-5 stars)
app.post('/api/hospitals/:id/rating', (req, res) => {
    if (!isValidId(req.params.id)) {
        res.status(400).json({ error: 'Invalid hospital id' });
        return;
    }
    const rating = parseInt(req.body.rating, 10);
    if (isNaN(rating) || rating < 1 || rating > 5) {
        res.status(400).json({ error: 'Rating must be between 1 and 5' });
        return;
    }
    const query = 'INSERT INTO hospital_ratings (hospital_id, rating) VALUES (?, ?)';
    db.query(query, [req.params.id, rating], (err, result) => {
        if (err) {
            const msg = err.message || '';
            const isNoTable = /doesn't exist|Unknown table/i.test(msg);
            res.status(500).json({
                error: isNoTable ? 'Rating table not set up. Run: node create-ratings-table.js' : msg
            });
            return;
        }
        // Return new average (Number so JSON serialize works, no BigInt)
        db.query('SELECT COALESCE(ROUND(AVG(rating), 1), 0) AS avg_rating, COUNT(*) AS rating_count FROM hospital_ratings WHERE hospital_id = ?', [req.params.id], (err2, rows) => {
            if (err2) return res.json({ message: 'Rating submitted', avg_rating: rating, rating_count: 1 });
            const avg = parseFloat(rows[0].avg_rating) || 0;
            const count = Number(rows[0].rating_count) || 1;
            res.json({ message: 'Rating submitted', avg_rating: avg, rating_count: count });
        });
    });
});

// ============ DOCTOR ROUTES ============

// Get all doctors
app.get('/api/doctors', (req, res) => {
    const query = `
        SELECT d.*, h.name as hospital_name 
        FROM doctors d 
        LEFT JOIN hospitals h ON d.hospital_id = h.id
    `;
    db.query(query, (err, results) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(results);
    });
});

// Get doctors by hospital
app.get('/api/hospitals/:id/doctors', (req, res) => {
    if (!isValidId(req.params.id)) {
        res.status(400).json({ error: 'Invalid hospital id' });
        return;
    }
    const query = 'SELECT * FROM doctors WHERE hospital_id = ?';
    db.query(query, [req.params.id], (err, results) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(results);
    });
});

// Get doctors by status
app.get('/api/doctors/status/:status', (req, res) => {
    const query = 'SELECT * FROM doctors WHERE status = ?';
    db.query(query, [req.params.status], (err, results) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(results);
    });
});

// Get single doctor
app.get('/api/doctors/:id', (req, res) => {
    if (!isValidId(req.params.id)) {
        res.status(400).json({ error: 'Invalid doctor id' });
        return;
    }
    const query = `
        SELECT d.*, h.name as hospital_name 
        FROM doctors d 
        LEFT JOIN hospitals h ON d.hospital_id = h.id 
        WHERE d.id = ?
    `;
    db.query(query, [req.params.id], (err, results) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(results[0]);
    });
});

// Add new doctor
app.post('/api/doctors', authenticate, requireDoctorManager, requireBodyHospitalAccess, (req, res) => {
    const name = trimStr(req.body.name);
    const specialty = trimStr(req.body.specialty);
    const status = (req.body.status || '').toLowerCase();
    const experience = trimStr(req.body.experience);
    const timing = trimStr(req.body.timing);
    const fees = trimStr(req.body.fees);
    const hospital_id = parseInt(req.body.hospital_id, 10);
    const room_no = trimStr(req.body.room_no);
    const floor = trimStr(req.body.floor);
    const block = trimStr(req.body.block);
    const qualification = trimStr(req.body.qualification);
    const sub_specialization = trimStr(req.body.sub_specialization);
    if (!name || name.length > 255) {
        res.status(400).json({ error: 'Doctor name is required (max 255 characters)' });
        return;
    }
    if (!specialty || specialty.length > 255) {
        res.status(400).json({ error: 'Specialty is required (max 255 characters)' });
        return;
    }
    if (!DOCTOR_STATUSES.includes(status)) {
        res.status(400).json({ error: 'Status must be available, busy, or leave' });
        return;
    }
    if (!isValidId(hospital_id)) {
        res.status(400).json({ error: 'Valid hospital_id is required' });
        return;
    }
    const query = 'INSERT INTO doctors (name, specialty, status, experience, timing, fees, room_no, floor, block, qualification, sub_specialization, hospital_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
    db.query(query, [name, specialty, status, experience || null, timing || null, fees || null, room_no || null, floor || null, block || null, qualification || null, sub_specialization || null, hospital_id], (err, result) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ id: result.insertId, message: 'Doctor added successfully' });
    });
});

// Update doctor
app.put('/api/doctors/:id', authenticate, requireDoctorManager, requireDoctorAccess, (req, res) => {
    if (!isValidId(req.params.id)) {
        res.status(400).json({ error: 'Invalid doctor id' });
        return;
    }
    const name = trimStr(req.body.name);
    const specialty = trimStr(req.body.specialty);
    const status = (req.body.status || '').toLowerCase();
    const experience = trimStr(req.body.experience);
    const timing = trimStr(req.body.timing);
    const fees = trimStr(req.body.fees);
    const hospital_id = parseInt(req.body.hospital_id, 10);
    const room_no = trimStr(req.body.room_no);
    const floor = trimStr(req.body.floor);
    const block = trimStr(req.body.block);
    const qualification = trimStr(req.body.qualification);
    const sub_specialization = trimStr(req.body.sub_specialization);
    if (!name || name.length > 255) {
        res.status(400).json({ error: 'Doctor name is required (max 255 characters)' });
        return;
    }
    if (!specialty || specialty.length > 255) {
        res.status(400).json({ error: 'Specialty is required (max 255 characters)' });
        return;
    }
    if (!DOCTOR_STATUSES.includes(status)) {
        res.status(400).json({ error: 'Status must be available, busy, or leave' });
        return;
    }
    if (!isValidId(hospital_id)) {
        res.status(400).json({ error: 'Valid hospital_id is required' });
        return;
    }
    const query = 'UPDATE doctors SET name=?, specialty=?, status=?, experience=?, timing=?, fees=?, room_no=?, floor=?, block=?, qualification=?, sub_specialization=?, hospital_id=? WHERE id=?';
    db.query(query, [name, specialty, status, experience || null, timing || null, fees || null, room_no || null, floor || null, block || null, qualification || null, sub_specialization || null, hospital_id, req.params.id], (err, result) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ message: 'Doctor updated successfully' });
    });
});

// Submit user feedback (thumbs up/down) – auto-update status only if hospital hasn't updated in 2 days
const FEEDBACK_DOWN_THRESHOLD = 2;
const FEEDBACK_WINDOW_HOURS = 2;
const HOSPITAL_UPDATE_GRACE_DAYS = 2; // feedback se status tabhi update, jab 2 din se hospital ne update nahi kiya

app.post('/api/doctors/:id/feedback', (req, res) => {
    if (!isValidId(req.params.id)) {
        res.status(400).json({ error: 'Invalid doctor id' });
        return;
    }
    const feedback = (req.body.feedback || '').toLowerCase();
    if (feedback !== 'up' && feedback !== 'down') {
        res.status(400).json({ error: 'feedback must be "up" or "down"' });
        return;
    }
    const doctorId = parseInt(req.params.id, 10);

    db.query('INSERT INTO doctor_feedback (doctor_id, feedback_type) VALUES (?, ?)', [doctorId, feedback], (errInsert) => {
        if (errInsert) {
            res.status(500).json({ error: errInsert.message });
            return;
        }

        let statusUpdated = false;
        let newStatus = null;

        if (feedback === 'down') {
            db.query(
                `SELECT status, updated_at FROM doctors WHERE id = ?`,
                [doctorId],
                (errDoc, docRows) => {
                    if (errDoc || !docRows || docRows.length === 0) {
                        return res.json({ message: 'Feedback recorded' });
                    }
                    if (docRows[0].status !== 'available') {
                        return res.json({ message: 'Feedback recorded' });
                    }
                    // Jab tak hospital 2 din ke andar update kare, tab tak feedback se status mat badlo
                    db.query(
                        `SELECT 1 FROM doctors WHERE id = ? AND (updated_at >= NOW() - INTERVAL ? DAY)`,
                        [doctorId, HOSPITAL_UPDATE_GRACE_DAYS],
                        (errRecent, recentRows) => {
                            if (!errRecent && recentRows && recentRows.length > 0) {
                                return res.json({ message: 'Feedback recorded. Hospital ne recently update kiya – status nahi badla.' });
                            }

                            db.query(
                                `SELECT COUNT(*) as c FROM doctor_feedback 
                                 WHERE doctor_id = ? AND feedback_type = 'down' 
                                 AND created_at >= NOW() - INTERVAL ? HOUR`,
                                [doctorId, FEEDBACK_WINDOW_HOURS],
                                (errCount, countRows) => {
                                    if (errCount || !countRows || Number(countRows[0].c) < FEEDBACK_DOWN_THRESHOLD) {
                                        return res.json({ message: 'Feedback recorded' });
                                    }

                                    db.query('UPDATE doctors SET status = ? WHERE id = ?', ['busy', doctorId], (errUpdate) => {
                                        if (!errUpdate) {
                                            statusUpdated = true;
                                            newStatus = 'busy';
                                        }
                                        res.json({
                                            message: 'Feedback recorded. 2 din se update nahi tha – मरीजों के आधार पर status update.',
                                            updated: statusUpdated,
                                            newStatus: newStatus || undefined
                                        });
                                    });
                                }
                            );
                        }
                    );
                }
            );
        } else {
            res.json({ message: 'Feedback recorded' });
        }
    });
});

// Update doctor status only
app.patch('/api/doctors/:id/status', authenticate, requireDoctorManager, requireDoctorAccess, (req, res) => {
    if (!isValidId(req.params.id)) {
        res.status(400).json({ error: 'Invalid doctor id' });
        return;
    }
    const status = (req.body.status || '').toLowerCase();
    if (!DOCTOR_STATUSES.includes(status)) {
        res.status(400).json({ error: 'Status must be available, busy, or leave' });
        return;
    }
    const query = 'UPDATE doctors SET status = ? WHERE id = ?';
    db.query(query, [status, req.params.id], (err, result) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ message: 'Doctor status updated successfully' });
    });
});

// Delete doctor
app.delete('/api/doctors/:id', authenticate, requireDoctorManager, requireDoctorAccess, (req, res) => {
    if (!isValidId(req.params.id)) {
        res.status(400).json({ error: 'Invalid doctor id' });
        return;
    }
    const query = 'DELETE FROM doctors WHERE id = ?';
    db.query(query, [req.params.id], (err, result) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ message: 'Doctor deleted successfully' });
    });
});

// ============ SEARCH ROUTE ============
app.get('/api/search', (req, res) => {
    const q = (req.query.q != null ? String(req.query.q) : '').trim().substring(0, 200);
    const searchTerm = q ? `%${q.replace(/[%_\\]/g, '\\$&')}%` : '%';
    const query = `
        SELECT 'hospital' as type, id, name, location as detail FROM hospitals WHERE name LIKE ? OR location LIKE ?
        UNION
        SELECT 'doctor' as type, id, name, specialty as detail FROM doctors WHERE name LIKE ? OR specialty LIKE ?
    `;
    db.query(query, [searchTerm, searchTerm, searchTerm, searchTerm], (err, results) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(results);
    });
});

// ============ DASHBOARD STATS ============
app.get('/api/stats', authenticate, requireAdminRole, (req, res) => {
    const queries = {
        hospitals: 'SELECT COUNT(*) as count FROM hospitals',
        doctors: 'SELECT COUNT(*) as count FROM doctors',
        available: "SELECT COUNT(*) as count FROM doctors WHERE status = 'available'",
        busy: "SELECT COUNT(*) as count FROM doctors WHERE status = 'busy'",
        leave: "SELECT COUNT(*) as count FROM doctors WHERE status = 'leave'",
        blood_requests: "SELECT COUNT(*) as count FROM blood_requests WHERE expires_at > NOW()"
    };

    const stats = {};
    let completed = 0;

    Object.keys(queries).forEach(key => {
        db.query(queries[key], (err, results) => {
            if (!err) {
                stats[key] = results[0].count;
            }
            completed++;
            if (completed === Object.keys(queries).length) {
                res.json(stats);
            }
        });
    });
});

// ============ BLOOD REQUEST ROUTES ============

// Get all active blood requests (not expired)
app.get('/api/blood-requests', (req, res) => {
    const query = `
        SELECT br.*, h.name as hospital_name 
        FROM blood_requests br 
        LEFT JOIN hospitals h ON br.hospital_id = h.id 
        WHERE br.expires_at > NOW()
        ORDER BY br.urgent DESC, br.created_at DESC
    `;
    db.query(query, (err, results) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(results);
    });
});

// Get blood requests by hospital
app.get('/api/hospitals/:id/blood-requests', (req, res) => {
    if (!isValidId(req.params.id)) {
        res.status(400).json({ error: 'Invalid hospital id' });
        return;
    }
    const query = `
        SELECT * FROM blood_requests 
        WHERE hospital_id = ? AND expires_at > NOW()
        ORDER BY urgent DESC, created_at DESC
    `;
    db.query(query, [req.params.id], (err, results) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(results);
    });
});

// Add new blood request
app.post('/api/blood-requests', authenticate, requireBloodManager, requireBodyHospitalAccess, (req, res) => {
    const blood_type = (req.body.blood_type || '').toUpperCase().replace(/ /g, '');
    const hospital_id = parseInt(req.body.hospital_id, 10);
    const message = trimStr(req.body.message);
    const urgent = req.body.urgent !== false;
    const patient_name = trimStr(req.body.patient_name);
    const contact = trimStr(req.body.contact).replace(/\D/g, '');
    if (!BLOOD_TYPES.includes(blood_type)) {
        res.status(400).json({ error: 'Valid blood_type required (O+, O-, A+, A-, B+, B-, AB+, AB-)' });
        return;
    }
    if (!isValidId(hospital_id)) {
        res.status(400).json({ error: 'Valid hospital_id is required' });
        return;
    }
    if (!patient_name || patient_name.length > 255) {
        res.status(400).json({ error: 'Patient name is required (max 255 characters)' });
        return;
    }
    if (!contact || contact.length < 10) {
        res.status(400).json({ error: 'Valid contact number required (at least 10 digits)' });
        return;
    }
    const query = `
        INSERT INTO blood_requests (blood_type, hospital_id, message, urgent, patient_name, contact) 
        VALUES (?, ?, ?, ?, ?, ?)
    `;
    db.query(query, [blood_type, hospital_id, message || null, urgent, patient_name, contact], (err, result) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ id: result.insertId, message: 'Blood request added successfully' });
    });
});

// Delete blood request
app.delete('/api/blood-requests/:id', authenticate, requireBloodManager, requireBloodRequestAccess, (req, res) => {
    if (!isValidId(req.params.id)) {
        res.status(400).json({ error: 'Invalid blood request id' });
        return;
    }
    const query = 'DELETE FROM blood_requests WHERE id = ?';
    db.query(query, [req.params.id], (err, result) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ message: 'Blood request deleted successfully' });
    });
});

// ============ ADMIN ROUTES ============

// Admin Login
app.post('/api/admin/login', authLoginLimiter, (req, res) => {
    const username = trimStr(req.body.username);
    const password = req.body.password != null ? String(req.body.password) : '';
    if (!username) {
        res.status(400).json({ error: 'Username is required' });
        return;
    }
    if (!password) {
        res.status(400).json({ error: 'Password is required' });
        return;
    }
    const query = 'SELECT id, username, password, role, hospital_id, name, status FROM admins WHERE username = ?';
    db.query(query, [username], async (err, results) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (results.length === 0) {
            res.status(401).json({ error: 'Invalid username or password' });
            return;
        }
        const admin = results[0];
        if (admin.status === 'inactive') {
            res.status(403).json({ error: 'Account is inactive. Contact super admin.' });
            return;
        }
        const valid = await verifyPassword(password, admin.password);
        if (!valid) {
            res.status(401).json({ error: 'Invalid username or password' });
            return;
        }
        if (!admin.password.startsWith('$2')) {
            const hashed = hashPassword(password);
            db.query('UPDATE admins SET password = ? WHERE id = ?', [hashed, admin.id]);
        }
        const token = signToken(admin);
        res.json({
            success: true,
            message: 'Login successful',
            token,
            admin: {
                id: admin.id,
                username: admin.username,
                name: admin.name || '',
                role: admin.role,
                hospital_id: admin.hospital_id
            }
        });
    });
});

// Forgot Password – send OTP to registered admin email
app.post('/api/admin/forgot-password', forgotPasswordLimiter, async (req, res) => {
    const email = trimStr(req.body.email).toLowerCase();
    if (!email || !isValidEmail(email)) {
        res.status(400).json({ error: 'Valid email is required' });
        return;
    }

    try {
        const admins = await dbQuery(
            'SELECT id, username, name, status FROM admins WHERE LOWER(username) = ?',
            [email]
        );
        if (!admins.length) {
            res.status(404).json({ error: 'इस email से कोई admin account नहीं मिला' });
            return;
        }
        const admin = admins[0];
        if (admin.status === 'inactive') {
            res.status(403).json({ error: 'Account inactive है। Super Admin से संपर्क करें।' });
            return;
        }

        const otp = generateOtp();
        const otpHash = hashPassword(otp);
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

        await dbQuery('UPDATE password_reset_otps SET used = 1 WHERE email = ? AND used = 0', [email]);
        await dbQuery(
            'INSERT INTO password_reset_otps (admin_id, email, otp_hash, expires_at) VALUES (?, ?, ?, ?)',
            [admin.id, email, otpHash, expiresAt]
        );

        const mailResult = await sendOtpEmail(email, otp, admin.name || admin.username);
        const payload = {
            success: true,
            message: 'OTP sent to your email'
        };
        if (!mailResult.sent && !IS_PRODUCTION) {
            payload.devOtp = otp;
            payload.message = 'SMTP not configured — OTP logged on server (dev mode)';
        }
        res.json(payload);
    } catch (e) {
        console.error('forgot-password error:', e);
        res.status(500).json({ error: 'OTP भेजने में समस्या हुई। बाद में कोशिश करें।' });
    }
});

// Reset Password – verify OTP and set new password
app.post('/api/admin/reset-password', forgotPasswordLimiter, async (req, res) => {
    const email = trimStr(req.body.email).toLowerCase();
    const otp = trimStr(req.body.otp);
    const newPassword = req.body.newPassword != null ? String(req.body.newPassword) : '';

    if (!email || !isValidEmail(email)) {
        res.status(400).json({ error: 'Valid email is required' });
        return;
    }
    if (!otp || otp.length !== 6) {
        res.status(400).json({ error: '6 अंकों का OTP डालें' });
        return;
    }
    if (!newPassword || newPassword.length < 6) {
        res.status(400).json({ error: 'पासवर्ड कम से कम 6 अक्षर का होना चाहिए' });
        return;
    }

    try {
        const rows = await dbQuery(
            `SELECT id, admin_id, otp_hash FROM password_reset_otps
             WHERE email = ? AND used = 0 AND expires_at > NOW()
             ORDER BY id DESC LIMIT 1`,
            [email]
        );
        if (!rows.length) {
            res.status(400).json({ error: 'OTP expired या invalid है। नया OTP मँगवाएँ।' });
            return;
        }

        const record = rows[0];
        const validOtp = await verifyPassword(otp, record.otp_hash);
        if (!validOtp) {
            res.status(400).json({ error: 'गलत OTP। कृपया सही code डालें।' });
            return;
        }

        const hashed = hashPassword(newPassword);
        await dbQuery('UPDATE admins SET password = ? WHERE id = ?', [hashed, record.admin_id]);
        await dbQuery('UPDATE password_reset_otps SET used = 1 WHERE id = ?', [record.id]);

        res.json({ success: true, message: 'Password reset successful' });
    } catch (e) {
        console.error('reset-password error:', e);
        res.status(500).json({ error: 'पासवर्ड बदलने में समस्या हुई' });
    }
});

// Get all admins (superadmin only)
app.get('/api/admins', authenticate, requireSuperAdmin, (req, res) => {
    const query = 'SELECT id, username, role, hospital_id, created_at FROM admins';
    db.query(query, (err, results) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(results);
    });
});

// Add new admin
app.post('/api/admins', authenticate, requireSuperAdmin, (req, res) => {
    const username = trimStr(req.body.username);
    const password = req.body.password != null ? String(req.body.password) : '';
    const role = trimStr(req.body.role) || 'admin';
    const hospital_id = req.body.hospital_id != null ? parseInt(req.body.hospital_id, 10) : null;
    if (!username || username.length > 100) {
        res.status(400).json({ error: 'Username is required (max 100 characters)' });
        return;
    }
    if (!password) {
        res.status(400).json({ error: 'Password is required' });
        return;
    }
    const hashedPassword = hashPassword(password);
    const query = 'INSERT INTO admins (username, password, role, hospital_id) VALUES (?, ?, ?, ?)';
    db.query(query, [username, hashedPassword, role, isValidId(hospital_id) ? hospital_id : null], (err, result) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ id: result.insertId, message: 'Admin added successfully' });
    });
});

// Delete admin
app.delete('/api/admins/:id', authenticate, requireSuperAdmin, (req, res) => {
    if (!isValidId(req.params.id)) {
        res.status(400).json({ error: 'Invalid admin id' });
        return;
    }
    const query = 'DELETE FROM admins WHERE id = ?';
    db.query(query, [req.params.id], (err, result) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ message: 'Admin deleted successfully' });
    });
});

// ============ HOSPITAL ADMIN ACCOUNTS ============

app.get('/api/hospital-admins', authenticate, requireSuperAdmin, async (req, res) => {
    try {
        const rows = await dbQuery(`
            SELECT a.id, a.username, a.name, a.mobile, a.status, a.hospital_id, a.created_at, h.name AS hospital_name
            FROM admins a
            LEFT JOIN hospitals h ON a.hospital_id = h.id
            WHERE a.role IN ('hospital_admin', 'admin')
            ORDER BY a.id DESC
        `);
        res.json(rows.map(formatScopedAdminRow));
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/hospital-admins', authenticate, requireSuperAdmin, async (req, res) => {
    try {
        const name = trimStr(req.body.name);
        const email = trimStr(req.body.email || req.body.username);
        const password = req.body.password != null ? String(req.body.password) : '';
        const hospitalName = trimStr(req.body.hospital_name);
        const mobile = trimStr(req.body.mobile);
        const status = trimStr(req.body.status) || 'active';

        if (!name) return res.status(400).json({ error: 'Name is required' });
        if (!email) return res.status(400).json({ error: 'Email is required' });
        if (!password || password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
        if (!ADMIN_STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid status' });

        let hospitalId = parseInt(req.body.hospital_id, 10);
        if (!isValidId(hospitalId)) hospitalId = await resolveHospitalIdFromName(hospitalName);
        if (!hospitalId) return res.status(400).json({ error: 'Hospital not found' });

        const hashedPassword = hashPassword(password);
        const result = await dbQuery(
            'INSERT INTO admins (username, name, password, role, hospital_id, mobile, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [email, name, hashedPassword, 'hospital_admin', hospitalId, mobile || null, status]
        );
        res.json({ id: result.insertId, message: 'Hospital admin created successfully' });
    } catch (e) {
        const msg = e.message || '';
        if (/Duplicate entry/i.test(msg)) return res.status(400).json({ error: 'Email already exists' });
        res.status(500).json({ error: msg });
    }
});

app.put('/api/hospital-admins/:id', authenticate, requireSuperAdmin, async (req, res) => {
    try {
        if (!isValidId(req.params.id)) return res.status(400).json({ error: 'Invalid admin id' });

        const existing = await dbQuery(
            'SELECT id, role FROM admins WHERE id = ? AND role IN (?, ?)',
            [req.params.id, 'hospital_admin', 'admin']
        );
        if (!existing.length) return res.status(404).json({ error: 'Hospital admin not found' });

        const name = trimStr(req.body.name);
        const email = trimStr(req.body.email || req.body.username);
        const password = req.body.password != null ? String(req.body.password) : '';
        const hospitalName = trimStr(req.body.hospital_name);
        const mobile = trimStr(req.body.mobile);
        const status = trimStr(req.body.status) || 'active';

        if (!name) return res.status(400).json({ error: 'Name is required' });
        if (!email) return res.status(400).json({ error: 'Email is required' });
        if (!ADMIN_STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid status' });

        let hospitalId = parseInt(req.body.hospital_id, 10);
        if (!isValidId(hospitalId)) hospitalId = await resolveHospitalIdFromName(hospitalName);
        if (!hospitalId) return res.status(400).json({ error: 'Hospital not found' });

        let sql = 'UPDATE admins SET username=?, name=?, role=?, hospital_id=?, mobile=?, status=?';
        const params = [email, name, 'hospital_admin', hospitalId, mobile || null, status];
        if (password) {
            sql += ', password=?';
            params.push(hashPassword(password));
        }
        sql += ' WHERE id=?';
        params.push(req.params.id);
        await dbQuery(sql, params);
        res.json({ message: 'Hospital admin updated successfully' });
    } catch (e) {
        const msg = e.message || '';
        if (/Duplicate entry/i.test(msg)) return res.status(400).json({ error: 'Email already exists' });
        res.status(500).json({ error: msg });
    }
});

app.delete('/api/hospital-admins/:id', authenticate, requireSuperAdmin, async (req, res) => {
    try {
        if (!isValidId(req.params.id)) return res.status(400).json({ error: 'Invalid admin id' });
        const result = await dbQuery(
            'DELETE FROM admins WHERE id = ? AND role IN (?, ?)',
            [req.params.id, 'hospital_admin', 'admin']
        );
        if (!result.affectedRows) return res.status(404).json({ error: 'Hospital admin not found' });
        res.json({ message: 'Hospital admin deleted successfully' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ============ BLOOD ADMIN ACCOUNTS ============

app.get('/api/blood-admins', authenticate, requireSuperAdmin, async (req, res) => {
    try {
        const rows = await dbQuery(`
            SELECT a.id, a.username, a.name, a.mobile, a.status, a.hospital_id, a.created_at, h.name AS hospital_name
            FROM admins a
            LEFT JOIN hospitals h ON a.hospital_id = h.id
            WHERE a.role = 'blood_admin'
            ORDER BY a.id DESC
        `);
        res.json(rows.map(formatScopedAdminRow));
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/blood-admins', authenticate, requireSuperAdmin, async (req, res) => {
    try {
        const name = trimStr(req.body.name);
        const email = trimStr(req.body.email || req.body.username);
        const password = req.body.password != null ? String(req.body.password) : '';
        const hospitalName = trimStr(req.body.hospital_name);
        const mobile = trimStr(req.body.mobile);
        const status = trimStr(req.body.status) || 'active';

        if (!name) return res.status(400).json({ error: 'Name is required' });
        if (!email) return res.status(400).json({ error: 'Email is required' });
        if (!password || password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
        if (!ADMIN_STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid status' });

        let hospitalId = parseInt(req.body.hospital_id, 10);
        if (!isValidId(hospitalId)) hospitalId = await resolveHospitalIdFromName(hospitalName);
        if (!hospitalId) return res.status(400).json({ error: 'Hospital not found' });

        const hashedPassword = hashPassword(password);
        const result = await dbQuery(
            'INSERT INTO admins (username, name, password, role, hospital_id, mobile, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [email, name, hashedPassword, 'blood_admin', hospitalId, mobile || null, status]
        );
        res.json({ id: result.insertId, message: 'Blood admin created successfully' });
    } catch (e) {
        const msg = e.message || '';
        if (/Duplicate entry/i.test(msg)) return res.status(400).json({ error: 'Email already exists' });
        res.status(500).json({ error: msg });
    }
});

app.put('/api/blood-admins/:id', authenticate, requireSuperAdmin, async (req, res) => {
    try {
        if (!isValidId(req.params.id)) return res.status(400).json({ error: 'Invalid admin id' });

        const existing = await dbQuery('SELECT id FROM admins WHERE id = ? AND role = ?', [req.params.id, 'blood_admin']);
        if (!existing.length) return res.status(404).json({ error: 'Blood admin not found' });

        const name = trimStr(req.body.name);
        const email = trimStr(req.body.email || req.body.username);
        const password = req.body.password != null ? String(req.body.password) : '';
        const hospitalName = trimStr(req.body.hospital_name);
        const mobile = trimStr(req.body.mobile);
        const status = trimStr(req.body.status) || 'active';

        if (!name) return res.status(400).json({ error: 'Name is required' });
        if (!email) return res.status(400).json({ error: 'Email is required' });
        if (!ADMIN_STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid status' });

        let hospitalId = parseInt(req.body.hospital_id, 10);
        if (!isValidId(hospitalId)) hospitalId = await resolveHospitalIdFromName(hospitalName);
        if (!hospitalId) return res.status(400).json({ error: 'Hospital not found' });

        let sql = 'UPDATE admins SET username=?, name=?, role=?, hospital_id=?, mobile=?, status=?';
        const params = [email, name, 'blood_admin', hospitalId, mobile || null, status];
        if (password) {
            sql += ', password=?';
            params.push(hashPassword(password));
        }
        sql += ' WHERE id=?';
        params.push(req.params.id);
        await dbQuery(sql, params);
        res.json({ message: 'Blood admin updated successfully' });
    } catch (e) {
        const msg = e.message || '';
        if (/Duplicate entry/i.test(msg)) return res.status(400).json({ error: 'Email already exists' });
        res.status(500).json({ error: msg });
    }
});

app.delete('/api/blood-admins/:id', authenticate, requireSuperAdmin, async (req, res) => {
    try {
        if (!isValidId(req.params.id)) return res.status(400).json({ error: 'Invalid admin id' });
        const result = await dbQuery('DELETE FROM admins WHERE id = ? AND role = ?', [req.params.id, 'blood_admin']);
        if (!result.affectedRows) return res.status(404).json({ error: 'Blood admin not found' });
        res.json({ message: 'Blood admin deleted successfully' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ============ BULK UPDATE (Admin feature) ============

// Update multiple doctors status at once
app.patch('/api/doctors/bulk-status', authenticate, requireDoctorManager, async (req, res) => {
    const { doctor_ids, status } = req.body;
    if (!doctor_ids || !Array.isArray(doctor_ids) || doctor_ids.length === 0) {
        res.status(400).json({ error: 'doctor_ids array is required' });
        return;
    }
    const statusLower = (status || '').toLowerCase();
    if (!DOCTOR_STATUSES.includes(statusLower)) {
        res.status(400).json({ error: 'Status must be available, busy, or leave' });
        return;
    }
    const ids = doctor_ids.map((id) => parseInt(id, 10)).filter((id) => isValidId(id));
    if (!ids.length) {
        res.status(400).json({ error: 'Valid doctor_ids required' });
        return;
    }
    if (req.admin.role !== 'superadmin') {
        try {
            const placeholders = ids.map(() => '?').join(',');
            const rows = await dbQuery(`SELECT id, hospital_id FROM doctors WHERE id IN (${placeholders})`, ids);
            const denied = rows.some((row) => row.hospital_id !== req.admin.hospital_id);
            if (denied || rows.length !== ids.length) {
                res.status(403).json({ error: 'Access denied for one or more doctors' });
                return;
            }
        } catch (e) {
            res.status(500).json({ error: e.message });
            return;
        }
    }
    const placeholders = ids.map(() => '?').join(',');
    const query = `UPDATE doctors SET status = ? WHERE id IN (${placeholders})`;
    db.query(query, [statusLower, ...ids], (err, result) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ message: `${result.affectedRows} doctors updated successfully` });
    });
});

// Site settings API (super admin panel)
app.get('/api/site-settings', (req, res) => {
    res.json(loadSiteSettings());
});

app.put('/api/site-settings', authenticate, requireSuperAdmin, (req, res) => {
    try {
        const cur = loadSiteSettings();
        const merged = mergeDeep(cur, req.body && typeof req.body === 'object' ? req.body : {});
        saveSiteSettings(merged);
        res.json({ ok: true, settings: merged });
    } catch (e) {
        res.status(500).json({ error: e.message || 'Failed to save site settings' });
    }
});

function mapContactMessageRow(row) {
    if (!row) return null;
    return {
        id: row.id,
        name: row.name,
        mobile: row.mobile,
        email: row.email,
        subject: row.subject,
        subjectText: row.subject_text || row.subject,
        message: row.message,
        status: row.status || 'pending',
        reply: row.reply || '',
        createdAt: row.created_at,
        repliedAt: row.replied_at
    };
}

const CONTACT_SUBJECTS = new Set(['general', 'doctor', 'hospital', 'technical', 'suggestion', 'complaint']);

app.post('/api/contact-messages', contactSubmitLimiter, (req, res) => {
    const name = trimStr(req.body && req.body.name);
    const mobile = trimStr(req.body && req.body.mobile).replace(/\D/g, '');
    const email = trimStr(req.body && req.body.email);
    const subject = trimStr(req.body && req.body.subject);
    const subjectText = trimStr(req.body && req.body.subjectText) || subject;
    const message = trimStr(req.body && req.body.message);

    if (!name || name.length < 3) {
        res.status(400).json({ error: 'कृपया अपना नाम लिखें (कम से कम 3 अक्षर)' });
        return;
    }
    if (!mobile || mobile.length !== 10) {
        res.status(400).json({ error: 'कृपया सही 10 अंकों का मोबाइल नंबर लिखें' });
        return;
    }
    if (!email || !isValidEmail(email)) {
        res.status(400).json({ error: 'कृपया सही ईमेल पता लिखें' });
        return;
    }
    if (!subject || !CONTACT_SUBJECTS.has(subject)) {
        res.status(400).json({ error: 'कृपया एक विषय चुनें' });
        return;
    }
    if (!message || message.length < 10) {
        res.status(400).json({ error: 'कृपया अपना संदेश लिखें (कम से कम 10 अक्षर)' });
        return;
    }

    const query = `INSERT INTO contact_messages (name, mobile, email, subject, subject_text, message)
        VALUES (?, ?, ?, ?, ?, ?)`;
    db.query(query, [name, mobile, email, subject, subjectText, message], (err, result) => {
        if (err) {
            res.status(500).json({ error: 'संदेश सेव नहीं हो सका। बाद में दोबारा कोशिश करें।' });
            return;
        }
        res.status(201).json({
            success: true,
            message: 'धन्यवाद! आपका संदेश भेज दिया गया है।',
            id: result.insertId
        });
    });
});

app.get('/api/contact-messages', authenticate, requireSuperAdmin, (req, res) => {
    db.query('SELECT * FROM contact_messages ORDER BY created_at DESC', (err, rows) => {
        if (err) {
            res.status(500).json({ error: 'संदेश लोड नहीं हो सके' });
            return;
        }
        res.json((rows || []).map(mapContactMessageRow));
    });
});

app.patch('/api/contact-messages/:id', authenticate, requireSuperAdmin, (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!id) {
        res.status(400).json({ error: 'Invalid message id' });
        return;
    }
    const status = trimStr(req.body && req.body.status);
    const reply = trimStr(req.body && req.body.reply);
    const updates = [];
    const params = [];

    if (status === 'pending' || status === 'replied') {
        updates.push('status = ?');
        params.push(status);
    }
    if (reply) {
        updates.push('reply = ?');
        params.push(reply);
        if (!status) {
            updates.push("status = 'replied'");
        }
        updates.push('replied_at = CURRENT_TIMESTAMP');
    }

    if (updates.length === 0) {
        res.status(400).json({ error: 'Nothing to update' });
        return;
    }

    params.push(id);
    db.query(`UPDATE contact_messages SET ${updates.join(', ')} WHERE id = ?`, params, (err, result) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (!result.affectedRows) {
            res.status(404).json({ error: 'Message not found' });
            return;
        }
        db.query('SELECT * FROM contact_messages WHERE id = ?', [id], (selErr, rows) => {
            if (selErr) {
                res.json({ success: true });
                return;
            }
            res.json({ success: true, message: mapContactMessageRow(rows[0]) });
        });
    });
});

app.delete('/api/contact-messages/:id', authenticate, requireSuperAdmin, (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!id) {
        res.status(400).json({ error: 'Invalid message id' });
        return;
    }
    db.query('DELETE FROM contact_messages WHERE id = ?', [id], (err, result) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (!result.affectedRows) {
            res.status(404).json({ error: 'Message not found' });
            return;
        }
        res.json({ success: true });
    });
});

const DATA_DIR = path.join(__dirname, 'data');
const TABLE_INSERT_ORDER = ['hospitals', 'cities', 'doctors', 'doctor_feedback', 'blood_requests', 'hospital_ratings', 'admins', 'contact_messages'];

function safeJsonBasename(name) {
    const base = path.basename(name);
    return /^[a-zA-Z0-9][a-zA-Z0-9_.-]*\.json$/i.test(base) ? base : null;
}

function safeSqlIdent(name) {
    if (!/^[a-zA-Z0-9_]+$/.test(name)) throw new Error(`Invalid table name: ${name}`);
    return name;
}

async function buildFullBackupPayload() {
    const files = {};
    if (fs.existsSync(DATA_DIR)) {
        for (const name of fs.readdirSync(DATA_DIR)) {
            const sn = safeJsonBasename(name);
            if (!sn) continue;
            const fp = path.join(DATA_DIR, sn);
            if (!fs.statSync(fp).isFile()) continue;
            try {
                files[sn] = JSON.parse(fs.readFileSync(fp, 'utf8'));
            } catch (e) {
                files[sn] = { _readError: String(e.message || e) };
            }
        }
    }
    // dbQuery resolves to the row array (not [rows, fields] like mysql2/promise)
    const tables = await dbQuery(
        'SELECT TABLE_NAME AS t FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = ?',
        ['BASE TABLE']
    );
    const database = {};
    const tableRows = Array.isArray(tables) ? tables : [];
    for (const row of tableRows) {
        const t = row.t;
        if (!t || !/^[a-zA-Z0-9_]+$/.test(t)) continue;
        database[t] = await dbQuery(`SELECT * FROM \`${t}\``);
    }
    return {
        mediBackupVersion: 1,
        exportedAt: new Date().toISOString(),
        app: 'hospital-doctor-availability',
        files,
        database
    };
}

async function restoreDatabaseFromBackup(database) {
    if (!database || typeof database !== 'object') throw new Error('Invalid database section');
    const tableNames = Object.keys(database);
    await dbQuery('SET FOREIGN_KEY_CHECKS=0');
    for (const t of tableNames) {
        safeSqlIdent(t);
        await dbQuery(`TRUNCATE TABLE \`${t}\``);
    }
    const ordered = [
        ...TABLE_INSERT_ORDER.filter((t) => tableNames.includes(t)),
        ...tableNames.filter((t) => !TABLE_INSERT_ORDER.includes(t))
    ];
    for (const t of ordered) {
        const rows = database[t];
        if (!Array.isArray(rows) || rows.length === 0) continue;
        safeSqlIdent(t);
        for (const row of rows) {
            if (!row || typeof row !== 'object') continue;
            const cols = Object.keys(row).filter((c) => /^[a-zA-Z0-9_]+$/.test(c));
            if (cols.length === 0) continue;
            const vals = cols.map((c) => {
                const v = row[c];
                if (v === undefined) return null;
                return v;
            });
            const colSql = cols.map((c) => `\`${c}\``).join(',');
            const ph = cols.map(() => '?').join(',');
            await dbQuery(`INSERT INTO \`${t}\` (${colSql}) VALUES (${ph})`, vals);
        }
    }
    await dbQuery('SET FOREIGN_KEY_CHECKS=1');
}

const DEMO_DATA_TABLES = ['doctor_feedback', 'hospital_ratings', 'blood_requests', 'doctors', 'hospitals', 'cities'];

async function clearDemoDataFromDatabase() {
    await dbQuery('SET FOREIGN_KEY_CHECKS=0');
    for (const t of DEMO_DATA_TABLES) {
        safeSqlIdent(t);
        await dbQuery(`TRUNCATE TABLE \`${t}\``);
    }
    await dbQuery('SET FOREIGN_KEY_CHECKS=1');
    const counts = {};
    for (const t of DEMO_DATA_TABLES) {
        const rows = await dbQuery(`SELECT COUNT(*) AS c FROM \`${t}\``);
        counts[t] = Number(rows[0]?.c) || 0;
    }
    const adminRows = await dbQuery('SELECT COUNT(*) AS c FROM admins');
    counts.admins_kept = Number(adminRows[0]?.c) || 0;
    return counts;
}

app.post('/api/clear-demo-data', authenticate, requireSuperAdmin, async (req, res) => {
    try {
        if (req.body?.confirm !== 'CLEAR_DEMO_DATA') {
            res.status(400).json({ error: 'Send { "confirm": "CLEAR_DEMO_DATA" } to proceed' });
            return;
        }
        const counts = await clearDemoDataFromDatabase();
        res.json({
            ok: true,
            message: 'Demo hospitals, doctors, blood requests and cities removed. Admin accounts kept.',
            counts
        });
    } catch (e) {
        res.status(500).json({ error: e.message || 'Clear failed' });
    }
});

app.get('/api/full-backup/export', authenticate, requireSuperAdmin, async (req, res) => {
    try {
        const payload = await buildFullBackupPayload();
        const fname = `livehospital-full-backup-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${fname}"`);
        res.send(JSON.stringify(payload, null, 2));
    } catch (e) {
        res.status(500).json({ error: e.message || 'Export failed' });
    }
});

const backupImportJson = express.json({ limit: '100mb' });
app.post('/api/full-backup/import', authenticate, requireSuperAdmin, backupImportJson, async (req, res) => {
    try {
        const body = req.body;
        if (!body || body.mediBackupVersion !== 1 || !body.database || typeof body.database !== 'object') {
            res.status(400).json({ error: 'Invalid backup file (mediBackupVersion 1 with database required)' });
            return;
        }
        if (body.files && typeof body.files === 'object') {
            fs.mkdirSync(DATA_DIR, { recursive: true });
            for (const [name, content] of Object.entries(body.files)) {
                const sn = safeJsonBasename(name);
                if (!sn) continue;
                const jsonStr = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
                JSON.parse(jsonStr);
                fs.writeFileSync(path.join(DATA_DIR, sn), jsonStr, 'utf8');
            }
            loadSiteSettings();
        }
        await restoreDatabaseFromBackup(body.database);
        res.json({ ok: true, message: 'Backup restored. Refresh admin / website.' });
    } catch (e) {
        res.status(500).json({ error: e.message || 'Import failed' });
    }
});

function sendServerError(req, res, err) {
    if (res.headersSent) return;
    console.error('[Server 500]', req.method, req.originalUrl || req.url, err && (err.stack || err));

    const isApi = (req.path || '').startsWith('/api/') || req.path === '/api';
    if (isApi) {
        const payload = { error: 'Internal server error' };
        if (!IS_PRODUCTION && err && err.message) {
            payload.detail = err.message;
        }
        res.status(500).json(payload);
        return;
    }

    if (req.method === 'GET' || req.method === 'HEAD') {
        if (req.accepts('html')) {
            res.status(500).sendFile(path.join(__dirname, '..', '500.html'));
            return;
        }
    }

    res.status(500).send('Internal server error');
}

// Global error handler — must be before 404 catch-all
app.use((err, req, res, next) => {
    if (!err) return next();
    sendServerError(req, res, err);
});

// Custom 404 — attractive page with related site links
app.use((req, res) => {
    if (req.path.startsWith('/api/') || req.path === '/api') {
        res.status(404).json({ error: 'Not found' });
        return;
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.status(404).send('Not found');
        return;
    }
    if (req.accepts('html')) {
        res.status(404).sendFile(path.join(__dirname, '..', '404.html'));
        return;
    }
    res.status(404).send('Not found');
});

// Start server
const PORT = process.env.PORT || 5000;

process.on('unhandledRejection', (reason) => {
    console.error('[unhandledRejection]', reason);
});

process.on('uncaughtException', (err) => {
    console.error('[uncaughtException]', err && (err.stack || err));
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`NODE_ENV=${process.env.NODE_ENV || 'development'} | DB_USER=${process.env.DB_USER || '(empty)'} | DB_NAME=${process.env.DB_NAME || '(empty)'}`);
    console.log(`Env file: ${envPath} (exists: ${envLoad.exists})`);
    console.log(`API available at http://localhost:${PORT}/api`);
    console.log('------------------------------------');
    console.log('Available Endpoints:');
    console.log('  GET  /api/hospitals');
    console.log('  GET  /api/doctors');
    console.log('  GET  /api/blood-requests');
    console.log('  GET  /api/stats');
    console.log('  POST /api/admin/login');
    console.log('  POST /api/admin/forgot-password');
    console.log('  POST /api/admin/reset-password');
    if (!isEmailConfigured()) {
        console.log('  ⚠ SMTP not configured — OTP emails will log to console in dev');
    }
    console.log('------------------------------------');
});
