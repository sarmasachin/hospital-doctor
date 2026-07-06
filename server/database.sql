-- Hospital Doctor Availability Database
-- Run this in MySQL to create the database and tables

CREATE DATABASE IF NOT EXISTS hospital_db;
USE hospital_db;

-- Hospitals Table
CREATE TABLE IF NOT EXISTS hospitals (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    location VARCHAR(255) NOT NULL,
    city VARCHAR(100) NOT NULL,
    type ENUM('GOV', 'PRIVATE') DEFAULT 'GOV',
    lat DECIMAL(10, 6) DEFAULT NULL,
    lng DECIMAL(10, 6) DEFAULT NULL,
    total_doctors INT DEFAULT 0,
    departments INT DEFAULT 10,
    card_branding VARCHAR(255) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Doctors Table
CREATE TABLE IF NOT EXISTS doctors (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    specialty VARCHAR(255) NOT NULL,
    status ENUM('available', 'busy', 'leave') DEFAULT 'available',
    experience VARCHAR(50),
    timing VARCHAR(100),
    fees VARCHAR(50),
    opd_days VARCHAR(100) DEFAULT 'Mon,Tue,Wed,Thu,Fri,Sat',
    room_no VARCHAR(20) DEFAULT NULL,
    floor VARCHAR(20) DEFAULT NULL,
    block VARCHAR(50) DEFAULT NULL,
    qualification VARCHAR(255) DEFAULT NULL,
    sub_specialization VARCHAR(255) DEFAULT NULL,
    hospital_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE CASCADE
);

-- Doctor Feedback (user thumbs up/down – used to auto-update status if hospital doesn't)
CREATE TABLE IF NOT EXISTS doctor_feedback (
    id INT AUTO_INCREMENT PRIMARY KEY,
    doctor_id INT NOT NULL,
    feedback_type ENUM('up', 'down') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE,
    INDEX idx_doctor_created (doctor_id, created_at)
);

-- Blood Requests Table
CREATE TABLE IF NOT EXISTS blood_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    blood_type VARCHAR(10) NOT NULL,
    hospital_id INT NOT NULL,
    message TEXT,
    urgent BOOLEAN DEFAULT TRUE,
    patient_name VARCHAR(255),
    contact VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL 24 HOUR),
    FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE CASCADE
);

-- Admin Table
CREATE TABLE IF NOT EXISTS admins (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(255) DEFAULT NULL,
    password VARCHAR(255) NOT NULL,
    role ENUM('superadmin', 'admin', 'hospital_admin', 'blood_admin', 'doctor_admin') NOT NULL DEFAULT 'hospital_admin',
    hospital_id INT DEFAULT NULL,
    doctor_id INT DEFAULT NULL,
    mobile VARCHAR(20) DEFAULT NULL,
    status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE SET NULL,
    FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE SET NULL
);

-- Hospital Ratings (users can rate 1-5 stars)
CREATE TABLE IF NOT EXISTS hospital_ratings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    hospital_id INT NOT NULL,
    rating TINYINT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE CASCADE
);

-- Cities (for "Search by City" buttons on website - admin can add/update/delete)
CREATE TABLE IF NOT EXISTS cities (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    name_en VARCHAR(255) DEFAULT NULL,
    value VARCHAR(100) NOT NULL,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY (value)
);

-- Contact form messages (public site → admin panel)
CREATE TABLE IF NOT EXISTS contact_messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    mobile VARCHAR(20) NOT NULL,
    email VARCHAR(255) NOT NULL,
    subject VARCHAR(50) NOT NULL,
    subject_text VARCHAR(255) DEFAULT NULL,
    message TEXT NOT NULL,
    status ENUM('pending', 'replied') NOT NULL DEFAULT 'pending',
    reply TEXT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    replied_at TIMESTAMP NULL DEFAULT NULL,
    INDEX idx_status_created (status, created_at)
);

-- Production: no sample hospitals/doctors/blood/cities here.
-- Add real data via Admin panel after deploy.
-- Super admin: cd server && node setup-security.js

-- Optional: remove old sample rows on an existing DB (run once manually):
--   mysql -u livehospital_user -p hospital_db < server/clear-sample-data.sql
