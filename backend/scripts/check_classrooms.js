require('dotenv').config();
const db = require('../config/database');

(async () => {
  try {
    const [rows] = await db.query('SELECT * FROM classrooms');
    console.log('Classrooms in DB:', JSON.stringify(rows, null, 2));
  } catch (err) {
    console.error('Query failed:', err.message);
  }
  process.exit(0);
})();
