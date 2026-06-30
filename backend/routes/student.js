const express = require('express');
const db = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate, authorize('student'));

// ── GET /api/student/dashboard ──────────────────────────────
router.get('/dashboard', async (req, res) => {
  try {
    const [studentRows] = await db.query('SELECT id FROM students WHERE user_id = ?', [req.user.id]);
    if (!studentRows.length) return res.status(404).json({ success: false, message: 'Student profile not found.' });
    const studentId = studentRows[0].id;

    const [[{ enrolledSubjects }]] = await db.query(
      'SELECT COUNT(*) AS enrolledSubjects FROM student_enrollments WHERE student_id = ?', [studentId]
    );

    // Overall attendance
    const [[overallStats]] = await db.query(`
      SELECT 
        COUNT(DISTINCT cs.id) AS total_sessions,
        COUNT(CASE WHEN ar.status='present' THEN 1 END) AS attended_sessions,
        ROUND(COUNT(CASE WHEN ar.status='present' THEN 1 END) * 100.0 / NULLIF(COUNT(DISTINCT cs.id), 0), 2) AS overall_percentage
      FROM student_enrollments se
      JOIN faculty_subjects fs ON se.subject_id = fs.subject_id
      JOIN class_sessions cs ON fs.id = cs.faculty_subject_id AND cs.status = 'completed'
      LEFT JOIN attendance_records ar ON cs.id = ar.session_id AND ar.student_id = ?
      WHERE se.student_id = ?
    `, [studentId, studentId]);

    // Subject-wise attendance
    const [subjectAttendance] = await db.query(`
      SELECT sub.id, sub.name AS subject_name, sub.code, sub.credits,
             COUNT(DISTINCT cs.id) AS total_sessions,
             COUNT(CASE WHEN ar.status='present' THEN 1 END) AS attended,
             ROUND(COUNT(CASE WHEN ar.status='present' THEN 1 END) * 100.0 / NULLIF(COUNT(DISTINCT cs.id), 0), 2) AS percentage
      FROM student_enrollments se
      JOIN subjects sub ON se.subject_id = sub.id
      JOIN faculty_subjects fs ON sub.id = fs.subject_id
      LEFT JOIN class_sessions cs ON fs.id = cs.faculty_subject_id AND cs.status = 'completed'
      LEFT JOIN attendance_records ar ON cs.id = ar.session_id AND ar.student_id = ?
      WHERE se.student_id = ?
      GROUP BY sub.id, sub.name, sub.code, sub.credits
      ORDER BY percentage ASC
    `, [studentId, studentId]);

    // Recent attendance history
    const [recentHistory] = await db.query(`
      SELECT ar.status, ar.marked_at, ar.verification_method,
             cs.session_date, cs.hour_number, cs.start_time,
             sub.name AS subject_name, sub.code
      FROM attendance_records ar
      JOIN class_sessions cs ON ar.session_id = cs.id
      JOIN faculty_subjects fs ON cs.faculty_subject_id = fs.id
      JOIN subjects sub ON fs.subject_id = sub.id
      WHERE ar.student_id = ?
      ORDER BY cs.session_date DESC, cs.hour_number DESC LIMIT 10
    `, [studentId]);

    // Unread notifications
    const [notifications] = await db.query(
      'SELECT * FROM notifications WHERE user_id = ? AND is_read = 0 ORDER BY created_at DESC LIMIT 5',
      [req.user.id]
    );

    res.json({
      success: true,
      stats: { enrolledSubjects, ...overallStats },
      subjectAttendance,
      recentHistory,
      notifications
    });
  } catch (err) {
    console.error('Student dashboard error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── POST /api/student/attendance/mark ──────────────────────
// Accepts: { qr_token, otp } — used when student scans QR then enters OTP
router.post('/attendance/mark', async (req, res) => {
  try {
    const [studentRows] = await db.query('SELECT id FROM students WHERE user_id = ?', [req.user.id]);
    if (!studentRows.length) return res.status(404).json({ success: false, message: 'Student profile not found.' });
    const studentId = studentRows[0].id;

    const { qr_token, otp, device_fingerprint, latitude, longitude } = req.body;

    if (!qr_token || !otp) {
      return res.status(400).json({ success: false, message: 'QR token and OTP are required.' });
    }

    // Find active session by QR token
    const [sessions] = await db.query(`
      SELECT cs.*, fs.subject_id FROM class_sessions cs
      JOIN faculty_subjects fs ON cs.faculty_subject_id = fs.id
      WHERE cs.qr_token = ? AND cs.status = 'active'
    `, [qr_token]);

    if (!sessions.length) {
      return res.status(400).json({ success: false, message: 'Invalid QR code or session is not active.' });
    }

    const session = sessions[0];

    if (new Date() > new Date(session.otp_expires_at)) {
      return res.status(400).json({ success: false, message: 'OTP has expired. Please ask faculty to regenerate.' });
    }
    if (session.otp_code !== otp) {
      return res.status(400).json({ success: false, message: 'Incorrect OTP. Please try again.' });
    }

    return await _recordAttendance(res, session, studentId, otp, device_fingerprint, latitude, longitude, req.ip);
  } catch (err) {
    console.error('Mark attendance error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── POST /api/student/attendance/mark-otp ──────────────────
// Accepts: { otp } — student enters only OTP (no QR scan needed)
router.post('/attendance/mark-otp', async (req, res) => {
  try {
    const [studentRows] = await db.query(
      'SELECT s.id, s.semester_id FROM students s WHERE s.user_id = ?',
      [req.user.id]
    );
    if (!studentRows.length) return res.status(404).json({ success: false, message: 'Student profile not found.' });
    const studentId = studentRows[0].id;
    const studentSemesterId = studentRows[0].semester_id;

    const { otp, device_fingerprint, latitude, longitude } = req.body;

    if (!otp || String(otp).trim().length !== 6) {
      return res.status(400).json({ success: false, message: 'A valid 6-digit OTP is required.' });
    }

    // Find an active session whose OTP matches AND hasn't expired yet
    const [sessions] = await db.query(`
      SELECT cs.*, fs.subject_id, fs.semester_id AS fs_semester_id, fs.faculty_id AS session_faculty_id
      FROM class_sessions cs
      JOIN faculty_subjects fs ON cs.faculty_subject_id = fs.id
      WHERE cs.otp_code = ?
        AND cs.status = 'active'
        AND cs.otp_expires_at IS NOT NULL
        AND NOW() <= cs.otp_expires_at
    `, [String(otp).trim()]);

    if (!sessions.length) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP. Please check with your faculty.' });
    }

    const session = sessions[0];

    // ── Classroom restriction check ──────────────────────────
    // If classrooms are configured, this student must be in a classroom
    // assigned to the faculty who owns this session.
    const [classroomCheck] = await db.query(`
      SELECT cr.id FROM classrooms cr
      JOIN classroom_students cs2 ON cr.id = cs2.classroom_id
      WHERE cr.faculty_id = ? AND cs2.student_id = ? AND cr.is_active = 1
    `, [session.session_faculty_id, studentId]);

    // Count total active classrooms for this faculty to know if restriction is enforced
    const [[{ facultyClassroomCount }]] = await db.query(
      'SELECT COUNT(*) AS facultyClassroomCount FROM classrooms WHERE faculty_id = ? AND is_active = 1',
      [session.session_faculty_id]
    );

    if (facultyClassroomCount > 0 && !classroomCheck.length) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You are not assigned to this faculty\'s classroom.'
      });
    }

    // Auto-enroll if not already enrolled (so attendance history works)
    await db.query(
      'INSERT IGNORE INTO student_enrollments (student_id, subject_id, semester_id) VALUES (?, ?, ?)',
      [studentId, session.subject_id, session.fs_semester_id || studentSemesterId]
    );

    return await _recordAttendance(res, session, studentId, String(otp).trim(), device_fingerprint, latitude, longitude, req.ip, 'otp');
  } catch (err) {
    console.error('Mark attendance (OTP) error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── POST /api/student/attendance/mark-qr ──────────────────
// Accepts: { qr_token } — from QR code scan, marks present immediately if session is active
router.post('/attendance/mark-qr', async (req, res) => {
  try {
    const [studentRows] = await db.query(
      'SELECT s.id, s.semester_id FROM students s WHERE s.user_id = ?',
      [req.user.id]
    );
    if (!studentRows.length) return res.status(404).json({ success: false, message: 'Student profile not found.' });
    const studentId = studentRows[0].id;
    const studentSemesterId = studentRows[0].semester_id;

    const { qr_token, device_fingerprint, latitude, longitude } = req.body;

    if (!qr_token) {
      return res.status(400).json({ success: false, message: 'QR token is required.' });
    }

    // Find active session by QR token
    const [sessions] = await db.query(`
      SELECT cs.*, fs.subject_id, fs.semester_id AS fs_semester_id, fs.faculty_id AS session_faculty_id
      FROM class_sessions cs
      JOIN faculty_subjects fs ON cs.faculty_subject_id = fs.id
      WHERE cs.qr_token = ? AND cs.status = 'active'
    `, [qr_token]);

    if (!sessions.length) {
      return res.status(400).json({ success: false, message: 'Invalid QR code or session is not active.' });
    }

    const session = sessions[0];

    // ── Classroom restriction check ──────────────────────────
    const [classroomCheck] = await db.query(`
      SELECT cr.id FROM classrooms cr
      JOIN classroom_students cs2 ON cr.id = cs2.classroom_id
      WHERE cr.faculty_id = ? AND cs2.student_id = ? AND cr.is_active = 1
    `, [session.session_faculty_id, studentId]);

    const [[{ facultyClassroomCount }]] = await db.query(
      'SELECT COUNT(*) AS facultyClassroomCount FROM classrooms WHERE faculty_id = ? AND is_active = 1',
      [session.session_faculty_id]
    );

    if (facultyClassroomCount > 0 && !classroomCheck.length) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You are not assigned to this faculty\'s classroom.'
      });
    }

    // Auto-enroll if not already enrolled (so attendance history works)
    await db.query(
      'INSERT IGNORE INTO student_enrollments (student_id, subject_id, semester_id) VALUES (?, ?, ?)',
      [studentId, session.subject_id, session.fs_semester_id || studentSemesterId]
    );

    return await _recordAttendance(res, session, studentId, null, device_fingerprint, latitude, longitude, req.ip, 'qr');
  } catch (err) {
    console.error('Mark attendance (QR) error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// Shared helper: upsert attendance record as 'present'
async function _recordAttendance(res, session, studentId, otp, device_fingerprint, latitude, longitude, ip, method = 'otp') {
  // 1. Check if this student already marked present for this session
  const [existing] = await db.query(
    'SELECT id, status FROM attendance_records WHERE session_id = ? AND student_id = ?',
    [session.id, studentId]
  );

  if (existing.length && existing[0].status === 'present') {
    return res.status(400).json({ success: false, message: 'Attendance already marked as present for this session.' });
  }

  // 2. Device fingerprint check (only if this device hasn't been used for a DIFFERENT student)
  if (device_fingerprint) {
    const [deviceCheck] = await db.query(
      'SELECT id FROM attendance_records WHERE session_id = ? AND device_fingerprint = ? AND student_id != ?',
      [session.id, device_fingerprint, studentId]
    );
    if (deviceCheck.length) {
      return res.status(400).json({ success: false, message: 'Another student has already marked attendance from this device.' });
    }
  }

  // 3. Upsert the attendance record
  if (existing.length) {
    await db.query(
      `UPDATE attendance_records
       SET status='present', marked_at=NOW(), otp_used=?, device_fingerprint=?,
           ip_address=?, latitude=?, longitude=?, verification_method=?, marked_by='student'
       WHERE id=?`,
      [otp, device_fingerprint, ip, latitude, longitude, method, existing[0].id]
    );
  } else {
    await db.query(
      `INSERT INTO attendance_records
         (session_id, student_id, status, marked_at, otp_used, device_fingerprint, ip_address, latitude, longitude, verification_method, marked_by)
       VALUES (?, ?, 'present', NOW(), ?, ?, ?, ?, ?, ?, 'student')`,
      [session.id, studentId, otp, device_fingerprint, ip, latitude, longitude, method]
    );
  }

  return res.json({ success: true, message: '✅ Attendance marked successfully!' });
}



// ── GET /api/student/attendance/history ────────────────────
router.get('/attendance/history', async (req, res) => {
  try {
    const [studentRows] = await db.query('SELECT id FROM students WHERE user_id = ?', [req.user.id]);
    const studentId = studentRows[0].id;

    const { subject_id, from_date, to_date } = req.query;
    let query = `
      SELECT ar.status, ar.marked_at, ar.verification_method, ar.remarks,
             cs.session_date, cs.hour_number, cs.start_time, cs.end_time,
             sub.name AS subject_name, sub.code
      FROM attendance_records ar
      JOIN class_sessions cs ON ar.session_id = cs.id
      JOIN faculty_subjects fs ON cs.faculty_subject_id = fs.id
      JOIN subjects sub ON fs.subject_id = sub.id
      WHERE ar.student_id = ?
    `;
    const params = [studentId];

    if (subject_id) { query += ' AND sub.id = ?'; params.push(subject_id); }
    if (from_date) { query += ' AND cs.session_date >= ?'; params.push(from_date); }
    if (to_date) { query += ' AND cs.session_date <= ?'; params.push(to_date); }
    query += ' ORDER BY cs.session_date DESC, cs.hour_number DESC';

    const [rows] = await db.query(query, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── GET /api/student/subjects ───────────────────────────────
router.get('/subjects', async (req, res) => {
  try {
    const [studentRows] = await db.query('SELECT id FROM students WHERE user_id = ?', [req.user.id]);
    if (!studentRows.length) return res.status(404).json({ success: false, message: 'Student profile not found.' });
    const studentId = studentRows[0].id;

    const [rows] = await db.query(`
      SELECT sub.id, sub.name, sub.name AS subject_name,
             sub.code, sub.credits, sub.subject_type,
             MAX(f.id) AS faculty_id, MAX(u.name) AS faculty_name, MAX(d.name) AS department_name,
             MAX(cl.name) AS classroom_name, MAX(cl.room_number) AS classroom_room,
             COUNT(DISTINCT cs.id) AS total_sessions,
             COUNT(DISTINCT cs.session_date) AS total_days,
             COUNT(DISTINCT cs.session_date) * 7 AS total_possible,
             COUNT(CASE WHEN ar.status='present' THEN 1 END) AS attended,
             ROUND(
               COUNT(CASE WHEN ar.status='present' THEN 1 END) * 100.0
               / NULLIF(COUNT(DISTINCT cs.session_date) * 7, 0),
             2) AS percentage
      FROM student_enrollments se
      JOIN subjects sub ON se.subject_id = sub.id
      JOIN faculty_subjects fs ON sub.id = fs.subject_id
      JOIN faculty f ON fs.faculty_id = f.id
      JOIN users u ON f.user_id = u.id
      JOIN departments d ON sub.department_id = d.id
      LEFT JOIN classrooms cl ON cl.subject_id = sub.id
                              AND cl.faculty_id = fs.faculty_id
                              AND cl.is_active = 1
                              AND EXISTS (
                                SELECT 1 FROM classroom_students c_s
                                WHERE c_s.classroom_id = cl.id AND c_s.student_id = se.student_id
                              )
      LEFT JOIN class_sessions cs ON fs.id = cs.faculty_subject_id AND cs.status = 'completed'
      LEFT JOIN attendance_records ar ON cs.id = ar.session_id AND ar.student_id = ?
      WHERE se.student_id = ?
      GROUP BY sub.id, sub.name, sub.code, sub.credits, sub.subject_type
    `, [studentId, studentId]);

    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Student subjects error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── GET /api/student/notifications ─────────────────────────
router.get('/notifications', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 20',
      [req.user.id]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

router.put('/notifications/:id/read', async (req, res) => {
  try {
    await db.query('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    res.json({ success: true, message: 'Notification marked as read.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

router.put('/notifications/read-all', async (req, res) => {
  try {
    await db.query('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [req.user.id]);
    res.json({ success: true, message: 'All notifications marked as read.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── GET /api/student/profile ────────────────────────────────
router.get('/profile', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT s.*, u.name, u.email, u.phone, u.profile_image, u.last_login,
             d.name AS department_name, sem.name AS semester_name
      FROM students s
      JOIN users u ON s.user_id = u.id
      JOIN departments d ON s.department_id = d.id
      JOIN semesters sem ON s.semester_id = sem.id
      WHERE s.user_id = ?
    `, [req.user.id]);
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
