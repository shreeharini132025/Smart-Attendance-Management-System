require('dotenv').config();
const db = require('../config/database');

(async () => {
  try {
    const [rows] = await db.query(`
      SELECT cr.*,
             d.name AS department_name, d.code AS department_code,
             sem.name AS semester_name,
             u.name AS faculty_name, f.faculty_id AS faculty_code,
             COUNT(DISTINCT cs.student_id) AS student_count
      FROM classrooms cr
      JOIN departments d ON cr.department_id = d.id
      JOIN semesters sem ON cr.semester_id = sem.id
      LEFT JOIN faculty f ON cr.faculty_id = f.id
      LEFT JOIN users u ON f.user_id = u.id
      LEFT JOIN classroom_students cs ON cr.id = cs.classroom_id
      GROUP BY cr.id
      ORDER BY cr.name
    `);
    console.log('Query OK, rows:', rows.length);
  } catch (err) {
    console.error('Query error:', err.message, '|code:', err.code, '|sql:', err.sql);
  }
  process.exit(0);
})();
