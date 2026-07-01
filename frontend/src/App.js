import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';

// Pages
import Login from './pages/Login';
import AdminDashboard from './pages/admin/Dashboard';
import AdminStudents from './pages/admin/Students';
import AdminFaculty from './pages/admin/Faculty';
import AdminSubjects from './pages/admin/Subjects';
import AdminDepartments from './pages/admin/Departments';
import AdminReports from './pages/admin/Reports';
import AdminClassrooms from './pages/admin/Classrooms';
import AdminSessions from './pages/admin/Sessions';
import FacultyDashboard from './pages/faculty/Dashboard';
import FacultySubjects from './pages/faculty/Subjects';
import FacultySessions from './pages/faculty/Sessions';
import FacultyAnalytics from './pages/faculty/Analytics';
import StudentDashboard from './pages/student/Dashboard';
import StudentAttendance from './pages/student/Attendance';
import StudentSubjects from './pages/student/Subjects';
import StudentNotifications from './pages/student/Notifications';
import Layout from './components/Layout';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-center"><div className="spinner-lg spinner" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(user.role)) return <Navigate to="/login" replace />;
  return children;
};

const RoleRedirect = () => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  const paths = { admin: '/admin/dashboard', faculty: '/faculty/dashboard', student: '/student/dashboard' };
  return <Navigate to={paths[user.role] || '/login'} replace />;
};

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <div className="bg-glow" />
          <Toaster
            position="top-right"
            toastOptions={{
              style: { background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border)' },
              success: { iconTheme: { primary: '#10b981', secondary: '#fff' } },
              error: { iconTheme: { primary: '#ef4444', secondary: '#fff' } }
            }}
          />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<RoleRedirect />} />

            {/* Admin Routes */}
            <Route path="/admin" element={<ProtectedRoute allowedRoles={['admin']}><Layout /></ProtectedRoute>}>
              <Route path="dashboard" element={<AdminDashboard />} />
              <Route path="students" element={<AdminStudents />} />
              <Route path="faculty" element={<AdminFaculty />} />
              <Route path="subjects" element={<AdminSubjects />} />
              <Route path="departments" element={<AdminDepartments />} />
              <Route path="classrooms" element={<AdminClassrooms />} />
              <Route path="sessions" element={<AdminSessions />} />
              <Route path="reports" element={<AdminReports />} />
            </Route>

            {/* Faculty Routes */}
            <Route path="/faculty" element={<ProtectedRoute allowedRoles={['faculty']}><Layout /></ProtectedRoute>}>
              <Route path="dashboard" element={<FacultyDashboard />} />
              <Route path="subjects" element={<FacultySubjects />} />
              <Route path="sessions" element={<FacultySessions />} />
              <Route path="analytics" element={<FacultyAnalytics />} />
            </Route>

            {/* Student Routes */}
            <Route path="/student" element={<ProtectedRoute allowedRoles={['student']}><Layout /></ProtectedRoute>}>
              <Route path="dashboard" element={<StudentDashboard />} />
              <Route path="attendance" element={<StudentAttendance />} />
              <Route path="subjects" element={<StudentSubjects />} />
              <Route path="notifications" element={<StudentNotifications />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
