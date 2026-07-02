/**
 * Run once to create doctor_feedback table (for user thumbs up/down).
 * Command: node create-doctor-feedback-table.js
 */
require('dotenv').config();
const mysql = require('mysql2');

const conn = mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'hospital_db'
});

const sql = `
CREATE TABLE IF NOT EXISTS doctor_feedback (
    id INT AUTO_INCREMENT PRIMARY KEY,
    doctor_id INT NOT NULL,
    feedback_type ENUM('up', 'down') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE,
    INDEX idx_doctor_created (doctor_id, created_at)
);
`;

conn.query(sql, (err) => {
    if (err) {
        console.error('Error:', err.message);
        process.exit(1);
    }
    console.log('✅ doctor_feedback table ready.');
    conn.end();
});
