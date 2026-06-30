# 🎓 Smart Attendance Management System

A comprehensive, modern web-based attendance management system built with **React.js**, **Node.js + Express.js**, and **MySQL**.

---

## 🏗️ Project Structure

```
Smart Attendance Management System/
├── backend/                  # Node.js + Express API
│   ├── config/database.js    # MySQL connection pool
│   ├── middleware/auth.js    # JWT authentication
│   ├── routes/
│   │   ├── auth.js           # Login, change password
│   │   ├── admin.js          # Admin CRUD routes
│   │   ├── faculty.js        # Faculty + OTP/QR routes
│   │   └── student.js        # Student attendance routes
│   ├── scripts/seed.js       # Demo data seeder
│   ├── server.js             # Express + Socket.IO server
│   └── .env                  # Environment config
├── database/schema.sql       # Full MySQL schema
└── frontend/                 # React.js application
    └── src/
        ├── pages/
        │   ├── admin/        # Dashboard, Students, Faculty, Subjects, Departments, Reports
        │   ├── faculty/      # Dashboard, Sessions (OTP+QR+Live), Subjects, Analytics
        │   └── student/      # Dashboard, Attendance (OTP flow), Subjects, Notifications
        ├── context/AuthContext.js
        ├── api/axios.js
        └── index.css         # Full design system
```

---

## 🚀 Setup Instructions

### 1. Database Setup
```sql
-- Open MySQL Workbench or CLI
mysql -u root -p
source database/schema.sql
```

### 2. Backend Setup
```bash
cd backend
# Edit .env and set your MySQL password
npm install
npm run seed       # Load demo data
npm run dev        # Start on http://localhost:5000
```

### 3. Frontend Setup
```bash
cd frontend
npm install
npm start          # Start on http://localhost:3000
```

---

## 🔐 Demo Credentials

| Role    | Email                         | Password     |
|---------|-------------------------------|--------------|
| Admin   | admin@smartattend.edu         | Admin@123    |
| Faculty | faculty@smartattend.edu       | Faculty@123  |
| Student | student@smartattend.edu       | Student@123  |

---

## ✨ Features

### Admin
- 📊 Dashboard with live stats & charts
- 🏛️ Department management (CRUD)
- 👨‍🏫 Faculty management
- 👨‍🎓 Student management  
- 📚 Subject management
- 📄 Attendance reports with CSV export

### Faculty
- 📅 Create hour-wise class sessions
- 🔑 Generate OTP (expires in 60 seconds)
- 📷 Generate QR Code for session
- 👁️ Live attendance monitoring via Socket.IO
- 📊 Analytics with shortage detection
- 🔒 Close sessions (auto-mark absent)

### Student
- 📱 Mark attendance via OTP (6-digit)
- 📊 Subject-wise attendance percentage
- ⚠️ Shortage alerts (<75%)
- 🔔 Notifications
- 📋 Attendance history

---

## 🛡️ Security Features
- JWT authentication with expiry
- bcrypt password hashing
- Rate limiting (500 req/15 min)
- Device fingerprint duplicate prevention
- Role-based route protection
- Helmet.js security headers

---

## 🧰 Tech Stack
- **Frontend**: React.js, React Router v6, Recharts, Socket.IO Client, React Hot Toast, Lucide Icons
- **Backend**: Node.js, Express.js, Socket.IO, JWT, bcryptjs, QRCode, node-cron
- **Database**: MySQL 8.0 with connection pooling
