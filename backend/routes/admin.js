const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// ── GET /api/admin/dashboard ────────────────────────────────
router.get('/dashboard', authorize('admin'), async (req, res) => {
  try {
    const [[{ totalStudents }]] = await db.query('SELECT COUNT(*) AS totalStudents FROM students');
    const [[{ totalFaculty }]] = await db.query('SELECT COUNT(*) AS totalFaculty FROM faculty');
    const [[{ totalSubjects }]] = await db.query('SELECT COUNT(*) AS totalSubjects FROM subjects');
    const [[{ totalDepts }]] = await db.query('SELECT COUNT(*) AS totalDepts FROM departments');
    const [[{ todaySessions }]] = await db.query(
      "SELECT COUNT(*) AS todaySessions FROM class_sessions WHERE session_date = CURDATE()"
    );
    const [[{ totalAttendance }]] = await db.query(
      "SELECT COUNT(*) AS totalAttendance FROM attendance_records WHERE status='present'"
    );

    // Weekly attendance trend
    const [weeklyTrend] = await db.query(`
      SELECT DATE(cs.session_date) AS date, 
             COUNT(DISTINCT cs.id) AS total_sessions,
             COUNT(CASE WHEN ar.status='present' THEN 1 END) AS present_count
      FROM class_sessions cs
      LEFT JOIN attendance_records ar ON cs.id = ar.session_id
      WHERE cs.session_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
      GROUP BY DATE(cs.session_date)
      ORDER BY date
    `);

    // Department-wise attendance
    const [deptAttendance] = await db.query(`
      SELECT d.name AS department, d.code,
             COUNT(CASE WHEN ar.status='present' THEN 1 END) AS present,
             COUNT(ar.id) AS total
      FROM departments d
      LEFT JOIN students s ON d.id = s.department_id
      LEFT JOIN attendance_records ar ON s.id = ar.student_id
      GROUP BY d.id, d.name, d.code
    `);

    // Recent sessions
    const [recentSessions] = await db.query(`
      SELECT cs.id, cs.session_date, cs.hour_number, cs.status, cs.start_time,
             sub.name AS subject_name, sub.code AS subject_code,
             u.name AS faculty_name, d.name AS department_name
      FROM class_sessions cs
      JOIN faculty_subjects fs ON cs.faculty_subject_id = fs.id
      JOIN subjects sub ON fs.subject_id = sub.id
      JOIN faculty f ON fs.faculty_id = f.id
      JOIN users u ON f.user_id = u.id
      JOIN departments d ON sub.department_id = d.id
      ORDER BY cs.created_at DESC LIMIT 10
    `);

    res.json({
      success: true,
      stats: { totalStudents, totalFaculty, totalSubjects, totalDepts, todaySessions, totalAttendance },
      weeklyTrend,
      deptAttendance,
      recentSessions
    });
  } catch (err) {
    console.error('Admin dashboard error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── DEPARTMENT CRUD ─────────────────────────────────────────
router.get('/departments', authorize('admin'), async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT d.*, 
             COUNT(DISTINCT s.id) AS student_count, 
             COUNT(DISTINCT f.id) AS faculty_count,
             COUNT(DISTINCT sub.id) AS subject_count
      FROM departments d
      LEFT JOIN students s ON d.id = s.department_id
      LEFT JOIN faculty f ON d.id = f.department_id
      LEFT JOIN subjects sub ON d.id = sub.department_id
      GROUP BY d.id ORDER BY d.name
    `);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

router.post('/departments', authorize('admin'), async (req, res) => {
  try {
    const { name, code, description, hod_name } = req.body;
    if (!name || !code) {
      return res.status(400).json({ success: false, message: 'Name and code are required.' });
    }
    const [result] = await db.query(
      'INSERT INTO departments (name, code, description, hod_name) VALUES (?, ?, ?, ?)',
      [name, code.toUpperCase(), description, hod_name]
    );
    res.status(201).json({ success: true, message: 'Department created.', id: result.insertId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ success: false, message: 'Department code already exists.' });
    }
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

router.put('/departments/:id', authorize('admin'), async (req, res) => {
  try {
    const { name, code, description, hod_name } = req.body;
    await db.query(
      'UPDATE departments SET name=?, code=?, description=?, hod_name=? WHERE id=?',
      [name, code, description, hod_name, req.params.id]
    );
    res.json({ success: true, message: 'Department updated.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

router.delete('/departments/:id', authorize('admin'), async (req, res) => {
  try {
    await db.query('DELETE FROM departments WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Department deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── STUDENT MANAGEMENT ──────────────────────────────────────
router.get('/students', authorize('admin'), async (req, res) => {
  try {
    const { department_id, semester_id, search } = req.query;
    let query = `
      SELECT s.*, u.name, u.email, u.phone, u.is_active, u.last_login,
             d.name AS department_name, sem.name AS semester_name
      FROM students s
      JOIN users u ON s.user_id = u.id
      JOIN departments d ON s.department_id = d.id
      JOIN semesters sem ON s.semester_id = sem.id
      WHERE 1=1
    `;
    const params = [];
    if (department_id) { query += ' AND s.department_id = ?'; params.push(department_id); }
    if (semester_id) { query += ' AND s.semester_id = ?'; params.push(semester_id); }
    if (search) { query += ' AND (u.name LIKE ? OR s.roll_number LIKE ? OR u.email LIKE ?)'; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
    query += ' ORDER BY u.name';

    const [rows] = await db.query(query, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

router.post('/students', authorize('admin'), async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { name, email, password, phone, roll_number, department_id, semester_id, batch_year, section, dob, gender, address, guardian_name, guardian_phone } = req.body;

    const hashedPassword = await bcrypt.hash(password || 'Student@123', 10);
    const [userResult] = await conn.query(
      'INSERT INTO users (name, email, password, role, phone) VALUES (?, ?, ?, "student", ?)',
      [name, email, hashedPassword, phone]
    );

    await conn.query(
      'INSERT INTO students (user_id, roll_number, department_id, semester_id, batch_year, section, dob, gender, address, guardian_name, guardian_phone) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [userResult.insertId, roll_number, department_id, semester_id, batch_year, section, dob, gender, address, guardian_name, guardian_phone]
    );

    await conn.commit();
    res.status(201).json({ success: true, message: 'Student created successfully.' });
  } catch (err) {
    await conn.rollback();
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ success: false, message: 'Email or roll number already exists.' });
    }
    res.status(500).json({ success: false, message: 'Server error.' });
  } finally {
    conn.release();
  }
});

router.put('/students/:id', authorize('admin'), async (req, res) => {
  try {
    const { name, email, phone, department_id, semester_id, batch_year, section, is_active } = req.body;
    const [student] = await db.query('SELECT user_id FROM students WHERE id = ?', [req.params.id]);
    if (!student.length) return res.status(404).json({ success: false, message: 'Student not found.' });

    await db.query('UPDATE users SET name=?, email=?, phone=?, is_active=? WHERE id=?',
      [name, email, phone, is_active, student[0].user_id]);
    await db.query('UPDATE students SET department_id=?, semester_id=?, batch_year=?, section=? WHERE id=?',
      [department_id, semester_id, batch_year, section, req.params.id]);

    res.json({ success: true, message: 'Student updated.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

router.delete('/students/:id', authorize('admin'), async (req, res) => {
  try {
    const [student] = await db.query('SELECT user_id FROM students WHERE id = ?', [req.params.id]);
    if (!student.length) return res.status(404).json({ success: false, message: 'Student not found.' });
    await db.query('DELETE FROM users WHERE id = ?', [student[0].user_id]);
    res.json({ success: true, message: 'Student deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── FACULTY MANAGEMENT ──────────────────────────────────────
router.get('/faculty', authorize('admin'), async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT f.*, u.name, u.email, u.phone, u.is_active, u.last_login,
             d.name AS department_name
      FROM faculty f
      JOIN users u ON f.user_id = u.id
      JOIN departments d ON f.department_id = d.id
      ORDER BY u.name
    `);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

router.post('/faculty', authorize('admin'), async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { name, email, password, phone, faculty_id, department_id, designation, qualification, experience_years, joining_date } = req.body;

    const hashedPassword = await bcrypt.hash(password || 'Faculty@123', 10);
    const [userResult] = await conn.query(
      'INSERT INTO users (name, email, password, role, phone) VALUES (?, ?, ?, "faculty", ?)',
      [name, email, hashedPassword, phone]
    );

    await conn.query(
      'INSERT INTO faculty (user_id, faculty_id, department_id, designation, qualification, experience_years, joining_date) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [userResult.insertId, faculty_id, department_id, designation, qualification, experience_years, joining_date]
    );

    await conn.commit();
    res.status(201).json({ success: true, message: 'Faculty created successfully.' });
  } catch (err) {
    await conn.rollback();
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ success: false, message: 'Email or Faculty ID already exists.' });
    }
    res.status(500).json({ success: false, message: 'Server error.' });
  } finally {
    conn.release();
  }
});

router.put('/faculty/:id', authorize('admin'), async (req, res) => {
  try {
    const { name, email, phone, department_id, designation, is_active } = req.body;
    const [faculty] = await db.query('SELECT user_id FROM faculty WHERE id = ?', [req.params.id]);
    if (!faculty.length) return res.status(404).json({ success: false, message: 'Faculty not found.' });

    await db.query('UPDATE users SET name=?, email=?, phone=?, is_active=? WHERE id=?',
      [name, email, phone, is_active, faculty[0].user_id]);
    await db.query('UPDATE faculty SET department_id=?, designation=? WHERE id=?',
      [department_id, designation, req.params.id]);

    res.json({ success: true, message: 'Faculty updated.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

router.delete('/faculty/:id', authorize('admin'), async (req, res) => {
  try {
    const [faculty] = await db.query('SELECT user_id FROM faculty WHERE id = ?', [req.params.id]);
    if (!faculty.length) return res.status(404).json({ success: false, message: 'Faculty not found.' });
    await db.query('DELETE FROM users WHERE id = ?', [faculty[0].user_id]);
    res.json({ success: true, message: 'Faculty deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── SUBJECT MANAGEMENT ──────────────────────────────────────
router.get('/subjects', authorize('admin'), async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT sub.*, d.name AS department_name, sem.name AS semester_name
      FROM subjects sub
      JOIN departments d ON sub.department_id = d.id
      JOIN semesters sem ON sub.semester_id = sem.id
      ORDER BY d.name, sub.name
    `);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

router.post('/subjects', authorize('admin'), async (req, res) => {
  try {
    const { name, code, department_id, semester_id, credits, subject_type, description } = req.body;
    const [result] = await db.query(
      'INSERT INTO subjects (name, code, department_id, semester_id, credits, subject_type, description) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [name, code, department_id, semester_id, credits || 3, subject_type || 'theory', description]
    );
    res.status(201).json({ success: true, message: 'Subject created.', id: result.insertId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ success: false, message: 'Subject code already exists.' });
    }
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

router.put('/subjects/:id', authorize('admin'), async (req, res) => {
  try {
    const { name, code, department_id, semester_id, credits, subject_type, description } = req.body;
    await db.query(
      'UPDATE subjects SET name=?, code=?, department_id=?, semester_id=?, credits=?, subject_type=?, description=? WHERE id=?',
      [name, code, department_id, semester_id, credits, subject_type, description, req.params.id]
    );
    res.json({ success: true, message: 'Subject updated.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

router.delete('/subjects/:id', authorize('admin'), async (req, res) => {
  try {
    await db.query('DELETE FROM subjects WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Subject deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── SEMESTER MANAGEMENT ─────────────────────────────────────
router.get('/semesters', authorize('admin'), async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM semesters ORDER BY semester_number');
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

router.post('/semesters', authorize('admin'), async (req, res) => {
  try {
    const { name, semester_number, academic_year, start_date, end_date, is_active } = req.body;
    if (is_active) {
      await db.query('UPDATE semesters SET is_active = 0');
    }
    const [result] = await db.query(
      'INSERT INTO semesters (name, semester_number, academic_year, start_date, end_date, is_active) VALUES (?, ?, ?, ?, ?, ?)',
      [name, semester_number, academic_year, start_date, end_date, is_active || false]
    );
    res.status(201).json({ success: true, message: 'Semester created.', id: result.insertId });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── ADMIN REPORTS ───────────────────────────────────────────
router.get('/reports/attendance', authorize('admin'), async (req, res) => {
  try {
    const { department_id, from_date, to_date } = req.query;
    let query = `
      SELECT 
        u.name AS student_name,
        s.roll_number,
        d.name AS department_name,
        sub.name AS subject_name,
        sub.code AS subject_code,
        COUNT(DISTINCT cs.id) AS total_sessions,
        COUNT(CASE WHEN ar.status='present' THEN 1 END) AS attended,
        ROUND(COUNT(CASE WHEN ar.status='present' THEN 1 END) * 100.0 / NULLIF(COUNT(DISTINCT cs.id), 0), 2) AS percentage
      FROM students s
      JOIN users u ON s.user_id = u.id
      JOIN departments d ON s.department_id = d.id
      JOIN student_enrollments se ON s.id = se.student_id
      JOIN subjects sub ON se.subject_id = sub.id
      JOIN faculty_subjects fs ON sub.id = fs.subject_id
      JOIN class_sessions cs ON fs.id = cs.faculty_subject_id AND cs.status = 'completed'
      LEFT JOIN attendance_records ar ON cs.id = ar.session_id AND ar.student_id = s.id
      WHERE 1=1
    `;
    const params = [];
    if (department_id) { query += ' AND s.department_id = ?'; params.push(department_id); }
    if (from_date) { query += ' AND cs.session_date >= ?'; params.push(from_date); }
    if (to_date) { query += ' AND cs.session_date <= ?'; params.push(to_date); }
    query += ' GROUP BY s.id, sub.id ORDER BY u.name, sub.name';

    const [rows] = await db.query(query, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Report error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── FACULTY-SUBJECT ASSIGNMENT ──────────────────────────────
router.post('/assign-subject', authorize('admin'), async (req, res) => {
  try {
    const { faculty_id, subject_id, semester_id, academic_year } = req.body;
    await db.query(
      'INSERT INTO faculty_subjects (faculty_id, subject_id, semester_id, academic_year) VALUES (?, ?, ?, ?)',
      [faculty_id, subject_id, semester_id, academic_year]
    );
    res.status(201).json({ success: true, message: 'Subject assigned to faculty.' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ success: false, message: 'This assignment already exists.' });
    }
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

router.get('/faculty/:id/assignments', authorize('admin'), async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT fs.id, fs.subject_id, fs.semester_id, fs.academic_year,
             sub.name AS subject_name, sub.code AS subject_code,
             sem.name AS semester_name
      FROM faculty_subjects fs
      JOIN subjects sub ON fs.subject_id = sub.id
      JOIN semesters sem ON fs.semester_id = sem.id
      WHERE fs.faculty_id = ?
    `, [req.params.id]);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

router.delete('/assignments/:id', authorize('admin'), async (req, res) => {
  try {
    await db.query('DELETE FROM faculty_subjects WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Assignment removed.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// Enroll students in subject
router.post('/enroll-students', authorize('admin'), async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { student_ids, subject_id, semester_id } = req.body;
    for (const student_id of student_ids) {
      await conn.query(
        'INSERT IGNORE INTO student_enrollments (student_id, subject_id, semester_id) VALUES (?, ?, ?)',
        [student_id, subject_id, semester_id]
      );
    }
    await conn.commit();
    res.json({ success: true, message: `${student_ids.length} students enrolled.` });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ success: false, message: 'Server error.' });
  } finally {
    conn.release();
  }
});

// ── EXCEL BULK IMPORT ────────────────────────────────────────
const multer = require('multer');
const ExcelJS = require('exceljs');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// Helper: read first worksheet from uploaded buffer
async function readWorkbook(buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const ws = wb.worksheets[0];
  const rows = [];
  const headers = [];
  ws.eachRow((row, idx) => {
    if (idx === 1) { row.eachCell(c => headers.push(String(c.value || '').trim().toLowerCase().replace(/\s+/g, '_'))); }
    else {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = row.getCell(i + 1).value ?? ''; });
      rows.push(obj);
    }
  });
  return { rows, headers };
}

// POST /api/admin/import/departments
router.post('/import/departments', authorize('admin'), upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded.' });
  const { rows } = await readWorkbook(req.file.buffer);
  const results = { inserted: 0, skipped: 0, errors: [] };
  for (const [i, row] of rows.entries()) {
    const name = String(row.name || row.department_name || '').trim();
    const code = String(row.code || row.department_code || '').trim().toUpperCase();
    const description = String(row.description || '').trim();
    if (!name || !code) { results.errors.push(`Row ${i + 2}: name and code are required`); results.skipped++; continue; }
    try {
      await db.query('INSERT IGNORE INTO departments (name, code, description) VALUES (?, ?, ?)', [name, code, description]);
      results.inserted++;
    } catch (e) { results.errors.push(`Row ${i + 2}: ${e.message}`); results.skipped++; }
  }
  res.json({ success: true, results });
});

// POST /api/admin/import/subjects
router.post('/import/subjects', authorize('admin'), upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded.' });
  const { rows } = await readWorkbook(req.file.buffer);
  const results = { inserted: 0, skipped: 0, errors: [] };
  const [depts] = await db.query('SELECT id, name, code FROM departments');
  const [sems] = await db.query('SELECT id, name FROM semesters');
  for (const [i, row] of rows.entries()) {
    const name = String(row.name || row.subject_name || '').trim();
    const code = String(row.code || row.subject_code || '').trim().toUpperCase();
    const credits = parseInt(row.credits) || 3;
    const type = String(row.type || row.subject_type || 'theory').trim().toLowerCase();
    const deptInput = String(row.department || row.department_name || row.dept || '').trim();
    const semInput = String(row.semester || row.semester_name || '').trim();
    if (!name || !code) { results.errors.push(`Row ${i + 2}: name and code required`); results.skipped++; continue; }
    const dept = depts.find(d => d.name.toLowerCase() === deptInput.toLowerCase() || d.code.toLowerCase() === deptInput.toLowerCase());
    const sem = sems.find(s => s.name.toLowerCase() === semInput.toLowerCase());
    if (!dept) { results.errors.push(`Row ${i + 2}: Department "${deptInput}" not found`); results.skipped++; continue; }
    if (!sem) { results.errors.push(`Row ${i + 2}: Semester "${semInput}" not found`); results.skipped++; continue; }
    try {
      await db.query('INSERT IGNORE INTO subjects (name, code, credits, subject_type, department_id, semester_id) VALUES (?, ?, ?, ?, ?, ?)', [name, code, credits, type, dept.id, sem.id]);
      results.inserted++;
    } catch (e) { results.errors.push(`Row ${i + 2}: ${e.message}`); results.skipped++; }
  }
  res.json({ success: true, results });
});

// POST /api/admin/import/faculty
router.post('/import/faculty', authorize('admin'), upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded.' });
  const { rows } = await readWorkbook(req.file.buffer);
  const results = { inserted: 0, skipped: 0, errors: [] };
  const [depts] = await db.query('SELECT id, name, code FROM departments');
  const conn = await db.getConnection();
  try {
    for (const [i, row] of rows.entries()) {
      const name = String(row.name || row.full_name || '').trim();
      const email = String(row.email || '').trim().toLowerCase();
      const phone = String(row.phone || '').trim();
      const faculty_id_code = String(row.faculty_id || row.employee_id || '').trim();
      const deptInput = String(row.department || row.department_name || row.dept || '').trim();
      const designation = String(row.designation || '').trim();
      const qualification = String(row.qualification || '').trim();
      const password = String(row.password || 'Faculty@123').trim();
      if (!name || !email) { results.errors.push(`Row ${i + 2}: name and email required`); results.skipped++; continue; }
      const dept = depts.find(d => d.name.toLowerCase() === deptInput.toLowerCase() || d.code.toLowerCase() === deptInput.toLowerCase());
      if (!dept) { results.errors.push(`Row ${i + 2}: Department "${deptInput}" not found`); results.skipped++; continue; }
      try {
        await conn.beginTransaction();
        const [existing] = await conn.query('SELECT id FROM users WHERE email = ?', [email]);
        if (existing.length) { await conn.rollback(); results.errors.push(`Row ${i + 2}: Email already exists`); results.skipped++; continue; }
        const hashed = await bcrypt.hash(password, 10);
        const [uRes] = await conn.query('INSERT INTO users (name, email, phone, password, role) VALUES (?, ?, ?, ?, "faculty")', [name, email, phone, hashed]);
        await conn.query('INSERT INTO faculty (user_id, faculty_id, department_id, designation, qualification) VALUES (?, ?, ?, ?, ?)', [uRes.insertId, faculty_id_code, dept.id, designation, qualification]);
        await conn.commit();
        results.inserted++;
      } catch (e) { await conn.rollback(); results.errors.push(`Row ${i + 2}: ${e.message}`); results.skipped++; }
    }
  } finally { conn.release(); }
  res.json({ success: true, results });
});

// POST /api/admin/import/students
router.post('/import/students', authorize('admin'), upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded.' });
  const { rows } = await readWorkbook(req.file.buffer);
  const results = { inserted: 0, skipped: 0, errors: [] };
  const [depts] = await db.query('SELECT id, name, code FROM departments');
  const [sems] = await db.query('SELECT id, name FROM semesters');
  const conn = await db.getConnection();
  try {
    for (const [i, row] of rows.entries()) {
      const name = String(row.name || row.full_name || '').trim();
      const email = String(row.email || '').trim().toLowerCase();
      const phone = String(row.phone || '').trim();
      const roll_number = String(row.roll_number || row.roll_no || '').trim();
      const deptInput = String(row.department || row.department_name || row.dept || '').trim();
      const semInput = String(row.semester || row.semester_name || '').trim();
      const batch_year = String(row.batch_year || row.batch || '').trim();
      const section = String(row.section || '').trim();
      const gender = String(row.gender || '').trim();
      const password = String(row.password || 'Student@123').trim();
      if (!name || !email || !roll_number) { results.errors.push(`Row ${i + 2}: name, email, roll_number required`); results.skipped++; continue; }
      const dept = depts.find(d => d.name.toLowerCase() === deptInput.toLowerCase() || d.code.toLowerCase() === deptInput.toLowerCase());
      const sem = sems.find(s => s.name.toLowerCase() === semInput.toLowerCase());
      if (!dept) { results.errors.push(`Row ${i + 2}: Department "${deptInput}" not found`); results.skipped++; continue; }
      if (!sem) { results.errors.push(`Row ${i + 2}: Semester "${semInput}" not found`); results.skipped++; continue; }
      try {
        await conn.beginTransaction();
        const [existing] = await conn.query('SELECT id FROM users WHERE email = ?', [email]);
        if (existing.length) { await conn.rollback(); results.errors.push(`Row ${i + 2}: Email already exists`); results.skipped++; continue; }
        const hashed = await bcrypt.hash(password, 10);
        const [uRes] = await conn.query('INSERT INTO users (name, email, phone, password, role) VALUES (?, ?, ?, ?, "student")', [name, email, phone, hashed]);
        await conn.query('INSERT INTO students (user_id, roll_number, department_id, semester_id, batch_year, section, gender) VALUES (?, ?, ?, ?, ?, ?, ?)', [uRes.insertId, roll_number, dept.id, sem.id, batch_year, section, gender]);
        await conn.commit();
        results.inserted++;
      } catch (e) { await conn.rollback(); results.errors.push(`Row ${i + 2}: ${e.message}`); results.skipped++; }
    }
  } finally { conn.release(); }
  res.json({ success: true, results });
});

// GET /api/admin/import/template/:type  — download Excel template
router.get('/import/template/:type', authorize('admin'), async (req, res) => {
  const type = req.params.type;
  const templates = {
    students: { headers: ['name', 'email', 'phone', 'roll_number', 'department', 'semester', 'batch_year', 'section', 'gender', 'password'], sample: ['John Doe', 'john@example.com', '9999999999', 'CS001', 'Computer Science', 'Semester 1', '2022-2026', 'A', 'Male', 'Student@123'] },
    faculty: { headers: ['name', 'email', 'phone', 'faculty_id', 'department', 'designation', 'qualification', 'password'], sample: ['Dr. Jane Smith', 'jane@example.com', '9999999999', 'FAC001', 'Computer Science', 'Associate Professor', 'M.Tech', 'Faculty@123'] },
    subjects: { headers: ['name', 'code', 'credits', 'type', 'department', 'semester'], sample: ['Data Structures', 'CS201', '3', 'theory', 'Computer Science', 'Semester 3'] },
    departments: { headers: ['name', 'code', 'description'], sample: ['Computer Science', 'CS', 'Department of Computer Science'] },
  };
  const tmpl = templates[type];
  if (!tmpl) return res.status(400).json({ success: false, message: 'Unknown template type.' });
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Data');
  ws.addRow(tmpl.headers);
  ws.addRow(tmpl.sample);
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6366F1' } };
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  ws.columns.forEach(col => { col.width = 22; });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename=${type}_template.xlsx`);
  await wb.xlsx.write(res);
  res.end();
});

// ── CLASSROOM MANAGEMENT ─────────────────────────────────────

// GET /api/admin/classrooms
router.get('/classrooms', authorize('admin'), async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT cr.*,
             MAX(d.name) AS department_name, MAX(d.code) AS department_code,
             MAX(sem.name) AS semester_name,
             MAX(u.name) AS faculty_name, MAX(f.faculty_id) AS faculty_code,
             MAX(sub.name) AS subject_name, MAX(sub.code) AS subject_code,
             COUNT(DISTINCT cs.student_id) AS student_count
      FROM classrooms cr
      JOIN departments d ON cr.department_id = d.id
      JOIN semesters sem ON cr.semester_id = sem.id
      LEFT JOIN faculty f ON cr.faculty_id = f.id
      LEFT JOIN users u ON f.user_id = u.id
      LEFT JOIN subjects sub ON cr.subject_id = sub.id
      LEFT JOIN classroom_students cs ON cr.id = cs.classroom_id
      GROUP BY cr.id
      ORDER BY cr.name
    `);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Get classrooms error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// POST /api/admin/classrooms
router.post('/classrooms', authorize('admin'), async (req, res) => {
  try {
    const { name, room_number, department_id, semester_id, faculty_id, subject_id, capacity, description } = req.body;
    if (!name || !department_id || !semester_id) {
      return res.status(400).json({ success: false, message: 'Name, department, and semester are required.' });
    }
    const [result] = await db.query(
      `INSERT INTO classrooms (name, room_number, department_id, semester_id, faculty_id, subject_id, capacity, description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, room_number || null, department_id, semester_id, faculty_id || null, subject_id || null, capacity || 60, description || null]
    );

    const classroomId = result.insertId;

    // Synchronize faculty subject assignment if both are set
    if (faculty_id && subject_id) {
      const [[semInfo]] = await db.query('SELECT academic_year FROM semesters WHERE id = ?', [semester_id]);
      const academic_year = semInfo ? semInfo.academic_year : '2025-2026';
      await db.query(
        `INSERT IGNORE INTO faculty_subjects (faculty_id, subject_id, semester_id, academic_year)
         VALUES (?, ?, ?, ?)`,
        [faculty_id, subject_id, semester_id, academic_year]
      );
    }

    res.status(201).json({ success: true, message: 'Classroom created.', id: classroomId });
  } catch (err) {
    console.error('Create classroom error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// PUT /api/admin/classrooms/:id
router.put('/classrooms/:id', authorize('admin'), async (req, res) => {
  try {
    const { name, room_number, department_id, semester_id, faculty_id, subject_id, capacity, description, is_active } = req.body;
    await db.query(
      `UPDATE classrooms SET name=?, room_number=?, department_id=?, semester_id=?,
       faculty_id=?, subject_id=?, capacity=?, description=?, is_active=? WHERE id=?`,
      [name, room_number || null, department_id, semester_id, faculty_id || null, subject_id || null, capacity || 60, description || null, is_active !== undefined ? is_active : 1, req.params.id]
    );

    // Synchronize faculty subject assignment if both are set
    if (faculty_id && subject_id) {
      const [[semInfo]] = await db.query('SELECT academic_year FROM semesters WHERE id = ?', [semester_id]);
      const academic_year = semInfo ? semInfo.academic_year : '2025-2026';
      await db.query(
        `INSERT IGNORE INTO faculty_subjects (faculty_id, subject_id, semester_id, academic_year)
         VALUES (?, ?, ?, ?)`,
        [faculty_id, subject_id, semester_id, academic_year]
      );
    }

    res.json({ success: true, message: 'Classroom updated.' });
  } catch (err) {
    console.error('Update classroom error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});


// DELETE /api/admin/classrooms/:id
router.delete('/classrooms/:id', authorize('admin'), async (req, res) => {
  try {
    await db.query('DELETE FROM classrooms WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Classroom deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// GET /api/admin/classrooms/:id/students
router.get('/classrooms/:id/students', authorize('admin'), async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT s.id AS student_id, u.name, u.email, s.roll_number,
             d.name AS department_name, sem.name AS semester_name,
             cs.assigned_at
      FROM classroom_students cs
      JOIN students s ON cs.student_id = s.id
      JOIN users u ON s.user_id = u.id
      JOIN departments d ON s.department_id = d.id
      JOIN semesters sem ON s.semester_id = sem.id
      WHERE cs.classroom_id = ?
      ORDER BY u.name
    `, [req.params.id]);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// POST /api/admin/classrooms/:id/students — assign student(s)
router.post('/classrooms/:id/students', authorize('admin'), async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { student_ids } = req.body;
    if (!Array.isArray(student_ids) || student_ids.length === 0) {
      return res.status(400).json({ success: false, message: 'student_ids array is required.' });
    }

    // Get classroom subject and semester info
    const [[classroomInfo]] = await conn.query('SELECT subject_id, semester_id FROM classrooms WHERE id = ?', [req.params.id]);

    let added = 0;
    for (const sid of student_ids) {
      const [r] = await conn.query(
        'INSERT IGNORE INTO classroom_students (classroom_id, student_id) VALUES (?, ?)',
        [req.params.id, sid]
      );
      if (r.affectedRows) {
        added++;
        // Auto-enroll student into subject for this semester
        if (classroomInfo && classroomInfo.subject_id) {
          await conn.query(
            'INSERT IGNORE INTO student_enrollments (student_id, subject_id, semester_id) VALUES (?, ?, ?)',
            [sid, classroomInfo.subject_id, classroomInfo.semester_id]
          );
        }
      }
    }
    await conn.commit();
    res.json({ success: true, message: `${added} student(s) assigned to classroom.` });
  } catch (err) {
    await conn.rollback();
    console.error('Assign students error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  } finally {
    conn.release();
  }
});

// GET /api/admin/classrooms/:id/import-template — download Excel template
router.get('/classrooms/:id/import-template', authorize('admin'), async (req, res) => {
  try {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Students');
    ws.columns = [
      { header: 'roll_number', key: 'roll_number', width: 20 },
      { header: 'email', key: 'email', width: 28 },
      { header: 'name', key: 'name', width: 25 },
    ];
    // Style header row
    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6366F1' } };
    // Sample rows
    ws.addRow({ roll_number: 'CS2021001', email: 'student1@college.edu', name: 'John Doe' });
    ws.addRow({ roll_number: 'CS2021002', email: 'student2@college.edu', name: 'Jane Smith' });
    // Note row
    ws.addRow({});
    const noteRow = ws.addRow(['NOTE: roll_number OR email is required. name column is optional (for reference only).']);
    noteRow.getCell(1).font = { italic: true, color: { argb: 'FF888888' } };
    ws.mergeCells(`A${noteRow.number}:C${noteRow.number}`);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=classroom_students_template.xlsx`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Template error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// POST /api/admin/classrooms/:id/import-students — bulk Excel import
router.post('/classrooms/:id/import-students', authorize('admin'), upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded.' });
  const classroomId = req.params.id;

  // Verify classroom exists
  const [crCheck] = await db.query('SELECT id, name, subject_id, semester_id FROM classrooms WHERE id = ?', [classroomId]);
  if (!crCheck.length) return res.status(404).json({ success: false, message: 'Classroom not found.' });
  const classroomInfo = crCheck[0];

  const results = { assigned: 0, already_enrolled: 0, not_found: 0, errors: [] };

  try {
    const { rows } = await readWorkbook(req.file.buffer);
    const conn = await db.getConnection();

    try {
      await conn.beginTransaction();
      for (const [i, row] of rows.entries()) {
        const rollNumber = String(row.roll_number || row['roll number'] || row.rollnumber || '').trim();
        const email = String(row.email || '').trim().toLowerCase();
        const rowNum = i + 2;

        if (!rollNumber && !email) {
          results.errors.push(`Row ${rowNum}: roll_number or email required`);
          results.not_found++;
          continue;
        }

        // Find student by roll_number or email
        let studentRows;
        if (rollNumber) {
          [studentRows] = await conn.query(
            'SELECT s.id FROM students s JOIN users u ON s.user_id = u.id WHERE s.roll_number = ?',
            [rollNumber]
          );
        }
        if ((!studentRows || !studentRows.length) && email) {
          [studentRows] = await conn.query(
            'SELECT s.id FROM students s JOIN users u ON s.user_id = u.id WHERE u.email = ?',
            [email]
          );
        }

        if (!studentRows || !studentRows.length) {
          results.errors.push(`Row ${rowNum}: Student not found (roll: "${rollNumber}", email: "${email}")`);
          results.not_found++;
          continue;
        }

        const studentId = studentRows[0].id;

        // Insert IGNORE handles duplicates silently
        const [r] = await conn.query(
          'INSERT IGNORE INTO classroom_students (classroom_id, student_id) VALUES (?, ?)',
          [classroomId, studentId]
        );

        if (r.affectedRows) {
          results.assigned++;
          // Auto-enroll in subject
          if (classroomInfo && classroomInfo.subject_id) {
            await conn.query(
              'INSERT IGNORE INTO student_enrollments (student_id, subject_id, semester_id) VALUES (?, ?, ?)',
              [studentId, classroomInfo.subject_id, classroomInfo.semester_id]
            );
          }
        } else {
          results.already_enrolled++;
        }
      }
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }

    res.json({
      success: true,
      message: `Import complete: ${results.assigned} assigned, ${results.already_enrolled} already enrolled, ${results.not_found} not found.`,
      results
    });
  } catch (err) {
    console.error('Import students error:', err);
    res.status(500).json({ success: false, message: 'Failed to process file: ' + err.message });
  }
});

// DELETE /api/admin/classrooms/:id/students/:studentId
router.delete('/classrooms/:id/students/:studentId', authorize('admin'), async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    // Get classroom subject and semester info
    const [[classroomInfo]] = await conn.query('SELECT subject_id, semester_id FROM classrooms WHERE id = ?', [req.params.id]);

    await conn.query(
      'DELETE FROM classroom_students WHERE classroom_id = ? AND student_id = ?',
      [req.params.id, req.params.studentId]
    );

    // Auto-remove enrollment
    if (classroomInfo && classroomInfo.subject_id) {
      await conn.query(
        'DELETE FROM student_enrollments WHERE student_id = ? AND subject_id = ? AND semester_id = ?',
        [req.params.studentId, classroomInfo.subject_id, classroomInfo.semester_id]
      );
    }

    await conn.commit();
    res.json({ success: true, message: 'Student removed from classroom.' });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ success: false, message: 'Server error.' });
  } finally {
    conn.release();
  }
});

// ── SESSION SCHEDULING BY ADMIN ──────────────────────────────

// GET /api/admin/sessions - list all sessions
router.get('/sessions', authorize('admin'), async (req, res) => {
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
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Get admin sessions error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// POST /api/admin/sessions - schedule a session
router.post('/sessions', authorize('admin'), async (req, res) => {
  try {
    const { classroom_id, session_date, hour_number, start_time, end_time } = req.body;
    if (!classroom_id) {
      return res.status(400).json({ success: false, message: 'Classroom is required.' });
    }

    // Get classroom details
    const [[classroom]] = await db.query('SELECT * FROM classrooms WHERE id = ?', [classroom_id]);
    if (!classroom) {
      return res.status(404).json({ success: false, message: 'Classroom not found.' });
    }
    if (!classroom.faculty_id || !classroom.subject_id) {
      return res.status(400).json({ success: false, message: 'Classroom must have both assigned Faculty and Subject.' });
    }

    // Find the corresponding faculty_subject_id
    const [[facSub]] = await db.query(
      'SELECT id FROM faculty_subjects WHERE faculty_id = ? AND subject_id = ? AND semester_id = ?',
      [classroom.faculty_id, classroom.subject_id, classroom.semester_id]
    );

    let faculty_subject_id;
    if (facSub) {
      faculty_subject_id = facSub.id;
    } else {
      // Auto-create faculty_subjects assignment
      const [[semInfo]] = await db.query('SELECT academic_year FROM semesters WHERE id = ?', [classroom.semester_id]);
      const academic_year = semInfo ? semInfo.academic_year : '2025-2026';
      const [fsRes] = await db.query(
        'INSERT INTO faculty_subjects (faculty_id, subject_id, semester_id, academic_year) VALUES (?, ?, ?, ?)',
        [classroom.faculty_id, classroom.subject_id, classroom.semester_id, academic_year]
      );
      faculty_subject_id = fsRes.insertId;
    }

    const [result] = await db.query(
      `INSERT INTO class_sessions (faculty_subject_id, session_date, hour_number, start_time, end_time, room_number, status)
       VALUES (?, ?, ?, ?, ?, ?, 'scheduled')`,
      [
        faculty_subject_id,
        session_date || new Date().toISOString().split('T')[0],
        hour_number || 1,
        start_time || '09:00',
        end_time || '10:00',
        classroom.room_number || 'Room'
      ]
    );

    res.status(201).json({ success: true, message: 'Session scheduled successfully.', sessionId: result.insertId });
  } catch (err) {
    console.error('Schedule session error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// DELETE /api/admin/sessions/:id - delete a session
router.delete('/sessions/:id', authorize('admin'), async (req, res) => {
  try {
    await db.query('DELETE FROM class_sessions WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Session deleted successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;

