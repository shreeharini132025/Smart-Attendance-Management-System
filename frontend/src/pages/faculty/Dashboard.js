import React, { useEffect, useState } from 'react';
import { BookOpen, Users, CalendarCheck, TrendingUp } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../../api/axios';
import toast from 'react-hot-toast';

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload?.length) return (
    <div style={{ background: 'var(--bg-card2)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px' }}>
      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{label}</p>
      {payload.map((p, i) => <p key={i} style={{ fontSize: '0.875rem', color: p.color, fontWeight: 600 }}>{p.name}: {p.value}</p>)}
    </div>
  );
  return null;
};

export default function FacultyDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/faculty/dashboard')
      .then(r => setData(r.data))
      .catch(() => toast.error('Failed to load dashboard'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading-center"><div className="spinner-lg spinner" /><p style={{ color: 'var(--text-muted)' }}>Loading...</p></div>;

  const stats = data?.stats || {};
  const statCards = [
    { label: 'My Subjects', value: stats.totalSubjects || 0, icon: BookOpen, gradient: 'linear-gradient(135deg,#6366f1,#818cf8)', glow: '#6366f1' },
    { label: "Today's Sessions", value: stats.todaySessions || 0, icon: CalendarCheck, gradient: 'linear-gradient(135deg,#10b981,#34d399)', glow: '#10b981' },
    { label: 'Total Students', value: stats.totalStudents || 0, icon: Users, gradient: 'linear-gradient(135deg,#f59e0b,#fbbf24)', glow: '#f59e0b' },
  ];

  return (
    <div>
      <div className="page-header">
        <h1>🎓 Faculty Dashboard</h1>
        <p>Manage your classes and track attendance</p>
      </div>

      <div className="stats-grid">
        {statCards.map((s, i) => (
          <div key={i} className="stat-card" style={{ '--glow': s.glow }}>
            <div className="stat-icon" style={{ background: s.gradient, boxShadow: `0 4px 15px ${s.glow}40` }}>
              <s.icon size={24} color="white" />
            </div>
            <div className="stat-info">
              <h3>{s.value}</h3>
              <p>{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
        {/* Subject overview */}
        <div className="card">
          <h3 style={{ fontSize: '1rem', marginBottom: 16 }}>📚 Subject Overview</h3>
          {!data?.subjectOverview?.length ? (
            <div className="empty-state" style={{ padding: 30 }}><p>No subjects assigned yet</p></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {data.subjectOverview.map((s, i) => {
                const pct = s.total_records > 0 ? Math.round((s.total_present / s.total_records) * 100) : 0;
                return (
                  <div key={i} style={{ padding: '12px', background: 'var(--bg-card2)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{s.subject_name}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{s.code} · {s.total_sessions} sessions</div>
                      </div>
                      <span style={{ fontWeight: 800, color: pct >= 75 ? '#10b981' : '#ef4444', fontSize: '1rem' }}>{pct}%</span>
                    </div>
                    <div className="progress-bar">
                      <div className={`progress-fill ${pct >= 75 ? 'good' : pct >= 60 ? 'warn' : 'bad'}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent Sessions */}
        <div className="card">
          <h3 style={{ fontSize: '1rem', marginBottom: 16 }}>🕐 Recent Sessions</h3>
          {!data?.recentAttendance?.length ? (
            <div className="empty-state" style={{ padding: 30 }}><p>No sessions yet</p></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {data.recentAttendance.map((s, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'var(--bg-card2)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{s.subject_name}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {new Date(s.session_date).toLocaleDateString('en-IN')} · Hour {s.hour_number}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, color: '#10b981' }}>{s.present_count}/{s.total_enrolled || '?'}</div>
                    <span className={`badge ${s.status === 'completed' ? 'badge-success' : s.status === 'active' ? 'badge-warning' : 'badge-info'}`} style={{ fontSize: '0.65rem' }}>{s.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
