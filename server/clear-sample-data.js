#!/usr/bin/env node
/**
 * Remove all demo hospitals, doctors, blood requests, cities from MySQL.
 * Keeps admin accounts. Run once on live server:
 *   cd server && node clear-sample-data.js
 */
const mysql = require('mysql2/promise');
const path = require('path');
const { loadServerEnv } = require('./load-env');

const DEMO_TABLES = [
    'doctor_feedback',
    'hospital_ratings',
    'blood_requests',
    'doctors',
    'hospitals',
    'cities'
];

async function main() {
    const envLoad = loadServerEnv(__dirname);
    if (!envLoad.exists || !process.env.DB_USER) {
        console.error('Missing server/.env — set DB_HOST, DB_USER, DB_PASSWORD, DB_NAME');
        process.exit(1);
    }

    const conn = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    console.log('Connected to', process.env.DB_NAME);

    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    for (const table of DEMO_TABLES) {
        await conn.query(`TRUNCATE TABLE \`${table}\``);
        console.log('Cleared:', table);
    }
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');

    const counts = {};
    for (const table of DEMO_TABLES) {
        const [rows] = await conn.query(`SELECT COUNT(*) AS c FROM \`${table}\``);
        counts[table] = rows[0].c;
    }
    const [adminRows] = await conn.query('SELECT COUNT(*) AS c FROM admins');
    counts.admins_kept = adminRows[0].c;

    await conn.end();

    console.log('\nDone. Remaining rows:');
    Object.entries(counts).forEach(([k, v]) => console.log(`  ${k}: ${v}`));
}

main().catch((err) => {
    console.error('Failed:', err.message || err);
    process.exit(1);
});
