require('dotenv').config();
const mysql = require('mysql2/promise');

async function migrate() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'smart_attendance_db',
    multipleStatements: true,
  });

  console.log('Connected. Running classroom migration...');

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS classrooms (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      room_number VARCHAR(30),
      department_id INT NOT NULL,
      semester_id INT NOT NULL,
      faculty_id INT NULL,
      capacity INT DEFAULT 60,
      description TEXT,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (department_id) REFERENCES departments(id),
      FOREIGN KEY (semester_id) REFERENCES semesters(id),
      FOREIGN KEY (faculty_id) REFERENCES faculty(id) ON DELETE SET NULL
    )
  `);
  console.log('✅ classrooms table created');

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS classroom_students (
      id INT AUTO_INCREMENT PRIMARY KEY,
      classroom_id INT NOT NULL,
      student_id INT NOT NULL,
      assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (classroom_id) REFERENCES classrooms(id) ON DELETE CASCADE,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
      UNIQUE KEY unique_student_classroom (classroom_id, student_id)
    )
  `);
  console.log('✅ classroom_students table created');

  await conn.end();
  console.log('Migration complete!');
}

migrate().catch(err => { console.error('Migration failed:', err.message); process.exit(1); });
