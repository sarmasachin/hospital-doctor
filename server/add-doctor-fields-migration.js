/**
 * Run once to add room_no, floor, block, qualification, sub_specialization to doctors table.
 * Pehle check: column pehle se hai to skip.
 * Command: node add-doctor-fields-migration.js
 */
require('dotenv').config();
const mysql = require('mysql2');

const dbName = process.env.DB_NAME || 'hospital_db';
const conn = mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: dbName
});

function run(sql, params = []) {
    return new Promise((resolve, reject) => {
        conn.query(sql, params, (err, res) => {
            if (err) reject(err);
            else resolve(res);
        });
    });
}

async function main() {
    try {
        const cols = await run(
            `SELECT COLUMN_NAME FROM information_schema.COLUMNS 
             WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'doctors'`,
            [dbName]
        );
        const names = (Array.isArray(cols) ? cols : []).map(r => (r.COLUMN_NAME || r.column_name || '').toLowerCase());

        if (!names.includes('room_no')) {
            await run('ALTER TABLE doctors ADD COLUMN room_no VARCHAR(20) DEFAULT NULL');
            console.log('✅ doctors.room_no column add ho gaya.');
        } else {
            console.log('⏭️ doctors.room_no pehle se hai.');
        }

        if (!names.includes('floor')) {
            await run('ALTER TABLE doctors ADD COLUMN floor VARCHAR(20) DEFAULT NULL');
            console.log('✅ doctors.floor column add ho gaya.');
        } else {
            console.log('⏭️ doctors.floor pehle se hai.');
        }

        if (!names.includes('block')) {
            await run('ALTER TABLE doctors ADD COLUMN block VARCHAR(50) DEFAULT NULL');
            console.log('✅ doctors.block column add ho gaya.');
        } else {
            console.log('⏭️ doctors.block pehle se hai.');
        }

        if (!names.includes('qualification')) {
            await run('ALTER TABLE doctors ADD COLUMN qualification VARCHAR(255) DEFAULT NULL');
            console.log('✅ doctors.qualification column add ho gaya.');
        } else {
            console.log('⏭️ doctors.qualification pehle se hai.');
        }

        if (!names.includes('sub_specialization')) {
            await run('ALTER TABLE doctors ADD COLUMN sub_specialization VARCHAR(255) DEFAULT NULL');
            console.log('✅ doctors.sub_specialization column add ho gaya.');
        } else {
            console.log('⏭️ doctors.sub_specialization pehle se hai.');
        }

        console.log('Done. Ab server restart karke doctor card par data dikhega.');
    } catch (e) {
        console.error('Error:', e.message);
        process.exit(1);
    } finally {
        conn.end();
    }
}

main();
