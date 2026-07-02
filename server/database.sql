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
    role ENUM('superadmin', 'admin', 'hospital_admin', 'blood_admin') NOT NULL DEFAULT 'hospital_admin',
    hospital_id INT DEFAULT NULL,
    mobile VARCHAR(20) DEFAULT NULL,
    status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE SET NULL
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

INSERT INTO cities (name, name_en, value, sort_order) VALUES
('दिल्ली', 'Delhi', 'delhi', 0),
('मुंबई', 'Mumbai', 'mumbai', 1),
('लखनऊ', 'Lucknow', 'lucknow', 2),
('जयपुर', 'Jaipur', 'jaipur', 3),
('मोहाली', 'Mohali', 'mohali', 4),
('गुड़गांव', 'Gurugram', 'gurugram', 5);

-- Insert Sample Hospitals (with lat/lng)
INSERT INTO hospitals (name, location, city, type, lat, lng, total_doctors, departments) VALUES
('AIIMS दिल्ली', 'दिल्ली', 'delhi', 'GOV', 28.5672, 77.2100, 25, 15),
('फोर्टिस अस्पताल', 'मोहाली', 'delhi', 'GOV', 30.7046, 76.7179, 18, 18),
('मेदांता हॉस्पिटल', 'गुड़गांव', 'delhi', 'PRIVATE', 28.4395, 77.0266, 45, 22),
('लीलावती हॉस्पिटल', 'मुंबई', 'mumbai', 'PRIVATE', 19.0596, 72.8295, 35, 20),
('किंग जॉर्ज मेडिकल यूनिवर्सिटी', 'लखनऊ', 'lucknow', 'GOV', 26.8564, 80.9160, 40, 25),
('SMS हॉस्पिटल', 'जयपुर', 'jaipur', 'GOV', 26.9124, 75.7873, 50, 28);

-- Insert Sample Doctors
INSERT INTO doctors (name, specialty, status, experience, timing, fees, hospital_id) VALUES
-- AIIMS Delhi (hospital_id = 1)
('डॉ. राजेश शर्मा', 'कार्डियोलॉजी', 'available', '15 वर्ष', '9:00 AM - 5:00 PM', '₹500', 1),
('डॉ. प्रिया सिंह', 'न्यूरोलॉजी', 'busy', '12 वर्ष', '10:00 AM - 6:00 PM', '₹600', 1),
('डॉ. अमित वर्मा', 'ऑर्थोपेडिक', 'available', '10 वर्ष', '8:00 AM - 4:00 PM', '₹450', 1),
('डॉ. सुनीता गुप्ता', 'गायनेकोलॉजी', 'leave', '18 वर्ष', '11:00 AM - 7:00 PM', '₹550', 1),
('डॉ. विकास यादव', 'पीडियाट्रिक्स', 'available', '8 वर्ष', '9:00 AM - 3:00 PM', '₹400', 1),

-- Fortis Hospital (hospital_id = 2)
('डॉ. संजय मेहता', 'कार्डियोलॉजी', 'available', '20 वर्ष', '10:00 AM - 6:00 PM', '₹800', 2),
('डॉ. नेहा कपूर', 'डर्मेटोलॉजी', 'available', '9 वर्ष', '9:00 AM - 5:00 PM', '₹700', 2),
('डॉ. रोहित अग्रवाल', 'ऑन्कोलॉजी', 'busy', '14 वर्ष', '8:00 AM - 4:00 PM', '₹900', 2),
('डॉ. आशा पटेल', 'एंडोक्रिनोलॉजी', 'available', '11 वर्ष', '11:00 AM - 7:00 PM', '₹650', 2),
('डॉ. विजय कुमार', 'जनरल मेडिसिन', 'available', '15 वर्ष', '9:00 AM - 5:00 PM', '₹400', 2),
('डॉ. अंजली शर्मा', 'पीडियाट्रिक्स', 'available', '12 वर्ष', '10:00 AM - 6:00 PM', '₹450', 2),
('डॉ. राकेश गुप्ता', 'ऑर्थोपेडिक', 'available', '18 वर्ष', '8:00 AM - 4:00 PM', '₹600', 2),
('डॉ. सोनाली वर्मा', 'गायनेकोलॉजी', 'available', '10 वर्ष', '11:00 AM - 7:00 PM', '₹550', 2),
('डॉ. अमन सिंह', 'न्यूरोलॉजी', 'available', '14 वर्ष', '9:00 AM - 5:00 PM', '₹700', 2),
('डॉ. प्रीति जैन', 'डर्मेटोलॉजी', 'available', '8 वर्ष', '10:00 AM - 6:00 PM', '₹500', 2),
('डॉ. संदीप राणा', 'कार्डियोलॉजी', 'available', '20 वर्ष', '8:00 AM - 4:00 PM', '₹850', 2),
('डॉ. नीलम शर्मा', 'जनरल मेडिसिन', 'available', '16 वर्ष', '11:00 AM - 7:00 PM', '₹400', 2),
('डॉ. हरीश चंद्र', 'सर्जरी', 'busy', '22 वर्ष', '9:00 AM - 5:00 PM', '₹900', 2),
('डॉ. मीनाक्षी देवी', 'ऑप्थल्मोलॉजी', 'busy', '11 वर्ष', '10:00 AM - 6:00 PM', '₹550', 2),
('डॉ. राजीव मल्होत्रा', 'ENT', 'busy', '13 वर्ष', '8:00 AM - 4:00 PM', '₹500', 2),
('डॉ. सरिता यादव', 'पीडियाट्रिक्स', 'leave', '9 वर्ष', '11:00 AM - 7:00 PM', '₹450', 2),
('डॉ. अशोक तिवारी', 'ऑर्थोपेडिक', 'leave', '17 वर्ष', '9:00 AM - 5:00 PM', '₹650', 2),

-- Medanta Hospital (hospital_id = 3)
('डॉ. नरेश त्रेहान', 'कार्डियक सर्जरी', 'busy', '30 वर्ष', '9:00 AM - 5:00 PM', '₹2000', 3),
('डॉ. अनुपम वर्मा', 'न्यूरोसर्जरी', 'available', '22 वर्ष', '10:00 AM - 6:00 PM', '₹1500', 3),
('डॉ. कविता शर्मा', 'नेफ्रोलॉजी', 'available', '16 वर्ष', '8:00 AM - 4:00 PM', '₹1000', 3),
('डॉ. मनीष जैन', 'गैस्ट्रोएंटरोलॉजी', 'leave', '13 वर्ष', '11:00 AM - 7:00 PM', '₹850', 3),

-- Lilavati Hospital (hospital_id = 4)
('डॉ. राकेश सिन्हा', 'कार्डियोलॉजी', 'available', '18 वर्ष', '9:00 AM - 5:00 PM', '₹900', 4),
('डॉ. स्मिता देशमुख', 'गायनेकोलॉजी', 'available', '14 वर्ष', '10:00 AM - 6:00 PM', '₹750', 4),
('डॉ. अजय पाटिल', 'ऑर्थोपेडिक', 'busy', '12 वर्ष', '8:00 AM - 4:00 PM', '₹650', 4),
('डॉ. पूजा शाह', 'डर्मेटोलॉजी', 'available', '7 वर्ष', '11:00 AM - 7:00 PM', '₹600', 4),

-- KGMU (hospital_id = 5)
('डॉ. आलोक मिश्रा', 'जनरल मेडिसिन', 'available', '25 वर्ष', '9:00 AM - 5:00 PM', '₹300', 5),
('डॉ. सपना त्रिपाठी', 'पीडियाट्रिक्स', 'leave', '15 वर्ष', '10:00 AM - 6:00 PM', '₹350', 5),
('डॉ. विनोद पांडेय', 'सर्जरी', 'available', '20 वर्ष', '8:00 AM - 4:00 PM', '₹400', 5),
('डॉ. रीना सिंह', 'ऑप्थल्मोलॉजी', 'busy', '10 वर्ष', '11:00 AM - 7:00 PM', '₹450', 5),

-- SMS Hospital (hospital_id = 6)
('डॉ. महेश चौधरी', 'कार्डियोलॉजी', 'available', '22 वर्ष', '9:00 AM - 5:00 PM', '₹350', 6),
('डॉ. गीता शर्मा', 'गायनेकोलॉजी', 'available', '17 वर्ष', '10:00 AM - 6:00 PM', '₹400', 6),
('डॉ. सुरेश मेहरा', 'ऑर्थोपेडिक', 'busy', '14 वर्ष', '8:00 AM - 4:00 PM', '₹380', 6),
('डॉ. अनीता राठौर', 'पीडियाट्रिक्स', 'leave', '9 वर्ष', '11:00 AM - 7:00 PM', '₹320', 6);

-- Insert Sample Blood Requests
INSERT INTO blood_requests (blood_type, hospital_id, message, urgent, patient_name, contact) VALUES
('O+', 1, 'Urgent जरूरत है - कृपया तुरंत संपर्क करें', TRUE, 'राम कुमार', '9876543210'),
('A+', 1, 'सर्जरी के लिए खून की जरूरत है', TRUE, 'सीता देवी', '9876543211'),
('B-', 2, 'एक्सीडेंट केस - तुरंत संपर्क करें', TRUE, 'मोहन लाल', '9876543212'),
('AB+', 3, 'प्लेटलेट्स की जरूरत है', FALSE, 'गीता शर्मा', '9876543213'),
('O-', 4, 'इमरजेंसी - खून की जरूरत', TRUE, 'विकास जैन', '9876543214'),
('A-', 5, 'ऑपरेशन के लिए खून चाहिए', TRUE, 'अनिल वर्मा', '9876543215'),
('B+', 6, 'मरीज को खून की जरूरत है', TRUE, 'सुनील यादव', '9876543216');

-- Insert Default Super Admin (run setup-security.js to hash password)
INSERT INTO admins (username, password, role) VALUES
('sharma.sachinctr@gmail.com', 'comingsoon@123', 'superadmin');

-- Verify data
SELECT 'Hospitals Count:' as Info, COUNT(*) as Count FROM hospitals;
SELECT 'Doctors Count:' as Info, COUNT(*) as Count FROM doctors;
SELECT 'Blood Requests:' as Info, COUNT(*) as Count FROM blood_requests;
SELECT 'Available Doctors:' as Info, COUNT(*) as Count FROM doctors WHERE status = 'available';
SELECT 'Busy Doctors:' as Info, COUNT(*) as Count FROM doctors WHERE status = 'busy';
SELECT 'On Leave Doctors:' as Info, COUNT(*) as Count FROM doctors WHERE status = 'leave';
