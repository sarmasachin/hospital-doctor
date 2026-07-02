-- Extend admins table for Hospital Admin & Blood Admin accounts
USE hospital_db;

ALTER TABLE admins
    ADD COLUMN IF NOT EXISTS name VARCHAR(255) DEFAULT NULL AFTER username,
    ADD COLUMN IF NOT EXISTS mobile VARCHAR(20) DEFAULT NULL AFTER hospital_id,
    ADD COLUMN IF NOT EXISTS status ENUM('active', 'inactive') NOT NULL DEFAULT 'active' AFTER mobile;

-- MySQL 8 may not support IF NOT EXISTS on ADD COLUMN — migration script handles this.

ALTER TABLE admins
    MODIFY COLUMN role ENUM('superadmin', 'admin', 'hospital_admin', 'blood_admin') NOT NULL DEFAULT 'hospital_admin';
