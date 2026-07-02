-- Add qualification and sub_specialization to doctors (run once on existing DB)
USE hospital_db;
ALTER TABLE doctors ADD COLUMN qualification VARCHAR(255) DEFAULT NULL AFTER block;
ALTER TABLE doctors ADD COLUMN sub_specialization VARCHAR(255) DEFAULT NULL AFTER qualification;
