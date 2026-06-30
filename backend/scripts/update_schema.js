const db = require('../config/database');

async function updateSchema() {
  console.log('🔄 Checking and updating schema...');
  try {
    // 1. Check if column assigned_classroom exists in students table
    const [columns] = await db.query("SHOW COLUMNS FROM students LIKE 'assigned_classroom'");
    if (columns.length === 0) {
      console.log('➕ Adding column "assigned_classroom" to students table...');
      await db.query("ALTER TABLE students ADD COLUMN assigned_classroom VARCHAR(50) NULL");
      console.log('✅ Column "assigned_classroom" added successfully.');
    } else {
      console.log('ℹ️ Column "assigned_classroom" already exists in students table.');
    }
    process.exit(0);
  } catch (err) {
    console.error('❌ Schema update failed:', err.message);
    process.exit(1);
  }
}

updateSchema();
