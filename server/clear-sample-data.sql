-- Run once on live server to remove sample/demo rows (keeps admin accounts).
-- mysql -u livehospital_user -p hospital_db < server/clear-sample-data.sql

USE hospital_db;

SET FOREIGN_KEY_CHECKS = 0;

TRUNCATE TABLE doctor_feedback;
TRUNCATE TABLE hospital_ratings;
TRUNCATE TABLE blood_requests;
TRUNCATE TABLE doctors;
TRUNCATE TABLE hospitals;
TRUNCATE TABLE cities;

SET FOREIGN_KEY_CHECKS = 1;

SELECT 'Hospitals' AS cleared, COUNT(*) AS remaining FROM hospitals
UNION ALL SELECT 'Doctors', COUNT(*) FROM doctors
UNION ALL SELECT 'Blood requests', COUNT(*) FROM blood_requests
UNION ALL SELECT 'Cities', COUNT(*) FROM cities;
