/**
 * Quick Phase 1 smoke test (optional): node test-doctor-admin-phase1.js
 * Creates a temporary doctor admin, tests email/mobile login, then removes test account.
 */
require('dotenv').config();
const mysql = require('mysql2/promise');
const { findAdminForLogin, validateDoctorAdminAccount, signToken, hashPassword } = require('./auth');

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

    const [cols] = await conn.query("SHOW COLUMNS FROM admins WHERE Field = 'doctor_id'");
    const [roleCol] = await conn.query("SHOW COLUMNS FROM admins WHERE Field = 'role'");
    console.log('Schema doctor_id:', cols[0] ? 'OK' : 'MISSING');
    console.log('Schema role enum includes doctor_admin:', roleCol[0] && String(roleCol[0].Type).includes('doctor_admin') ? 'OK' : 'MISSING');

    const doctors = await dbQuery('SELECT id, hospital_id FROM doctors ORDER BY id ASC LIMIT 1');
    if (!doctors.length) {
        console.log('No doctors in DB — skip login smoke test (schema OK).');
        await conn.end();
        return;
    }
    const doctorId = doctors[0].id;
    const hospitalId = doctors[0].hospital_id;
    const testEmail = `phase1.doctor.test.${Date.now()}@example.com`;
    const testMobile = '9' + String(Date.now()).slice(-9);
    const testPassword = 'Test@12345';

    const insert = await conn.query(
        `INSERT INTO admins (username, name, password, role, hospital_id, doctor_id, mobile, status)
         VALUES (?, ?, ?, 'doctor_admin', ?, ?, ?, 'active')`,
        [testEmail, 'Phase1 Test Doctor', hashPassword(testPassword), hospitalId, doctorId, testMobile]
    );
    const adminId = insert[0].insertId;

    const byEmail = await findAdminForLogin(dbQuery, testEmail);
    const byMobile = await findAdminForLogin(dbQuery, testMobile);
    const byMobile91 = await findAdminForLogin(dbQuery, '+91' + testMobile);
    const validation = await validateDoctorAdminAccount(dbQuery, byEmail);
    const token = signToken(byEmail);

    console.log('Login by email:', byEmail && byEmail.role === 'doctor_admin' ? 'OK' : 'FAIL');
    console.log('Login by mobile:', byMobile && byMobile.id === adminId ? 'OK' : 'FAIL');
    console.log('Login by +91 mobile:', byMobile91 && byMobile91.id === adminId ? 'OK' : 'FAIL');
    console.log('Doctor validation:', validation.ok ? 'OK' : 'FAIL');
    console.log('JWT has doctor_id:', token && token.length > 20 ? 'OK' : 'FAIL');

    await conn.query('DELETE FROM admins WHERE id = ?', [adminId]);
    console.log('Cleanup: test admin removed.');
    await conn.end();
    console.log('Phase 1 smoke test complete.');
}

main().catch((err) => {
    console.error('Smoke test failed:', err.message);
    process.exit(1);
});
