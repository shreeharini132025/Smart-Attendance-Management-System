import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, AreaChart, Area, Cell } from 'recharts';
import api from '../../api/axios';
import toast from 'react-hot-toast';

const COLORS = ['#6366f1','#10b981','#f59e0b','#ef4444','#06b6d4','#8b5cf6'];
const CT = ({ active, payload, label }) => active && payload?.length ? (
  <div style={{ background: 'var(--bg-card2)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px' }}>
    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{label}</p>
    {payload.map((p, i) => <p key={i} style={{ fontSize: '0.875rem', color: p.color, fontWeight: 600 }}>{p.name}: {p.value}</p>)}
  </div>
) : null;

export default function FacultyAnalytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/faculty/analytics')
      .then(r => setData(r.data))
      .catch(() => toast.error('Failed to load analytics'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading-center"><div className="spinner-lg spinner" /><p style={{ color: 'var(--text-muted)' }}>Loading...</p></div>;

  const subjectData = (data?.subjectWise || []).map(s => ({ name: s.code, avg: parseFloat(s.avg_percentage) || 0, students: s.total_students, sessions: s.total_sessions }));
  const dailyData = (data?.dailyTrend || []).map(d => ({ date: new Date(d.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }), sessions: d.sessions, present: d.present }));

  return (
    <div>
      <div className="page-header">
        <h1>📊 Analytics</h1>
        <p>Deep insights into attendance patterns</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
        <div className="card">
          <h3 style={{ fontSize: '1rem', marginBottom: 16 }}>📚 Subject-wise Average Attendance</h3>
          {subjectData.length === 0 ? <div className="empty-state" style={{ padding: 30 }}><p>No data available</p></div> : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={subjectData} barSize={28}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,102,241,0.1)" />
                <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                <YAxis domain={[0,100]} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                <Tooltip content={<CT />} />
                <Bar dataKey="avg" name="Avg %" radius={[4,4,0,0]}>
                  {subjectData.map((_, idx) => <Cell key={idx} fill={COLORS[idx % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card">
          <h3 style={{ fontSize: '1rem', marginBottom: 16 }}>📈 Daily Attendance Trend (30 days)</h3>
          {dailyData.length === 0 ? <div className="empty-state" style={{ padding: 30 }}><p>No trend data</p></div> : (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={dailyData}>
                <defs>
                  <linearGradient id="gPresent" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,102,241,0.1)" />
                <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                <Tooltip content={<CT />} />
                <Area type="monotone" dataKey="present" stroke="#10b981" fill="url(#gPresent)" name="Present" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Students with low attendance */}
      <div className="card">
        <div className="section-header">
          <span className="section-title" style={{ color: '#ef4444' }}>⚠️ Students Below 75% Attendance</span>
          <span className="badge badge-danger">{data?.lowAttendance?.length || 0} students</span>
        </div>
        {!data?.lowAttendance?.length ? (
          <div className="empty-state" style={{ padding: 30 }}>
            <span style={{ fontSize: '2rem' }}>🎉</span>
            <h3>No shortage alerts</h3>
            <p>All students have ≥75% attendance</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead><tr><th>Student</th><th>Roll No.</th><th>Subject</th><th>Sessions</th><th>Attended</th><th>Percentage</th></tr></thead>
              <tbody>
                {data.lowAttendance.map((s, i) => (
                  <tr key={i} style={{ background: 'rgba(239,68,68,0.04)' }}>
                    <td style={{ fontWeight: 600 }}>{s.student_name}</td>
                    <td><span className="badge badge-info">{s.roll_number}</span></td>
                    <td>{s.subject_name}</td>
                    <td>{s.total_sessions}</td>
                    <td>{s.attended}</td>
                    <td>
                      <span style={{ fontWeight: 800, color: '#ef4444', fontSize: '1rem' }}>{s.percentage ?? 0}%</span>
                      <div className="progress-bar" style={{ marginTop: 4 }}>
                        <div className="progress-fill bad" style={{ width: `${s.percentage || 0}%` }} />
                      </div>
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
