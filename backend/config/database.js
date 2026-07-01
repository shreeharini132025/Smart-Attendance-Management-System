const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// SSL certificate for TiDB Cloud (if available)
let sslConfig = undefined;
const certPath = path.join(__dirname, '../cert/isrgrootx1.pem');
if (fs.existsSync(certPath)) {
  sslConfig = { ca: fs.readFileSync(certPath) };
} else if (process.env.DB_HOST && process.env.DB_HOST.includes('tidbcloud')) {
  // For TiDB Cloud without local cert file - use system root CAs
  sslConfig = { rejectUnauthorized: true };
}

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'smart_attendance_db',
  waitForConnections: true,
  connectionLimit: 20,
  queueLimit: 0,
  timezone: '+05:30',
  dateStrings: false,
  ssl: sslConfig
});

// Test the connection
pool.getConnection()
  .then(conn => {
    console.log('✅ MySQL Database connected successfully');
    conn.release();
  })
  .catch(err => {
    console.error('❌ Database connection failed:', err.message);
    process.exit(1);
  });

module.exports = pool;
