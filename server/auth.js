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
            hospital_id: admin.hospital_id || null
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
    );
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
    authenticate,
    requireSuperAdmin,
    requireAdminRole,
    requireDoctorManager,
    requireBloodManager,
    requireHospitalIdAccess,
    JWT_SECRET
};
