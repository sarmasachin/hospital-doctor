/**
 * Run this once to create hospital_ratings table (no phpMyAdmin needed)
 * Duplicate nahi banega - pehle check karta hai.
 * Command: node create-ratings-table.js
 */
require('dotenv').config();
const mysql = require('mysql2');

const connection = mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'hospital_db'
});

const createSQL = `
CREATE TABLE IF NOT EXISTS hospital_ratings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    hospital_id INT NOT NULL,
    rating TINYINT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE CASCADE
);
`;

// Pehle check: table pehle se hai to duplicate mat banao
connection.query(
    "SELECT COUNT(*) as c FROM information_schema.tables WHERE table_schema = ? AND table_name = 'hospital_ratings'",
    [process.env.DB_NAME || 'hospital_db'],
    (err, rows) => {
        if (err) {
            console.error('Error:', err.message);
            connection.end();
            process.exit(1);
        }

        if (rows[0].c > 0) {
            console.log('✅ hospital_ratings table pehle se hai - duplicate NAHI banaya.');
            connection.end();
            return;
        }

        // Table nahi hai - ab banao
        connection.query(createSQL, (err2) => {
            if (err2) {
                console.error('Error:', err2.message);
                connection.end();
                process.exit(1);
            }
            console.log('✅ hospital_ratings table create ho gaya!');
            connection.end();
        });
    }
);
