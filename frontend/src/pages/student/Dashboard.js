import React, { useEffect, useState } from 'react';
import { BookOpen, TrendingUp, CalendarCheck, AlertTriangle } from 'lucide-react';
// recharts unused in this component
import api from '../../api/axios';
import toast from 'react-hot-toast';

function AttendanceRing({ pct }) {
  const p = parseFloat(pct) || 0;
  const cls = p >= 75 ? 'ring-good' : p >= 60 ? 'ring-warning' : 'ring-danger';
  return <div className={`attendance-ring ${cls}`}>{p}%</div>;
}

export default function StudentDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/student/dashboard')
      .then(r => setData(r.data))
      .catch(() => toast.error('Failed to load dashboard'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading-center"><div className="spinner-lg spinner" /><p style={{ color: 'var(--text-muted)' }}>Loading...</p></div>;

  const stats = data?.stats || {};
  const subjectAttendance = data?.subjectAttendance || [];
  const recentHistory = data?.recentHistory || [];
  const notifications = data?.notifications || [];

  const lowAttendance = subjectAttendance.filter(s => (parseFloat(s.percentage) || 0) < 75);

  return (
    <div>
      <div className="page-header">
        <h1>📚 Student Dashboard</h1>
        <p>Your attendance overview and recent activity</p>
      </div>

      {/* Shortage alerts */}
      {lowAttendance.length > 0 && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-lg)', padding: 16, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <AlertTriangle size={20} color="#ef4444" />
            <span style={{ fontWeight: 700, color: '#f87171' }}>Attendance Shortage Alert!</span>
          </div>
          <p style={{ fontSize: '0.875rem', color: '#fca5a5' }}>
            You have below 75% attendance in {lowAttendance.length} subject(s): {lowAttendance.map(s => s.subject_name).join(', ')}
          </p>
        </div>
      )}

      {/* Stats */}
      <div className="stats-grid">
        {[
          { label: 'Enrolled Subjects', value: stats.enrolledSubjects || 0, icon: BookOpen, gradient: 'linear-gradient(135deg,#6366f1,#818cf8)', glow: '#6366f1' },
          { label: 'Total Sessions', value: stats.total_sessions || 0, icon: CalendarCheck, gradient: 'linear-gradient(135deg,#10b981,#34d399)', glow: '#10b981' },
          { label: 'Sessions Attended', value: stats.attended_sessions || 0, icon: TrendingUp, gradient: 'linear-gradient(135deg,#f59e0b,#fbbf24)', glow: '#f59e0b' },
          { label: 'Overall Attendance', value: `${stats.overall_percentage || 0}%`, icon: TrendingUp, gradient: stats.overall_percentage >= 75 ? 'linear-gradient(135deg,#10b981,#34d399)' : 'linear-gradient(135deg,#ef4444,#f87171)', glow: stats.overall_percentage >= 75 ? '#10b981' : '#ef4444' },
        ].map((s, i) => (
          <div key={i} className="stat-card" style={{ '--glow': s.glow }}>
            <div className="stat-icon" style={{ background: s.gradient, boxShadow: `0 4px 15px ${s.glow}40` }}>
              <s.icon size={22} color="white" />
            </div>
            <div className="stat-info">
              <h3>{s.value}</h3>
              <p>{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Subject-wise attendance */}
        <div className="card">
          <h3 style={{ fontSize: '1rem', marginBottom: 16 }}>📊 Subject-wise Attendance</h3>
          {subjectAttendance.length === 0 ? (
            <div className="empty-state" style={{ padding: 30 }}><p>No subjects enrolled yet</p></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {subjectAttendance.map((s, i) => {
                const p = parseFloat(s.percentage) || 0;
                const color = p >= 75 ? '#10b981' : p >= 60 ? '#f59e0b' : '#ef4444';
                return (
                  <div key={i}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{s.subject_name}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{s.code} · {s.attended}/{s.total_sessions} sessions</div>
                      </div>
                      <span style={{ fontWeight: 800, color, fontSize: '1.1rem' }}>{p}%</span>
                    </div>
                    <div className="progress-bar">
                      <div className={`progress-fill ${p >= 75 ? 'good' : p >= 60 ? 'warn' : 'bad'}`} style={{ width: `${Math.min(p, 100)}%` }} />
                    </div>
                    {p < 75 && (
                      <div style={{ fontSize: '0.72rem', color: '#ef4444', marginTop: 3 }}>
                        ⚠️ Need {Math.max(0, Math.ceil(3 * parseInt(s.total_sessions) - 4 * parseInt(s.attended)))} more sessions for 75%
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent history */}
        <div className="card">
          <h3 style={{ fontSize: '1rem', marginBottom: 16 }}>🕐 Recent Attendance</h3>
          {recentHistory.length === 0 ? (
            <div className="empty-state" style={{ padding: 30 }}><p>No attendance records yet</p></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {recentHistory.map((r, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'var(--bg-card2)', borderRadius: 10, border: '1px solid var(--border)' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{r.subject_name}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {new Date(r.session_date).toLocaleDateString('en-IN')} · Hour {r.hour_number}
                    </div>
                  </div>
                  <span className={`badge ${r.status === 'present' ? 'badge-success' : r.status === 'late' ? 'badge-warning' : 'badge-danger'}`}>
                    {r.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Notifications */}
      {notifications.length > 0 && (
        <div className="card" style={{ marginTop: 20 }}>
          <h3 style={{ fontSize: '1rem', marginBottom: 16 }}>🔔 Recent Notifications</h3>
          {notifications.map((n, i) => (
            <div key={i} style={{ padding: '12px', background: 'var(--bg-card2)', borderRadius: 10, marginBottom: 8, border: `1px solid ${n.type === 'shortage_alert' ? 'rgba(239,68,68,0.2)' : 'var(--border)'}` }}>
              <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: 4 }}>{n.title}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{n.message}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
