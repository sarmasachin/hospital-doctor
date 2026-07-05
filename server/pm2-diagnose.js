#!/usr/bin/env node
/**
 * Run on VPS: node server/pm2-diagnose.js
 * Checks env, MySQL, port — common PM2 crash-loop causes.
 */
const path = require('path');
const net = require('net');
const mysql = require('mysql2');
const { loadServerEnv } = require('./load-env');

const serverDir = __dirname;
const loaded = loadServerEnv(serverDir);
Object.assign(process.env, loaded.env || {});

const PORT = parseInt(process.env.PORT || '5006', 10);

function line(label, value, ok) {
    const mark = ok ? 'OK' : 'FAIL';
    console.log(`[${mark}] ${label}: ${value}`);
}

console.log('=== LiveHospital PM2 / Node diagnose ===\n');

line('.env path', loaded.path, true);
line('.env exists', String(loaded.exists), loaded.exists);
line('DB_USER', process.env.DB_USER ? process.env.DB_USER : '(empty)', !!process.env.DB_USER);
line('DB_NAME', process.env.DB_NAME ? process.env.DB_NAME : '(empty)', !!process.env.DB_NAME);
line('DB_HOST', process.env.DB_HOST || '(empty)', !!process.env.DB_HOST);
line('JWT_SECRET', process.env.JWT_SECRET ? '(set)' : '(empty)', !!process.env.JWT_SECRET);
line('PORT', String(PORT), PORT > 0);

if (!loaded.exists || !process.env.DB_USER) {
    console.log('\nFix: nano server/.env — each variable on its OWN line (not one long line).');
    console.log('Then: pm2 delete livehospital && pm2 start deploy/ecosystem.config.js --env production');
    process.exit(1);
}

function checkPort(cb) {
    const srv = net.createServer();
    srv.once('error', (err) => cb(err));
    srv.once('listening', () => srv.close(() => cb(null)));
    srv.listen(PORT, '127.0.0.1');
}

checkPort((portErr) => {
    if (portErr && portErr.code === 'EADDRINUSE') {
        line(`Port ${PORT} free`, 'IN USE — another process or duplicate PM2 instance', false);
        console.log('\nFix: pm2 list  →  pm2 delete livehospital  →  pm2 start deploy/ecosystem.config.js --env production');
    } else if (portErr) {
        line(`Port ${PORT}`, portErr.message, false);
    } else {
        line(`Port ${PORT} free`, 'available for bind', true);
    }

    const db = mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    db.connect((err) => {
        if (err) {
            line('MySQL connect', err.message, false);
            console.log('\nFix: mysql -u livehospital_user -p hospital_db  →  reset password to match .env');
            process.exit(1);
        }
        line('MySQL connect', 'success', true);
        db.query('SELECT 1 AS ok', (qErr, rows) => {
            db.end();
            if (qErr) {
                line('MySQL query', qErr.message, false);
                process.exit(1);
            }
            line('MySQL query', `ok=${rows[0].ok}`, true);
            console.log('\nAll checks passed. If PM2 still restarts, run: pm2 logs livehospital --lines 100');
            process.exit(0);
        });
    });
});
