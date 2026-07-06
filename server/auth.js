const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const JWT_SECRET = process.env.JWT_SECRET || 'medichek-dev-secret-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const BCRYPT_ROUNDS = 10;

function hashPassword(plain) {
    return bcrypt.hashSync(plain, BCRYPT_ROUNDS);
}

async function verifyPassword(plain, stored) {
    if (!stored) return false;
    if (!stored.startsWith('$2')) {
        return plain === stored;
    }
    return bcrypt.compare(plain, stored);
}

function signToken(admin) {
    return jwt.sign(
        {
            id: admin.id,
            username: admin.username,
            role: admin.role,
            hospital_id: admin.hospital_id || null,
            doctor_id: admin.doctor_id || null
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
    );
}

const ADMIN_LOGIN_SELECT = 'id, username, password, role, hospital_id, doctor_id, name, status, mobile';

function normalizeMobileDigits(value) {
    const digits = String(value || '').replace(/\D/g, '');
    if (digits.length >= 10) return digits.slice(-10);
    return digits;
}

function mobileLookupVariants(value) {
    const last10 = normalizeMobileDigits(value);
    if (last10.length !== 10) return { last10: '', variants: [] };
    const variants = [...new Set([last10, '91' + last10, '+91' + last10, '0' + last10])];
    return { last10, variants };
}

async function findAdminForLogin(dbQuery, identifier) {
    const id = String(identifier || '').trim();
    if (!id) return null;

    if (id.includes('@')) {
        const rows = await dbQuery(
            `SELECT ${ADMIN_LOGIN_SELECT} FROM admins WHERE LOWER(username) = ? LIMIT 1`,
            [id.toLowerCase()]
        );
        return rows[0] || null;
    }

    const { last10, variants } = mobileLookupVariants(id);
    if (last10) {
        const placeholders = variants.map(() => '?').join(', ');
        const rows = await dbQuery(
            `SELECT ${ADMIN_LOGIN_SELECT} FROM admins
             WHERE mobile IS NOT NULL AND (
                mobile IN (${placeholders})
                OR RIGHT(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(mobile, ' ', ''), '-', ''), '+', ''), '.', ''), '(', ''), 10) = ?
             )`,
            [...variants, last10]
        );
        if (rows.length > 1) return { _ambiguous: true };
        if (rows.length === 1) return rows[0];
    }

    const rows = await dbQuery(
        `SELECT ${ADMIN_LOGIN_SELECT} FROM admins WHERE username = ? LIMIT 1`,
        [id]
    );
    return rows[0] || null;
}

async function validateDoctorAdminAccount(dbQuery, admin) {
    if (!admin || admin.role !== 'doctor_admin') {
        return { ok: true };
    }
    if (!admin.doctor_id) {
        return {
            ok: false,
            status: 403,
            error: 'Doctor account is not linked to a profile. Contact super admin.'
        };
    }
    const rows = await dbQuery('SELECT id, hospital_id FROM doctors WHERE id = ? LIMIT 1', [admin.doctor_id]);
    if (!rows.length) {
        return {
            ok: false,
            status: 403,
            error: 'Doctor profile not found. Contact super admin.'
        };
    }
    return { ok: true, hospital_id: rows[0].hospital_id };
}

function extractToken(req) {
    const header = req.headers.authorization || '';
    if (header.startsWith('Bearer ')) return header.slice(7);
    return null;
}

function authenticate(req, res, next) {
    const token = extractToken(req);
    if (!token) {
        res.status(401).json({ error: 'Authentication required' });
        return;
    }
    try {
        req.admin = jwt.verify(token, JWT_SECRET);
        next();
    } catch (e) {
        res.status(401).json({ error: 'Invalid or expired token' });
    }
}

function requireSuperAdmin(req, res, next) {
    if (!req.admin || req.admin.role !== 'superadmin') {
        res.status(403).json({ error: 'Super admin access required' });
        return;
    }
    next();
}

function requireAdminRole(req, res, next) {
    const role = req.admin && req.admin.role;
    const allowed = ['superadmin', 'admin', 'hospital_admin', 'blood_admin'];
    if (!role || !allowed.includes(role)) {
        res.status(403).json({ error: 'Admin access required' });
        return;
    }
    next();
}

function requireDoctorManager(req, res, next) {
    const role = req.admin && req.admin.role;
    if (role === 'superadmin' || role === 'hospital_admin' || role === 'admin') {
        next();
        return;
    }
    res.status(403).json({ error: 'Hospital admin access required' });
}

function requireBloodManager(req, res, next) {
    const role = req.admin && req.admin.role;
    if (role === 'superadmin' || role === 'blood_admin') {
        next();
        return;
    }
    res.status(403).json({ error: 'Blood admin access required' });
}

function requireDoctorSelf(req, res, next) {
    const role = req.admin && req.admin.role;
    if (role !== 'doctor_admin') {
        res.status(403).json({ error: 'Doctor access required' });
        return;
    }
    if (!req.admin.doctor_id) {
        res.status(403).json({ error: 'Doctor account not linked to a profile' });
        return;
    }
    next();
}

function requireDoctorSelfAccess(req, res, next) {
    if (req.admin.role === 'superadmin') {
        next();
        return;
    }
    if (req.admin.role !== 'doctor_admin' || !req.admin.doctor_id) {
        res.status(403).json({ error: 'Doctor access required' });
        return;
    }
    const doctorId = parseInt(req.params.id, 10);
    if (!Number.isFinite(doctorId) || doctorId !== req.admin.doctor_id) {
        res.status(403).json({ error: 'Access denied for this doctor profile' });
        return;
    }
    next();
}

function requireHospitalIdAccess(hospitalId) {
    const hid = parseInt(hospitalId, 10);
    return (req, res, next) => {
        if (req.admin.role === 'superadmin') {
            next();
            return;
        }
        const scopedRoles = ['admin', 'hospital_admin', 'blood_admin'];
        if (scopedRoles.includes(req.admin.role) && req.admin.hospital_id === hid) {
            next();
            return;
        }
        res.status(403).json({ error: 'Access denied for this hospital' });
    };
}

module.exports = {
    hashPassword,
    verifyPassword,
    signToken,
    findAdminForLogin,
    validateDoctorAdminAccount,
    normalizeMobileDigits,
    authenticate,
    requireSuperAdmin,
    requireAdminRole,
    requireDoctorManager,
    requireBloodManager,
    requireDoctorSelf,
    requireDoctorSelfAccess,
    requireHospitalIdAccess,
    JWT_SECRET
};
