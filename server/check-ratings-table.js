/**
 * Check if hospital_ratings table exists. Duplicate nahi banega.
 * Command: node check-ratings-table.js
 */
require('dotenv').config();
const mysql = require('mysql2');

const connection = mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'hospital_db'
});

// Pehle check: table hai ya nahi
connection.query(
    "SELECT COUNT(*) as c FROM information_schema.tables WHERE table_schema = ? AND table_name = 'hospital_ratings'",
    [process.env.DB_NAME || 'hospital_db'],
    (err, rows) => {
        if (err) {
            console.error('Error:', err.message);
            connection.end();
            process.exit(1);
        }

        const exists = rows[0].c > 0;

        if (exists) {
            // Table pehle se hai - row count dikhao, duplicate mat banao
            connection.query('SELECT COUNT(*) as total FROM hospital_ratings', (err2, countRows) => {
                if (err2) {
                    console.log('✅ hospital_ratings table EXISTS (duplicate nahi banaenge)');
                } else {
                    console.log('✅ hospital_ratings table EXISTS. Total ratings:', countRows[0].total);
                    console.log('   (Duplicate table nahi banaya - safe)');
                }
                connection.end();
            });
        } else {
            console.log('❌ hospital_ratings table NAHI hai.');
            console.log('   Banane ke liye chalao: node create-ratings-table.js');
            connection.end();
        }
    }
);
