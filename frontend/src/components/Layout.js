import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import {
  LayoutDashboard, Users, BookOpen, Building2,
  FileText, GraduationCap, CalendarCheck, Bell, LogOut,
  ClipboardList, PieChart, Menu, X, School
} from 'lucide-react';
import toast from 'react-hot-toast';

const navConfigs = {
  admin: [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/admin/dashboard' },
    { label: 'Departments', icon: Building2, path: '/admin/departments' },
    { label: 'Faculty', icon: GraduationCap, path: '/admin/faculty' },
    { label: 'Students', icon: Users, path: '/admin/students' },
    { label: 'Subjects', icon: BookOpen, path: '/admin/subjects' },
    { label: 'Classrooms', icon: School, path: '/admin/classrooms' },
    { label: 'Sessions', icon: CalendarCheck, path: '/admin/sessions' },
    { label: 'Reports', icon: FileText, path: '/admin/reports' },
  ],
  faculty: [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/faculty/dashboard' },
    { label: 'My Subjects', icon: BookOpen, path: '/faculty/subjects' },
    { label: 'Sessions', icon: CalendarCheck, path: '/faculty/sessions' },
    { label: 'Analytics', icon: PieChart, path: '/faculty/analytics' },
  ],
  student: [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/student/dashboard' },
    { label: 'Mark Attendance', icon: ClipboardList, path: '/student/attendance' },
    { label: 'My Subjects', icon: BookOpen, path: '/student/subjects' },
    { label: 'Notifications', icon: Bell, path: '/student/notifications' },
  ],
};

const roleColors = {
  admin: 'var(--primary)',
  faculty: '#10b981',
  student: '#f59e0b',
};

const roleBadgeClass = {
  admin: 'badge-purple',
  faculty: 'badge-success',
  student: 'badge-warning',
};

export default function Layout() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully');
    navigate('/login');
  };

  const navItems = navConfigs[user?.role] || [];
  const initials = user?.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div className="app-layout">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 99 }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`sidebar${sidebarOpen ? ' open' : ''}`}>
        <div className="sidebar-logo">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '1px solid var(--border)', background: 'rgba(255, 255, 255, 0.05)' }}>
              <img src="/logo.png" alt="SmartAttend Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </div>
            <div>
              <h2>SmartAttend</h2>
              <p>Management System</p>
            </div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section-title">Navigation</div>
          {navItems.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
              onClick={() => setSidebarOpen(false)}
            >
              <item.icon size={18} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-badge">
            <div className="user-badge-avatar" style={{ background: roleColors[user?.role] || 'var(--gradient-primary)' }}>
              {initials}
            </div>
            <div className="user-badge-info">
              <div className="user-badge-name">{user?.name}</div>
              <div className="user-badge-role">
                <span className={`badge ${roleBadgeClass[user?.role]}`} style={{ fontSize: '0.65rem', padding: '1px 6px' }}>
                  {user?.role}
                </span>
              </div>
            </div>
            <button className="logout-btn" onClick={handleLogout} title="Logout">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="main-content">
        <header className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              style={{ display: 'none', background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', padding: 4 }}
              className="mobile-menu-btn"
            >
              {sidebarOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
            <span className="topbar-title">
              {user?.role === 'admin' ? '⚡ Admin Panel' :
               user?.role === 'faculty' ? '🎓 Faculty Portal' : '📚 Student Portal'}
            </span>
          </div>
          <div className="topbar-actions">
              <button
                className="theme-toggle"
                onClick={toggleTheme}
                title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                aria-label="Toggle theme"
              >
                {theme === 'dark' ? '☀️' : '🌙'}
              </button>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                {new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
              </div>
            </div>
        </header>

        <main className="page-content">
          <Outlet />
        </main>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .mobile-menu-btn { display: flex !important; }
        }
      `}</style>
    </div>
  );
}
