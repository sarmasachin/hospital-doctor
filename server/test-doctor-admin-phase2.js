/**
 * Phase 2 smoke test: doctor self APIs + doctor-admins CRUD
 * Run: node test-doctor-admin-phase2.js
 * Requires: server running (default PORT from .env or 5000)
 */
require('dotenv').config();
const mysql = require('mysql2/promise');
const { hashPassword } = require('./auth');

const PORT = process.env.PORT || 5000;
const API = `http://localhost:${PORT}/api`;

async function request(method, path, body, token) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`${API}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
}

async function main() {
    const conn = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'hospital_db'
    });
    const dbQuery = async (sql, params = []) => {
        const [rows] = await conn.query(sql, params);
        return rows;
    };

    const doctors = await dbQuery('SELECT id, hospital_id, specialty FROM doctors ORDER BY id ASC LIMIT 1');
    if (!doctors.length) {
        console.log('No doctors in DB — add a doctor first.');
        await conn.end();
        return;
    }
    const doctorId = doctors[0].id;
    const hospitalId = doctors[0].hospital_id;
    const testEmail = `phase2.doctor.${Date.now()}@example.com`;
    const testMobile = '9' + String(Date.now()).slice(-9);
    const testPassword = 'Test@12345';

    let superToken = null;
    const supers = await dbQuery("SELECT id, username, password FROM admins WHERE role = 'superadmin' AND status = 'active' LIMIT 1");
    if (supers.length) {
        const login = await request('POST', '/admin/login', {
            username: supers[0].username,
            password: process.env.TEST_SUPERADMIN_PASSWORD || 'admin123'
        });
        if (login.status === 200 && login.data.token) {
            superToken = login.data.token;
        }
    }

    let doctorAdminId = null;
    let doctorToken = null;

    try {
        if (superToken) {
            const create = await request('POST', '/doctor-admins', {
                name: 'Phase2 Doctor Admin',
                email: testEmail,
                password: testPassword,
                mobile: testMobile,
                doctor_id: doctorId,
                status: 'active'
            }, superToken);
            console.log('POST /doctor-admins:', create.status === 200 ? 'OK' : `FAIL (${create.status}) ${create.data.error || ''}`);
            doctorAdminId = create.data.id;
        } else {
            const insert = await conn.query(
                `INSERT INTO admins (username, name, password, role, hospital_id, doctor_id, mobile, status)
                 VALUES (?, ?, ?, 'doctor_admin', ?, ?, ?, 'active')`,
                [testEmail, 'Phase2 Doctor Admin', hashPassword(testPassword), hospitalId, doctorId, testMobile]
            );
            doctorAdminId = insert[0].insertId;
            console.log('POST /doctor-admins: SKIP (no superadmin login) — inserted via DB');
        }

        const loginDoctor = await request('POST', '/admin/login', {
            username: testEmail,
            password: testPassword
        });
        console.log('Doctor login:', loginDoctor.status === 200 ? 'OK' : `FAIL (${loginDoctor.status})`);
        doctorToken = loginDoctor.data.token;

        const me = await request('GET', '/me/doctor', null, doctorToken);
        const hasAccount = me.data.account && me.data.account.email === testEmail;
        const hasDoctor = me.data.doctor && me.data.doctor.id === doctorId;
        console.log('GET /me/doctor:', me.status === 200 && hasAccount && hasDoctor ? 'OK' : `FAIL (${me.status})`);

        const patchStatus = await request('PATCH', '/me/doctor/status', { status: 'busy' }, doctorToken);
        console.log('PATCH /me/doctor/status:', patchStatus.status === 200 && patchStatus.data.status === 'busy' ? 'OK' : `FAIL (${patchStatus.status})`);

        const putProfile = await request('PUT', '/me/doctor', {
            timing: '10:00 AM - 2:00 PM',
            fees: '500',
            opd_days: 'Mon,Tue,Wed,Thu,Fri'
        }, doctorToken);
        console.log('PUT /me/doctor:', putProfile.status === 200 ? 'OK' : `FAIL (${putProfile.status}) ${putProfile.data.error || ''}`);

        const blockName = await request('PUT', '/me/doctor', { name: 'Hacked Name' }, doctorToken);
        console.log('PUT /me/doctor blocks name:', blockName.status === 400 ? 'OK' : 'FAIL');

        const publicDoctor = await request('GET', `/doctors/${doctorId}`);
        const publicHasEmail = publicDoctor.data && (publicDoctor.data.email || publicDoctor.data.mobile);
        console.log('Public doctor has no email/mobile:', publicDoctor.status === 200 && !publicHasEmail ? 'OK' : 'FAIL');

        if (superToken && doctorAdminId) {
            const list = await request('GET', '/doctor-admins', null, superToken);
            const found = Array.isArray(list.data) && list.data.some((r) => r.id === doctorAdminId);
            console.log('GET /doctor-admins:', list.status === 200 && found ? 'OK' : `FAIL (${list.status})`);

            const del = await request('DELETE', `/doctor-admins/${doctorAdminId}`, null, superToken);
            console.log('DELETE /doctor-admins:', del.status === 200 ? 'OK' : `FAIL (${del.status})`);
            doctorAdminId = null;
        }
    } finally {
        if (doctorAdminId) {
            await conn.query('DELETE FROM admins WHERE id = ?', [doctorAdminId]);
            console.log('Cleanup: doctor admin removed.');
        }
        await conn.end();
    }

    console.log('Phase 2 smoke test complete.');
}

main().catch((err) => {
    console.error('Smoke test failed:', err.message);
    process.exit(1);
});
