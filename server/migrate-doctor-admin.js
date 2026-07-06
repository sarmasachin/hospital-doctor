/**
 * Doctor admin foundation: doctor_id column + doctor_admin role.
 * Run once on existing DB: node migrate-doctor-admin.js
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

async function foreignKeyExists(conn, table, column, referencedTable) {
    const [rows] = await conn.query(
        `SELECT COUNT(*) AS c FROM information_schema.KEY_COLUMN_USAGE
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?
           AND REFERENCED_TABLE_NAME = ?`,
        [table, column, referencedTable]
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

    console.log('Migrating doctor admin support on admins table...');

    if (!(await columnExists(conn, 'admins', 'doctor_id'))) {
        await conn.query('ALTER TABLE admins ADD COLUMN doctor_id INT DEFAULT NULL AFTER hospital_id');
        console.log('Added column: doctor_id');
    } else {
        console.log('Column doctor_id already exists');
    }

    if (!(await foreignKeyExists(conn, 'admins', 'doctor_id', 'doctors'))) {
        await conn.query(
            'ALTER TABLE admins ADD CONSTRAINT fk_admins_doctor_id FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE SET NULL'
        );
        console.log('Added foreign key: fk_admins_doctor_id');
    } else {
        console.log('Foreign key fk_admins_doctor_id already exists');
    }

    await conn.query(
        "ALTER TABLE admins MODIFY COLUMN role ENUM('superadmin', 'admin', 'hospital_admin', 'blood_admin', 'doctor_admin') NOT NULL DEFAULT 'hospital_admin'"
    );
    console.log('Updated role enum (includes doctor_admin)');

    await conn.end();
    console.log('Doctor admin migration complete.');
}

main().catch((err) => {
    console.error('Migration failed:', err.message);
    process.exit(1);
});
