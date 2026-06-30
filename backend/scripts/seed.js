const bcrypt = require('bcryptjs');
const db = require('../config/database');
require('dotenv').config();

async function seed() {
  console.log('🌱 Seeding database...');
  try {
    // Seed demo faculty user
    const facultyPwd = await bcrypt.hash('Faculty@123', 10);
    const [fUser] = await db.query(
      'INSERT IGNORE INTO users (name, email, password, role, phone) VALUES (?, ?, ?, "faculty", ?)',
      ['Dr. Rajesh Kumar', 'faculty@smartattend.edu', facultyPwd, '9876543210']
    );
    if (fUser.insertId) {
      await db.query(
        'INSERT IGNORE INTO faculty (user_id, faculty_id, department_id, designation, experience_years) VALUES (?, ?, 1, ?, 8)',
        [fUser.insertId, 'FAC001', 'Associate Professor']
      );
    }

    // Seed demo student user
    const studentPwd = await bcrypt.hash('Student@123', 10);
    const [sUser] = await db.query(
      'INSERT IGNORE INTO users (name, email, password, role, phone) VALUES (?, ?, ?, "student", ?)',
      ['Arun Sharma', 'student@smartattend.edu', studentPwd, '9123456789']
    );
    if (sUser.insertId) {
      await db.query(
        'INSERT IGNORE INTO students (user_id, roll_number, department_id, semester_id, batch_year, section, gender) VALUES (?, ?, 1, 3, ?, ?, ?)',
        [sUser.insertId, 'CSE2022001', '2022-2026', 'A', 'Male']
      );
    }

    // Seed subjects
    const subjects = [
      ['Data Structures and Algorithms', 'CS301', 1, 3, 4, 'theory'],
      ['Database Management Systems', 'CS302', 1, 3, 3, 'theory'],
      ['Operating Systems', 'CS303', 1, 3, 3, 'theory'],
      ['Computer Networks', 'CS304', 1, 3, 3, 'theory'],
      ['Data Structures Lab', 'CS301L', 1, 3, 1, 'lab'],
    ];
    for (const [name, code, dept, sem, credits, type] of subjects) {
      await db.query(
        'INSERT IGNORE INTO subjects (name, code, department_id, semester_id, credits, subject_type) VALUES (?, ?, ?, ?, ?, ?)',
        [name, code, dept, sem, credits, type]
      );
    }

    console.log('✅ Seed completed successfully!');
    console.log('\n📋 Demo Credentials:');
    console.log('  Admin   : admin@smartattend.edu / Admin@123');
    console.log('  Faculty : faculty@smartattend.edu / Faculty@123');
    console.log('  Student : student@smartattend.edu / Student@123');
    process.exit(0);
  } catch (err) {
    console.error('❌ Seed failed:', err.message);
    process.exit(1);
  }
}

seed();
