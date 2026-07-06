/**
 * Migrate admins table: add name, mobile, status; extend role enum.
 */
require('dotenv').config();
const mysql = require('mysql2/promise');

async function columnExists(conn, table, column) {
    const [rows] = await conn.query(
        `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
        [table, column]
    );
    return rows[0].c > 0;
}

async function main() {
    const conn = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'hospital_db'
    });

    console.log('Migrating admins table...');

    if (!(await columnExists(conn, 'admins', 'name'))) {
        await conn.query('ALTER TABLE admins ADD COLUMN name VARCHAR(255) DEFAULT NULL AFTER username');
        console.log('Added column: name');
    }
    if (!(await columnExists(conn, 'admins', 'mobile'))) {
        await conn.query('ALTER TABLE admins ADD COLUMN mobile VARCHAR(20) DEFAULT NULL AFTER hospital_id');
        console.log('Added column: mobile');
    }
    if (!(await columnExists(conn, 'admins', 'status'))) {
        await conn.query("ALTER TABLE admins ADD COLUMN status ENUM('active', 'inactive') NOT NULL DEFAULT 'active' AFTER mobile");
        console.log('Added column: status');
    }

    await conn.query(
        "ALTER TABLE admins MODIFY COLUMN role ENUM('superadmin', 'admin', 'hospital_admin', 'blood_admin', 'doctor_admin') NOT NULL DEFAULT 'hospital_admin'"
    );
    console.log('Updated role enum');

    await conn.end();
    console.log('Admin roles migration complete.');
}

main().catch((err) => {
    console.error('Migration failed:', err.message);
    process.exit(1);
});
