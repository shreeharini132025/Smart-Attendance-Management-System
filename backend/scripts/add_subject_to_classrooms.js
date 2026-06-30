require('dotenv').config();
const mysql = require('mysql2/promise');

async function migrate() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'smart_attendance_db',
  });

  console.log('Connected. Running subject_id migration for classrooms...');

  // Check if subject_id column exists
  const [cols] = await conn.execute('DESCRIBE classrooms');
  const hasSubjectId = cols.some(c => c.Field === 'subject_id');

  if (!hasSubjectId) {
    await conn.execute('ALTER TABLE classrooms ADD COLUMN subject_id INT NULL AFTER semester_id');
    console.log('✅ Added subject_id column to classrooms table');
    
    // Add foreign key constraint
    try {
      await conn.execute('ALTER TABLE classrooms ADD CONSTRAINT fk_classroom_subject FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE SET NULL');
      console.log('✅ Added foreign key constraint for subject_id');
    } catch (e) {
      console.log('⚠️ Constraint warning:', e.message);
    }
  } else {
    console.log('⏭️ subject_id column already exists in classrooms table');
  }

  await conn.end();
  console.log('Migration complete!');
}

migrate().catch(err => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
