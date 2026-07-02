/**
 * Add card_branding column to hospitals table
 * Run once: node add-card-branding-column.js
 */
require('dotenv').config();
const mysql = require('mysql2');

const connection = mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'hospital_db'
});

connection.query(
    "SELECT COUNT(*) as c FROM information_schema.columns WHERE table_schema = ? AND table_name = 'hospitals' AND column_name = 'card_branding'",
    [process.env.DB_NAME || 'hospital_db'],
    (err, rows) => {
        if (err) {
            console.error('Error:', err.message);
            connection.end();
            process.exit(1);
        }
        if (rows[0].c > 0) {
            console.log('✅ card_branding column already exists');
            connection.end();
            return;
        }
        connection.query(
            "ALTER TABLE hospitals ADD COLUMN card_branding VARCHAR(255) DEFAULT NULL",
            (err2) => {
                if (err2) {
                    console.error('Error:', err2.message);
                    connection.end();
                    process.exit(1);
                }
                console.log('✅ card_branding column added to hospitals table');
                connection.end();
            }
        );
    }
);
