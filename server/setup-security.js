/**
 * One-time security setup:
 * - Hash any plain-text admin passwords
 * - Set superadmin: sharma.sachinctr@gmail.com / comingsoon@123
 */
require('dotenv').config();
const mysql = require('mysql2/promise');
const { hashPassword } = require('./auth');

const SUPERADMIN_USERNAME = 'sharma.sachinctr@gmail.com';
const SUPERADMIN_PASSWORD = 'comingsoon@123';

async function main() {
    const conn = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'hospital_db'
    });

    console.log('Connected to MySQL');

    const [admins] = await conn.query('SELECT id, username, password FROM admins');
    for (const admin of admins) {
        if (admin.password && !admin.password.startsWith('$2')) {
            const hashed = hashPassword(admin.password);
            await conn.query('UPDATE admins SET password = ? WHERE id = ?', [hashed, admin.id]);
            console.log(`Hashed password for: ${admin.username}`);
        }
    }

    const [existing] = await conn.query('SELECT id FROM admins WHERE username = ?', [SUPERADMIN_USERNAME]);
    const hashedPwd = hashPassword(SUPERADMIN_PASSWORD);

    if (existing.length > 0) {
        await conn.query(
            'UPDATE admins SET password = ?, role = ? WHERE username = ?',
            [hashedPwd, 'superadmin', SUPERADMIN_USERNAME]
        );
        console.log(`Updated superadmin: ${SUPERADMIN_USERNAME}`);
    } else {
        await conn.query(
            'INSERT INTO admins (username, password, role) VALUES (?, ?, ?)',
            [SUPERADMIN_USERNAME, hashedPwd, 'superadmin']
        );
        console.log(`Created superadmin: ${SUPERADMIN_USERNAME}`);
    }

    await conn.query('DELETE FROM admins WHERE username = ? AND username != ?', ['admin', SUPERADMIN_USERNAME]);
    console.log('Removed default admin account (if existed)');

    await conn.end();
    console.log('Security setup complete.');
}

main().catch((err) => {
    console.error('Setup failed:', err.message);
    process.exit(1);
});
