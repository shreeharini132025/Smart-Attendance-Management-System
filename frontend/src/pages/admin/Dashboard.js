import React, { useEffect, useState } from 'react';
import { Users, GraduationCap, BookOpen, Building2, CalendarCheck, TrendingUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line, AreaChart, Area } from 'recharts';
import api from '../../api/axios';
import toast from 'react-hot-toast';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#8b5cf6'];

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload?.length) {
    return (
      <div style={{ background: 'var(--bg-card2)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px' }}>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 4 }}>{label}</p>
        {payload.map((p, i) => (
          <p key={i} style={{ fontSize: '0.875rem', color: p.color, fontWeight: 600 }}>{p.name}: {p.value}</p>
        ))}
      </div>
    );
  }
  return null;
};

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/admin/dashboard')
      .then(r => setData(r.data))
      .catch(() => toast.error('Failed to load dashboard data'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading-center"><div className="spinner-lg spinner" /><p style={{ color: 'var(--text-muted)' }}>Loading dashboard...</p></div>;

  const stats = data?.stats || {};
  const statCards = [
    { label: 'Total Students', value: stats.totalStudents || 0, icon: Users, gradient: 'linear-gradient(135deg,#6366f1,#818cf8)', glow: '#6366f1' },
    { label: 'Total Faculty', value: stats.totalFaculty || 0, icon: GraduationCap, gradient: 'linear-gradient(135deg,#10b981,#34d399)', glow: '#10b981' },
    { label: 'Subjects', value: stats.totalSubjects || 0, icon: BookOpen, gradient: 'linear-gradient(135deg,#f59e0b,#fbbf24)', glow: '#f59e0b' },
    { label: 'Departments', value: stats.totalDepts || 0, icon: Building2, gradient: 'linear-gradient(135deg,#06b6d4,#38bdf8)', glow: '#06b6d4' },
    { label: "Today's Sessions", value: stats.todaySessions || 0, icon: CalendarCheck, gradient: 'linear-gradient(135deg,#8b5cf6,#a78bfa)', glow: '#8b5cf6' },
    { label: 'Total Present', value: stats.totalAttendance || 0, icon: TrendingUp, gradient: 'linear-gradient(135deg,#ef4444,#f87171)', glow: '#ef4444' },
  ];

  const deptChartData = (data?.deptAttendance || []).map(d => ({
    name: d.code,
    present: d.present,
    total: d.total,
    percentage: d.total > 0 ? Math.round((d.present / d.total) * 100) : 0
  }));

  const weeklyData = (data?.weeklyTrend || []).map(d => ({
    date: new Date(d.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
    sessions: d.total_sessions,
    present: d.present_count
  }));

  return (
    <div>
      <div className="page-header">
        <h1>Admin Dashboard</h1>
        <p>Welcome back! Here's an overview of the system.</p>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        {statCards.map((s, i) => (
          <div key={i} className="stat-card" style={{ '--glow': s.glow }}>
            <div className="stat-icon" style={{ background: s.gradient, boxShadow: `0 4px 15px ${s.glow}40` }}>
              <s.icon size={24} color="white" />
            </div>
            <div className="stat-info">
              <h3>{s.value.toLocaleString()}</h3>
              <p>{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
        {/* Weekly trend */}
        <div className="card">
          <h3 style={{ marginBottom: 16, fontSize: '1rem' }}>📈 Weekly Attendance Trend</h3>
          {weeklyData.length === 0 ? (
            <div className="empty-state" style={{ padding: 40 }}><p>No session data this week</p></div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={weeklyData}>
                <defs>
                  <linearGradient id="colorPresent" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,102,241,0.1)" />
                <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="present" stroke="#6366f1" fill="url(#colorPresent)" name="Present" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Dept-wise */}
        <div className="card">
          <h3 style={{ marginBottom: 16, fontSize: '1rem' }}>🏛️ Department-wise Attendance</h3>
          {deptChartData.length === 0 ? (
            <div className="empty-state" style={{ padding: 40 }}><p>No department data</p></div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={deptChartData} barSize={24}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,102,241,0.1)" />
                <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="percentage" name="Attendance %" radius={[4, 4, 0, 0]}>
                  {deptChartData.map((_, idx) => (
                    <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Recent Sessions Table */}
      <div className="card">
        <div className="section-header">
          <span className="section-title">🕐 Recent Sessions</span>
        </div>
        {!data?.recentSessions?.length ? (
          <div className="empty-state"><p>No sessions recorded yet</p></div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Faculty</th>
                  <th>Department</th>
                  <th>Date</th>
                  <th>Hour</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.recentSessions.map(s => (
                  <tr key={s.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{s.subject_name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{s.subject_code}</div>
                    </td>
                    <td>{s.faculty_name}</td>
                    <td>{s.department_name}</td>
                    <td>{new Date(s.session_date).toLocaleDateString('en-IN')}</td>
                    <td>Hour {s.hour_number}</td>
                    <td>
                      <span className={`badge ${s.status === 'completed' ? 'badge-success' : s.status === 'active' ? 'badge-warning' : 'badge-info'}`}>
                        {s.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
