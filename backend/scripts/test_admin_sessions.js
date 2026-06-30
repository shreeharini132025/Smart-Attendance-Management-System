require('dotenv').config();
const db = require('../config/database');

(async () => {
  try {
    const [rows] = await db.query(`
      SELECT cs.*,
             MAX(sub.name) AS subject_name, MAX(sub.code) AS subject_code,
             MAX(u.name) AS faculty_name,
             MAX(cl.name) AS classroom_name,
             COUNT(DISTINCT ar.id) AS attendance_count
      FROM class_sessions cs
      JOIN faculty_subjects fs ON cs.faculty_subject_id = fs.id
      JOIN subjects sub ON fs.subject_id = sub.id
      JOIN faculty f ON fs.faculty_id = f.id
      JOIN users u ON f.user_id = u.id
      LEFT JOIN classrooms cl ON cl.faculty_id = f.id AND cl.subject_id = sub.id
      LEFT JOIN attendance_records ar ON ar.session_id = cs.id AND ar.status = 'present'
      GROUP BY cs.id
      ORDER BY cs.session_date DESC, cs.start_time DESC
    `);
    console.log('Query OK! Rows returned:', rows.length);
  } catch (err) {
    console.error('SQL query failed:', err.message, '|code:', err.code, '|sql:', err.sql);
  }
  process.exit(0);
})();
