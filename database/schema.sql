-- ============================================================
-- SMART ATTENDANCE MANAGEMENT SYSTEM - DATABASE SCHEMA
-- ============================================================

CREATE DATABASE IF NOT EXISTS smart_attendance_db;
USE smart_attendance_db;

-- ============================================================
-- 1. DEPARTMENTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS departments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(20) NOT NULL UNIQUE,
    description TEXT,
    hod_name VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ============================================================
-- 2. SEMESTERS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS semesters (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    semester_number INT NOT NULL,
    academic_year VARCHAR(20) NOT NULL,
    start_date DATE,
    end_date DATE,
    is_active BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 3. USERS TABLE (Admin, Faculty, Students)
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role ENUM('admin', 'faculty', 'student') NOT NULL,
    phone VARCHAR(15),
    profile_image VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ============================================================
-- 4. FACULTY TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS faculty (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    faculty_id VARCHAR(20) NOT NULL UNIQUE,
    department_id INT NOT NULL,
    designation VARCHAR(100),
    qualification VARCHAR(100),
    experience_years INT DEFAULT 0,
    joining_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (department_id) REFERENCES departments(id)
);

-- ============================================================
-- 5. STUDENTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS students (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    roll_number VARCHAR(20) NOT NULL UNIQUE,
    department_id INT NOT NULL,
    semester_id INT NOT NULL,
    batch_year VARCHAR(10),
    section VARCHAR(10),
    dob DATE,
    gender ENUM('Male', 'Female', 'Other'),
    address TEXT,
    guardian_name VARCHAR(100),
    guardian_phone VARCHAR(15),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (department_id) REFERENCES departments(id),
    FOREIGN KEY (semester_id) REFERENCES semesters(id)
);

-- ============================================================
-- 6. SUBJECTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS subjects (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    code VARCHAR(20) NOT NULL UNIQUE,
    department_id INT NOT NULL,
    semester_id INT NOT NULL,
    credits INT DEFAULT 3,
    subject_type ENUM('theory', 'lab', 'elective') DEFAULT 'theory',
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (department_id) REFERENCES departments(id),
    FOREIGN KEY (semester_id) REFERENCES semesters(id)
);

-- ============================================================
-- 7. FACULTY-SUBJECT ASSIGNMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS faculty_subjects (
    id INT AUTO_INCREMENT PRIMARY KEY,
    faculty_id INT NOT NULL,
    subject_id INT NOT NULL,
    semester_id INT NOT NULL,
    academic_year VARCHAR(20),
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (faculty_id) REFERENCES faculty(id) ON DELETE CASCADE,
    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
    FOREIGN KEY (semester_id) REFERENCES semesters(id),
    UNIQUE KEY unique_assignment (faculty_id, subject_id, semester_id)
);

-- ============================================================
-- 8. STUDENT-SUBJECT ENROLLMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS student_enrollments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    subject_id INT NOT NULL,
    semester_id INT NOT NULL,
    enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
    FOREIGN KEY (semester_id) REFERENCES semesters(id),
    UNIQUE KEY unique_enrollment (student_id, subject_id, semester_id)
);

-- ============================================================
-- 9. CLASS SESSIONS TABLE (Hour-wise)
-- ============================================================
CREATE TABLE IF NOT EXISTS class_sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    faculty_subject_id INT NOT NULL,
    session_date DATE NOT NULL,
    hour_number INT NOT NULL COMMENT 'e.g., 1st hour, 2nd hour',
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    otp_code VARCHAR(10),
    otp_expires_at TIMESTAMP NULL,
    qr_code_data TEXT,
    qr_token VARCHAR(255) UNIQUE,
    status ENUM('scheduled', 'active', 'completed', 'cancelled') DEFAULT 'scheduled',
    room_number VARCHAR(20),
    latitude DECIMAL(10, 8) NULL COMMENT 'For location verification',
    longitude DECIMAL(11, 8) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (faculty_subject_id) REFERENCES faculty_subjects(id) ON DELETE CASCADE
);

-- ============================================================
-- 10. ATTENDANCE RECORDS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS attendance_records (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_id INT NOT NULL,
    student_id INT NOT NULL,
    status ENUM('present', 'absent', 'late', 'excused') DEFAULT 'absent',
    marked_at TIMESTAMP NULL,
    marked_by ENUM('student', 'faculty', 'system') DEFAULT 'student',
    otp_used VARCHAR(10),
    device_fingerprint VARCHAR(255),
    ip_address VARCHAR(45),
    latitude DECIMAL(10, 8) NULL,
    longitude DECIMAL(11, 8) NULL,
    verification_method ENUM('otp', 'qr', 'manual') DEFAULT 'otp',
    remarks TEXT,
    edited_at TIMESTAMP NULL,
    edited_by INT NULL,
    FOREIGN KEY (session_id) REFERENCES class_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    UNIQUE KEY unique_attendance (session_id, student_id)
);

-- ============================================================
-- 11. NOTIFICATIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    type ENUM('shortage_alert', 'session_start', 'report_ready', 'general', 'warning') DEFAULT 'general',
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ============================================================
-- 12. TIMETABLE TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS timetable (
    id INT AUTO_INCREMENT PRIMARY KEY,
    faculty_subject_id INT NOT NULL,
    day_of_week ENUM('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday') NOT NULL,
    hour_number INT NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    room_number VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (faculty_subject_id) REFERENCES faculty_subjects(id) ON DELETE CASCADE
);

-- ============================================================
-- 13. AUDIT LOGS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    action VARCHAR(100) NOT NULL,
    table_name VARCHAR(50),
    record_id INT,
    old_values JSON,
    new_values JSON,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================
CREATE INDEX idx_attendance_session ON attendance_records(session_id);
CREATE INDEX idx_attendance_student ON attendance_records(student_id);
CREATE INDEX idx_sessions_date ON class_sessions(session_date);
CREATE INDEX idx_sessions_status ON class_sessions(status);
CREATE INDEX idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX idx_students_dept ON students(department_id, semester_id);

-- ============================================================
-- SEED DATA - ADMIN USER
-- ============================================================
INSERT INTO users (name, email, password, role) VALUES
('System Admin', 'admin@smartattend.edu', '$2b$10$rOzJqMpfScC7jCpXjyOmbuqR6ZNx8mCK3y/jY.7hX8nH5Jv7Vkrhy', 'admin');
-- Default password: Admin@123

-- ============================================================
-- SEED DATA - DEPARTMENTS
-- ============================================================
INSERT INTO departments (name, code, description, hod_name) VALUES
('Computer Science and Engineering', 'CSE', 'Department of Computer Science', 'Dr. R. Sharma'),
('Electronics and Communication Engineering', 'ECE', 'Department of Electronics', 'Dr. M. Patel'),
('Mechanical Engineering', 'MECH', 'Department of Mechanical Engineering', 'Dr. K. Rao'),
('Civil Engineering', 'CIVIL', 'Department of Civil Engineering', 'Dr. S. Kumar'),
('Information Technology', 'IT', 'Department of Information Technology', 'Dr. P. Reddy');

-- ============================================================
-- SEED DATA - SEMESTERS
-- ============================================================
INSERT INTO semesters (name, semester_number, academic_year, start_date, end_date, is_active) VALUES
('Semester 1', 1, '2025-2026', '2025-07-01', '2025-11-30', FALSE),
('Semester 2', 2, '2025-2026', '2026-01-01', '2026-05-31', FALSE),
('Semester 3', 3, '2025-2026', '2025-07-01', '2025-11-30', TRUE),
('Semester 4', 4, '2025-2026', '2026-01-01', '2026-05-31', FALSE),
('Semester 5', 5, '2025-2026', '2025-07-01', '2025-11-30', FALSE),
('Semester 6', 6, '2025-2026', '2026-01-01', '2026-05-31', FALSE),
('Semester 7', 7, '2025-2026', '2025-07-01', '2025-11-30', FALSE),
('Semester 8', 8, '2025-2026', '2026-01-01', '2026-05-31', FALSE);

-- ============================================================
-- STORED PROCEDURE: Calculate Attendance Percentage
-- ============================================================
DELIMITER //
CREATE PROCEDURE GetAttendancePercentage(IN p_student_id INT, IN p_subject_id INT)
BEGIN
    SELECT 
        s.name AS subject_name,
        COUNT(DISTINCT cs.id) AS total_sessions,
        COUNT(DISTINCT CASE WHEN ar.status = 'present' THEN ar.id END) AS attended_sessions,
        ROUND(
            (COUNT(DISTINCT CASE WHEN ar.status = 'present' THEN ar.id END) / 
            NULLIF(COUNT(DISTINCT cs.id), 0)) * 100, 2
        ) AS attendance_percentage
    FROM subjects s
    JOIN faculty_subjects fs ON s.id = fs.subject_id
    JOIN class_sessions cs ON fs.id = cs.faculty_subject_id
    LEFT JOIN attendance_records ar ON cs.id = ar.session_id AND ar.student_id = p_student_id
    WHERE s.id = p_subject_id AND cs.status = 'completed'
    GROUP BY s.id, s.name;
END //
DELIMITER ;
