const express = require('express');
const QRCode = require('qrcode');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate, authorize('faculty'));

// Helper: generate random 6-digit OTP
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// ── GET /api/faculty/dashboard ──────────────────────────────
router.get('/dashboard', async (req, res) => {
  try {
    const [faculty] = await db.query('SELECT id FROM faculty WHERE user_id = ?', [req.user.id]);
    if (!faculty.length) return res.status(404).json({ success: false, message: 'Faculty profile not found.' });
    const facultyId = faculty[0].id;

    const [[{ totalSubjects }]] = await db.query(
      'SELECT COUNT(*) AS totalSubjects FROM faculty_subjects WHERE faculty_id = ?', [facultyId]
    );
    const [[{ todaySessions }]] = await db.query(
      `SELECT COUNT(*) AS todaySessions FROM class_sessions cs
       JOIN faculty_subjects fs ON cs.faculty_subject_id = fs.id
       WHERE fs.faculty_id = ? AND cs.session_date = CURDATE()`, [facultyId]
    );
    const [[{ totalStudents }]] = await db.query(
      `SELECT COUNT(DISTINCT se.student_id) AS totalStudents
       FROM faculty_subjects fs
       JOIN student_enrollments se ON fs.subject_id = se.subject_id
       WHERE fs.faculty_id = ?`, [facultyId]
    );

    // Recent attendance
    const [recentAttendance] = await db.query(`
      SELECT cs.id, cs.session_date, cs.hour_number, cs.status, cs.start_time,
             sub.name AS subject_name, sub.code AS subject_code,
             COUNT(CASE WHEN ar.status='present' THEN 1 END) AS present_count,
             COUNT(ar.id) AS total_enrolled
      FROM class_sessions cs
      JOIN faculty_subjects fs ON cs.faculty_subject_id = fs.id
      JOIN subjects sub ON fs.subject_id = sub.id
      LEFT JOIN attendance_records ar ON cs.id = ar.session_id
      WHERE fs.faculty_id = ?
      GROUP BY cs.id, cs.session_date, cs.hour_number, cs.status, cs.start_time, sub.name, sub.code
      ORDER BY cs.created_at DESC LIMIT 8
    `, [facultyId]);

    // Subject-wise attendance overview
    const [subjectOverview] = await db.query(`
      SELECT sub.id, sub.name AS subject_name, sub.code,
             COUNT(DISTINCT cs.id) AS total_sessions,
             COUNT(CASE WHEN ar.status='present' THEN 1 END) AS total_present,
             COUNT(ar.id) AS total_records
      FROM faculty_subjects fs
      JOIN subjects sub ON fs.subject_id = sub.id
      LEFT JOIN class_sessions cs ON fs.id = cs.faculty_subject_id AND cs.status = 'completed'
      LEFT JOIN attendance_records ar ON cs.id = ar.session_id
      WHERE fs.faculty_id = ?
      GROUP BY sub.id, sub.name, sub.code
    `, [facultyId]);

    res.json({ success: true, stats: { totalSubjects, todaySessions, totalStudents }, recentAttendance, subjectOverview });
  } catch (err) {
    console.error('Faculty dashboard error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── GET /api/faculty/subjects ───────────────────────────────
// Only returns subjects that have an ACTIVE classroom assigned.
// When session is closed → classroom becomes inactive → card disappears automatically.
router.get('/subjects', async (req, res) => {
  try {
    const [faculty] = await db.query('SELECT id FROM faculty WHERE user_id = ?', [req.user.id]);
    if (!faculty.length) return res.status(404).json({ success: false, message: 'Faculty profile not found.' });
    const [rows] = await db.query(`
      SELECT fs.id AS faculty_subject_id, sub.id AS subject_id,
             sub.name, sub.code, sub.credits, sub.subject_type,
             d.name AS department_name, sem.name AS semester_name,
             cr.id AS classroom_id, cr.name AS classroom_name,
             cr.room_number AS classroom_room, cr.capacity AS classroom_capacity,
             COUNT(DISTINCT crs.student_id) AS enrolled_students,
             COUNT(DISTINCT cs.id) AS total_sessions
      FROM faculty_subjects fs
      JOIN subjects sub ON fs.subject_id = sub.id
      JOIN departments d ON sub.department_id = d.id
      JOIN semesters sem ON fs.semester_id = sem.id
      INNER JOIN classrooms cr ON cr.faculty_id = fs.faculty_id
                              AND cr.subject_id = sub.id
                              AND cr.is_active = 1
      LEFT JOIN classroom_students crs ON crs.classroom_id = cr.id
      LEFT JOIN class_sessions cs ON fs.id = cs.faculty_subject_id
      WHERE fs.faculty_id = ?
      GROUP BY fs.id, sub.id, sub.name, sub.code, sub.credits, sub.subject_type,
               d.name, sem.name, cr.id, cr.name, cr.room_number, cr.capacity
    `, [faculty[0].id]);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Faculty subjects error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── GET /api/faculty/classrooms ─────────────────────────────
// Returns all active classrooms assigned to this faculty by admin
router.get('/classrooms', async (req, res) => {
  try {
    const [faculty] = await db.query('SELECT id FROM faculty WHERE user_id = ?', [req.user.id]);
    if (!faculty.length) return res.status(404).json({ success: false, message: 'Faculty profile not found.' });
    const [rows] = await db.query(`
      SELECT cr.id, cr.name, cr.room_number, cr.capacity, cr.description,
             d.name AS department_name, sem.name AS semester_name,
             sub.id AS subject_id, sub.name AS subject_name, sub.code AS subject_code,
             COUNT(DISTINCT crs.student_id) AS student_count
      FROM classrooms cr
      JOIN departments d ON cr.department_id = d.id
      JOIN semesters sem ON cr.semester_id = sem.id
      LEFT JOIN subjects sub ON cr.subject_id = sub.id
      LEFT JOIN classroom_students crs ON crs.classroom_id = cr.id
      WHERE cr.faculty_id = ? AND cr.is_active = 1
      GROUP BY cr.id, cr.name, cr.room_number, cr.capacity, cr.description,
               d.name, sem.name, sub.id, sub.name, sub.code
      ORDER BY cr.name
    `, [faculty[0].id]);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Faculty classrooms error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── GET /api/faculty/sessions/:id/classroom-students ────────
// Returns the list of students in the classroom for this session
router.get('/sessions/:id/classroom-students', async (req, res) => {
  try {
    const [faculty] = await db.query('SELECT id FROM faculty WHERE user_id = ?', [req.user.id]);
    if (!faculty.length) return res.status(404).json({ success: false, message: 'Faculty profile not found.' });
    const sessionId = req.params.id;

    // Verify this session belongs to this faculty
    const [sessionRows] = await db.query(`
      SELECT cs.id, fs.subject_id, fs.faculty_id FROM class_sessions cs
      JOIN faculty_subjects fs ON cs.faculty_subject_id = fs.id
      WHERE cs.id = ? AND fs.faculty_id = ?
    `, [sessionId, faculty[0].id]);
    if (!sessionRows.length) return res.status(404).json({ success: false, message: 'Session not found.' });

    const { subject_id } = sessionRows[0];

    // Get students from classroom assigned to this faculty + subject
    const [students] = await db.query(`
      SELECT s.id AS student_id, u.name, u.email, s.roll_number,
             d.name AS department_name,
             COALESCE(ar.status, 'pending') AS attendance_status,
             ar.marked_at, ar.verification_method
      FROM classrooms cr
      JOIN classroom_students crs ON crs.classroom_id = cr.id
      JOIN students s ON crs.student_id = s.id
      JOIN users u ON s.user_id = u.id
      JOIN departments d ON s.department_id = d.id
      LEFT JOIN attendance_records ar ON ar.session_id = ? AND ar.student_id = s.id
      WHERE cr.faculty_id = ? AND cr.subject_id = ? AND cr.is_active = 1
      ORDER BY u.name
    `, [sessionId, faculty[0].id, subject_id]);

    res.json({ success: true, data: students });
  } catch (err) {
    console.error('Classroom students error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── POST /api/faculty/sessions/create ──────────────────────
router.post('/sessions/create', async (req, res) => {
  try {
    const [faculty] = await db.query('SELECT id FROM faculty WHERE user_id = ?', [req.user.id]);
    const { faculty_subject_id, session_date, hour_number, start_time, end_time, room_number } = req.body;

    // Verify faculty owns this subject
    const [fsCheck] = await db.query(
      'SELECT id FROM faculty_subjects WHERE id = ? AND faculty_id = ?',
      [faculty_subject_id, faculty[0].id]
    );
    if (!fsCheck.length) return res.status(403).json({ success: false, message: 'Unauthorized.' });

    const [result] = await db.query(
      `INSERT INTO class_sessions (faculty_subject_id, session_date, hour_number, start_time, end_time, room_number, status)
       VALUES (?, ?, ?, ?, ?, ?, 'scheduled')`,
      [faculty_subject_id, session_date, hour_number, start_time, end_time, room_number]
    );

    res.status(201).json({ success: true, message: 'Session created.', sessionId: result.insertId });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});
// ── PUT /api/faculty/sessions/:id/configure ────────────────
router.put('/sessions/:id/configure', async (req, res) => {
  try {
    const [faculty] = await db.query('SELECT id FROM faculty WHERE user_id = ?', [req.user.id]);
    if (!faculty.length) return res.status(404).json({ success: false, message: 'Faculty profile not found.' });
    const sessionId = req.params.id;
    const { session_date, hour_number, start_time, end_time } = req.body;

    // Validate ownership
    const [session] = await db.query(`
      SELECT cs.id FROM class_sessions cs
      JOIN faculty_subjects fs ON cs.faculty_subject_id = fs.id
      WHERE cs.id = ? AND fs.faculty_id = ?
    `, [sessionId, faculty[0].id]);

    if (!session.length) return res.status(404).json({ success: false, message: 'Session not found or unauthorized.' });

    await db.query(
      `UPDATE class_sessions SET session_date=?, hour_number=?, start_time=?, end_time=? WHERE id=?`,
      [session_date, hour_number, start_time, end_time, sessionId]
    );

    res.json({ success: true, message: 'Session configured successfully.' });
  } catch (err) {
    console.error('Configure session error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── POST /api/faculty/sessions/:id/generate-otp ────────────
router.post('/sessions/:id/generate-otp', async (req, res) => {
  try {
    const [faculty] = await db.query('SELECT id FROM faculty WHERE user_id = ?', [req.user.id]);
    const sessionId = req.params.id;

    // Validate ownership
    const [session] = await db.query(`
      SELECT cs.*, fs.faculty_id FROM class_sessions cs
      JOIN faculty_subjects fs ON cs.faculty_subject_id = fs.id
      WHERE cs.id = ? AND fs.faculty_id = ?
    `, [sessionId, faculty[0].id]);

    if (!session.length) return res.status(404).json({ success: false, message: 'Session not found.' });

    const otp = generateOTP();
    const expirySeconds = parseInt(process.env.OTP_EXPIRY_SECONDS) || 60;
    const qrToken = uuidv4();

    // Generate QR code data URL
    const qrData = JSON.stringify({
      sessionId,
      token: qrToken,
      subject: session[0].faculty_subject_id,
      timestamp: Date.now()
    });
    const qrCodeDataURL = await QRCode.toDataURL(qrData, {
      width: 400,
      margin: 2,
      color: { dark: '#1a1a2e', light: '#ffffff' }
    });

    await db.query(
      `UPDATE class_sessions SET otp_code=?, otp_expires_at=DATE_ADD(NOW(), INTERVAL ? SECOND),
       qr_code_data=?, qr_token=?, status='active' WHERE id=?`,
      [otp, expirySeconds, qrCodeDataURL, qrToken, sessionId]
    );

    res.json({
      success: true,
      otp,
      qrCode: qrCodeDataURL,
      qrToken,
      expiresIn: expirySeconds,
      expiresAt: new Date(Date.now() + expirySeconds * 1000)
    });
  } catch (err) {
    console.error('Generate OTP error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── GET /api/faculty/sessions/:id/live ──────────────────────
router.get('/sessions/:id/live', async (req, res) => {
  try {
    const [faculty] = await db.query('SELECT id FROM faculty WHERE user_id = ?', [req.user.id]);
    const sessionId = req.params.id;

    const [session] = await db.query(`
      SELECT cs.*, sub.name AS subject_name, sub.code AS subject_code,
             NOW() > cs.otp_expires_at AS otp_expired
      FROM class_sessions cs
      JOIN faculty_subjects fs ON cs.faculty_subject_id = fs.id
      JOIN subjects sub ON fs.subject_id = sub.id
      WHERE cs.id = ? AND fs.faculty_id = ?
    `, [sessionId, faculty[0].id]);

    if (!session.length) return res.status(404).json({ success: false, message: 'Session not found.' });

    const [attendance] = await db.query(`
      SELECT ar.*, u.name AS student_name, s.roll_number, ar.marked_at, ar.status
      FROM attendance_records ar
      JOIN students s ON ar.student_id = s.id
      JOIN users u ON s.user_id = u.id
      WHERE ar.session_id = ?
      ORDER BY ar.marked_at DESC
    `, [sessionId]);

    const [[{ total_enrolled }]] = await db.query(`
      SELECT COUNT(DISTINCT se.student_id) AS total_enrolled
      FROM faculty_subjects fs
      JOIN student_enrollments se ON fs.subject_id = se.subject_id
      WHERE fs.id = ?
    `, [session[0].faculty_subject_id]);

    res.json({
      success: true,
      session: session[0],
      attendance,
      stats: {
        total_enrolled,
        present: attendance.filter(a => a.status === 'present').length,
        absent: total_enrolled - attendance.filter(a => a.status === 'present').length
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── POST /api/faculty/sessions/:id/close ───────────────────
router.post('/sessions/:id/close', async (req, res) => {
  try {
    const [faculty] = await db.query('SELECT id FROM faculty WHERE user_id = ?', [req.user.id]);
    const sessionId = req.params.id;

    const [session] = await db.query(`
      SELECT cs.*, fs.faculty_id, fs.subject_id FROM class_sessions cs
      JOIN faculty_subjects fs ON cs.faculty_subject_id = fs.id
      WHERE cs.id = ? AND fs.faculty_id = ?
    `, [sessionId, faculty[0].id]);

    if (!session.length) return res.status(404).json({ success: false, message: 'Session not found.' });

    const { faculty_subject_id, subject_id } = session[0];

    // Mark all non-responded classroom students as absent (covers classroom-based enrollment)
    await db.query(`
      INSERT INTO attendance_records (session_id, student_id, status, marked_by)
      SELECT ?, crs.student_id, 'absent', 'system'
      FROM classrooms cr
      JOIN classroom_students crs ON crs.classroom_id = cr.id
      WHERE cr.faculty_id = ? AND cr.subject_id = ? AND cr.is_active = 1
      AND crs.student_id NOT IN (SELECT student_id FROM attendance_records WHERE session_id = ?)
      ON DUPLICATE KEY UPDATE status = status
    `, [sessionId, faculty[0].id, subject_id, sessionId]);

    // Also mark via student_enrollments as fallback
    await db.query(`
      INSERT INTO attendance_records (session_id, student_id, status, marked_by)
      SELECT ?, se.student_id, 'absent', 'system'
      FROM student_enrollments se
      JOIN faculty_subjects fs ON se.subject_id = fs.subject_id
      WHERE fs.id = ?
      AND se.student_id NOT IN (SELECT student_id FROM attendance_records WHERE session_id = ?)
      ON DUPLICATE KEY UPDATE status = status
    `, [sessionId, faculty_subject_id, sessionId]);

    // Mark session as completed
    await db.query("UPDATE class_sessions SET status='completed', otp_code=NULL, otp_expires_at=NULL WHERE id=?", [sessionId]);

    // ── Deactivate the classroom for this faculty + subject ──
    // This auto-removes it from faculty's Subjects & Classrooms panels
    await db.query(
      'UPDATE classrooms SET is_active = 0 WHERE faculty_id = ? AND subject_id = ? AND is_active = 1',
      [faculty[0].id, subject_id]
    );

    // Check for shortage alerts
    await checkShortageAlerts(subject_id);

    res.json({ success: true, message: 'Session closed successfully.' });
  } catch (err) {
    console.error('Close session error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── PUT /api/faculty/attendance/:id ────────────────────────
router.put('/attendance/:id', async (req, res) => {
  try {
    const { status, remarks } = req.body;
    await db.query(
      'UPDATE attendance_records SET status=?, remarks=?, edited_at=NOW(), edited_by=?, marked_by="faculty" WHERE id=?',
      [status, remarks, req.user.id, req.params.id]
    );
    res.json({ success: true, message: 'Attendance updated.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── GET /api/faculty/sessions ───────────────────────────────
router.get('/sessions', async (req, res) => {
  try {
    const [faculty] = await db.query('SELECT id FROM faculty WHERE user_id = ?', [req.user.id]);
    const { from_date, to_date, faculty_subject_id } = req.query;

    let query = `
      SELECT cs.*, sub.name AS subject_name, sub.code,
             COUNT(CASE WHEN ar.status='present' THEN 1 END) AS present_count,
             COUNT(ar.id) AS total_records
      FROM class_sessions cs
      JOIN faculty_subjects fs ON cs.faculty_subject_id = fs.id
      JOIN subjects sub ON fs.subject_id = sub.id
      LEFT JOIN attendance_records ar ON cs.id = ar.session_id
      WHERE fs.faculty_id = ?
    `;
    const params = [faculty[0].id];

    if (from_date) { query += ' AND cs.session_date >= ?'; params.push(from_date); }
    if (to_date) { query += ' AND cs.session_date <= ?'; params.push(to_date); }
    if (faculty_subject_id) { query += ' AND cs.faculty_subject_id = ?'; params.push(faculty_subject_id); }

    query += ' GROUP BY cs.id ORDER BY cs.session_date DESC, cs.hour_number';

    const [rows] = await db.query(query, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── GET /api/faculty/analytics ─────────────────────────────
router.get('/analytics', async (req, res) => {
  try {
    const [faculty] = await db.query('SELECT id FROM faculty WHERE user_id = ?', [req.user.id]);

    // Subject-wise attendance
    const [subjectWise] = await db.query(`
      SELECT sub.name AS subject_name, sub.code,
             COUNT(DISTINCT se.student_id) AS total_students,
             COUNT(CASE WHEN ar.status='present' THEN 1 END) AS total_present,
             COUNT(DISTINCT cs.id) AS total_sessions,
             ROUND(COUNT(CASE WHEN ar.status='present' THEN 1 END) * 100.0 / 
             NULLIF(COUNT(DISTINCT cs.id) * COUNT(DISTINCT se.student_id), 0), 2) AS avg_percentage
      FROM faculty_subjects fs
      JOIN subjects sub ON fs.subject_id = sub.id
      LEFT JOIN student_enrollments se ON sub.id = se.subject_id
      LEFT JOIN class_sessions cs ON fs.id = cs.faculty_subject_id AND cs.status='completed'
      LEFT JOIN attendance_records ar ON cs.id = ar.session_id AND ar.student_id = se.student_id
      WHERE fs.faculty_id = ?
      GROUP BY sub.id, sub.name, sub.code
    `, [faculty[0].id]);

    // Daily trend (last 30 days)
    const [dailyTrend] = await db.query(`
      SELECT DATE(cs.session_date) AS date,
             COUNT(DISTINCT cs.id) AS sessions,
             COUNT(CASE WHEN ar.status='present' THEN 1 END) AS present
      FROM class_sessions cs
      JOIN faculty_subjects fs ON cs.faculty_subject_id = fs.id
      LEFT JOIN attendance_records ar ON cs.id = ar.session_id
      WHERE fs.faculty_id = ? AND cs.session_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
      GROUP BY DATE(cs.session_date) ORDER BY date
    `, [faculty[0].id]);

    // Students with low attendance (< 75%)
    const [lowAttendance] = await db.query(`
      SELECT u.name AS student_name, s.roll_number, sub.name AS subject_name,
             COUNT(DISTINCT cs.id) AS total_sessions,
             COUNT(CASE WHEN ar.status='present' THEN 1 END) AS attended,
             ROUND(COUNT(CASE WHEN ar.status='present' THEN 1 END) * 100.0 / NULLIF(COUNT(DISTINCT cs.id), 0), 2) AS percentage
      FROM students s
      JOIN users u ON s.user_id = u.id
      JOIN student_enrollments se ON s.id = se.student_id
      JOIN subjects sub ON se.subject_id = sub.id
      JOIN faculty_subjects fs ON sub.id = fs.subject_id
      LEFT JOIN class_sessions cs ON fs.id = cs.faculty_subject_id AND cs.status='completed'
      LEFT JOIN attendance_records ar ON cs.id = ar.session_id AND ar.student_id = s.id
      WHERE fs.faculty_id = ?
      GROUP BY s.id, sub.id
      HAVING percentage < 75 OR percentage IS NULL
      ORDER BY percentage ASC LIMIT 20
    `, [faculty[0].id]);

    res.json({ success: true, subjectWise, dailyTrend, lowAttendance });
  } catch (err) {
    console.error('Faculty analytics error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// Helper: Check and send shortage alerts
async function checkShortageAlerts(subjectId) {
  try {
    const [students] = await db.query(`
      SELECT s.id AS student_id, s.user_id, sub.name AS subject_name,
             COUNT(DISTINCT cs.id) AS total,
             COUNT(CASE WHEN ar.status='present' THEN 1 END) AS attended,
             ROUND(COUNT(CASE WHEN ar.status='present' THEN 1 END) * 100.0 / NULLIF(COUNT(DISTINCT cs.id), 0), 2) AS percentage
      FROM students s
      JOIN student_enrollments se ON s.id = se.student_id
      JOIN subjects sub ON se.subject_id = sub.id
      JOIN faculty_subjects fs ON sub.id = fs.subject_id
      LEFT JOIN class_sessions cs ON fs.id = cs.faculty_subject_id AND cs.status='completed'
      LEFT JOIN attendance_records ar ON cs.id = ar.session_id AND ar.student_id = s.id
      WHERE sub.id = ?
      GROUP BY s.id, sub.name
      HAVING percentage < 75 AND total >= 3
    `, [subjectId]);

    for (const student of students) {
      await db.query(
        `INSERT INTO notifications (user_id, title, message, type)
         VALUES (?, 'Attendance Shortage Alert', ?, 'shortage_alert')
         ON DUPLICATE KEY UPDATE created_at = created_at`,
        [student.user_id, `Your attendance in ${student.subject_name} is ${student.percentage}%, which is below the required 75%.`]
      );
    }
  } catch (err) {
    console.error('Shortage alert error:', err);
  }
}

module.exports = router;
