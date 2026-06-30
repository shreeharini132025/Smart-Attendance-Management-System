require('dotenv').config();
const mysql = require('mysql2/promise');

async function fix() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'smart_attendance_db',
  });

  console.log('Connected. Fixing classrooms table...');

  // Show current columns
  const [cols] = await conn.execute('DESCRIBE classrooms');
  console.log('Current columns:', cols.map(c => c.Field).join(', '));

  // The existing table is a physical rooms table. We need to ALTER it to add
  // the new columns needed for our classroom management feature.
  const colNames = cols.map(c => c.Field);

  const toAdd = [
    { name: 'semester_id', sql: 'ALTER TABLE classrooms ADD COLUMN semester_id INT NULL AFTER department_id' },
    { name: 'faculty_id', sql: 'ALTER TABLE classrooms ADD COLUMN faculty_id INT NULL AFTER semester_id' },
    { name: 'description', sql: 'ALTER TABLE classrooms ADD COLUMN description TEXT AFTER faculty_id' },
    { name: 'updated_at', sql: 'ALTER TABLE classrooms ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP' },
  ];

  for (const col of toAdd) {
    if (!colNames.includes(col.name)) {
      await conn.execute(col.sql);
      console.log(`✅ Added column: ${col.name}`);
    } else {
      console.log(`⏭️ Column already exists: ${col.name}`);
    }
  }

  // Add department_id if missing
  if (!colNames.includes('department_id')) {
    await conn.execute('ALTER TABLE classrooms ADD COLUMN department_id INT NULL');
    console.log('✅ Added column: department_id');
  }

  // Add FK for faculty_id if not exists
  try {
    await conn.execute('ALTER TABLE classrooms ADD CONSTRAINT fk_cl_faculty FOREIGN KEY (faculty_id) REFERENCES faculty(id) ON DELETE SET NULL');
    console.log('✅ Added FK faculty_id → faculty');
  } catch (e) {
    console.log('⏭️ FK faculty note:', e.message.substring(0, 80));
  }

  // Add FK for semester_id
  try {
    await conn.execute('ALTER TABLE classrooms ADD CONSTRAINT fk_cl_semester FOREIGN KEY (semester_id) REFERENCES semesters(id)');
    console.log('✅ Added FK semester_id → semesters');
  } catch (e) {
    console.log('⏭️ FK semester note:', e.message.substring(0, 80));
  }

  // Add FK for department_id
  try {
    await conn.execute('ALTER TABLE classrooms ADD CONSTRAINT fk_cl_dept FOREIGN KEY (department_id) REFERENCES departments(id)');
    console.log('✅ Added FK department_id → departments');
  } catch (e) {
    console.log('⏭️ FK dept note:', e.message.substring(0, 80));
  }

  // Check classroom_students
  const [tables] = await conn.execute("SHOW TABLES LIKE 'classroom_students'");
  if (!tables.length) {
    await conn.execute(`CREATE TABLE classroom_students (
      id INT AUTO_INCREMENT PRIMARY KEY,
      classroom_id INT NOT NULL,
      student_id INT NOT NULL,
      assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (classroom_id) REFERENCES classrooms(id) ON DELETE CASCADE,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
      UNIQUE KEY unique_student_classroom (classroom_id, student_id)
    )`);
    console.log('✅ Created classroom_students table');
  } else {
    console.log('⏭️ classroom_students already exists');
  }

  // Verify final structure
  const [finalCols] = await conn.execute('DESCRIBE classrooms');
  console.log('\nFinal classrooms columns:');
  finalCols.forEach(c => console.log(' -', c.Field, c.Type, c.Null));

  await conn.end();
  console.log('\n✅ Fix complete! Restart backend to apply.');
}

fix().catch(err => { console.error('Fix failed:', err.message); process.exit(1); });
