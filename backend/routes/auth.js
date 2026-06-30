const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { OAuth2Client } = require('google-auth-library');
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// ── POST /api/auth/login ────────────────────────────────────
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  try {
    const { email, password } = req.body;
    const [rows] = await db.query('SELECT * FROM users WHERE email = ? AND is_active = 1', [email]);

    if (!rows.length) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const user = rows[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    // Update last login
    await db.query('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);

    // Fetch role-specific details
    let profileData = {};
    if (user.role === 'faculty') {
      const [fRows] = await db.query(
        `SELECT f.*, d.name AS department_name FROM faculty f 
         JOIN departments d ON f.department_id = d.id WHERE f.user_id = ?`, [user.id]
      );
      if (fRows.length) profileData = fRows[0];
    } else if (user.role === 'student') {
      const [sRows] = await db.query(
        `SELECT s.*, d.name AS department_name, sem.name AS semester_name 
         FROM students s 
         JOIN departments d ON s.department_id = d.id
         JOIN semesters sem ON s.semester_id = sem.id
         WHERE s.user_id = ?`, [user.id]
      );
      if (sRows.length) profileData = sRows[0];
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    const { password: _, ...safeUser } = user;

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: { ...safeUser, profile: profileData }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Server error during login.' });
  }
});

// ── POST /api/auth/change-password ─────────────────────────
router.post('/change-password', authenticate, [
  body('currentPassword').notEmpty(),
  body('newPassword').isLength({ min: 6 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  try {
    const { currentPassword, newPassword } = req.body;
    const [rows] = await db.query('SELECT password FROM users WHERE id = ?', [req.user.id]);
    
    const isMatch = await bcrypt.compare(currentPassword, rows[0].password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect.' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await db.query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, req.user.id]);

    res.json({ success: true, message: 'Password changed successfully.' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── GET /api/auth/me ────────────────────────────────────────
router.get('/me', authenticate, async (req, res) => {
  try {
    let profileData = {};
    if (req.user.role === 'faculty') {
      const [fRows] = await db.query(
        `SELECT f.*, d.name AS department_name FROM faculty f 
         JOIN departments d ON f.department_id = d.id WHERE f.user_id = ?`, [req.user.id]
      );
      if (fRows.length) profileData = fRows[0];
    } else if (req.user.role === 'student') {
      const [sRows] = await db.query(
        `SELECT s.*, d.name AS department_name, sem.name AS semester_name 
         FROM students s 
         JOIN departments d ON s.department_id = d.id
         JOIN semesters sem ON s.semester_id = sem.id
         WHERE s.user_id = ?`, [req.user.id]
      );
      if (sRows.length) profileData = sRows[0];
    }

    res.json({ success: true, user: { ...req.user, profile: profileData } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── POST /api/auth/google ────────────────────────────────────
router.post('/google', async (req, res) => {
  try {
    const { idToken } = req.body;
    if (!idToken) {
      return res.status(400).json({ success: false, message: 'Google ID token is required.' });
    }

    // Verify the Google ID token
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const { email, name, picture } = payload;

    // Look up the user by email (must already exist in the system)
    const [rows] = await db.query('SELECT * FROM users WHERE email = ? AND is_active = 1', [email]);
    if (!rows.length) {
      return res.status(401).json({
        success: false,
        message: 'No account found for this Google email. Please contact your administrator.',
      });
    }

    const user = rows[0];

    // Update last login
    await db.query('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);

    // Fetch role-specific details
    let profileData = {};
    if (user.role === 'faculty') {
      const [fRows] = await db.query(
        `SELECT f.*, d.name AS department_name FROM faculty f 
         JOIN departments d ON f.department_id = d.id WHERE f.user_id = ?`, [user.id]
      );
      if (fRows.length) profileData = fRows[0];
    } else if (user.role === 'student') {
      const [sRows] = await db.query(
        `SELECT s.*, d.name AS department_name, sem.name AS semester_name 
         FROM students s 
         JOIN departments d ON s.department_id = d.id
         JOIN semesters sem ON s.semester_id = sem.id
         WHERE s.user_id = ?`, [user.id]
      );
      if (sRows.length) profileData = sRows[0];
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    const { password: _, ...safeUser } = user;

    res.json({
      success: true,
      message: 'Google login successful',
      token,
      user: { ...safeUser, profile: profileData },
    });
  } catch (err) {
    console.error('Google login error:', err);
    res.status(401).json({ success: false, message: 'Invalid or expired Google token.' });
  }
});

module.exports = router;
