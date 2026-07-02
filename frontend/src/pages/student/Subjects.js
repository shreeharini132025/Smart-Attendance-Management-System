import React, { useEffect, useState } from 'react';
import { BookOpen, School, MapPin, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import api from '../../api/axios';
import toast from 'react-hot-toast';

export default function StudentSubjects() {
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/student/subjects')
      .then(r => setSubjects(r.data.data || []))
      .catch(() => toast.error('Failed to load subjects'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading-center"><div className="spinner-lg spinner" /><p style={{ color: 'var(--text-muted)' }}>Loading...</p></div>;

  // Split: subjects where attendance is already marked (attended > 0 in a completed session) vs active
  const attended = subjects.filter(s => parseInt(s.total_sessions) > 0 && parseInt(s.attended) >= 0 && parseInt(s.total_sessions) > 0 && s.percentage !== null);
  const active   = subjects.filter(s => !parseInt(s.total_sessions) || s.percentage === null);

  // Actually split properly: attended = has completed sessions with attendance recorded
  const completedSubjects = subjects.filter(s => parseInt(s.total_sessions) > 0);
  const pendingSubjects   = subjects.filter(s => !parseInt(s.total_sessions) || parseInt(s.total_sessions) === 0);

  const totalAttended = subjects.reduce((sum, s) => sum + (parseInt(s.attended) || 0), 0);
  const totalSessions = subjects.reduce((sum, s) => sum + (parseInt(s.total_sessions) || 0), 0);
  const overallPct = totalSessions > 0 ? Math.round((totalAttended / totalSessions) * 100) : 0;

  const SubjectCard = ({ s }) => {
    const p = parseFloat(s.percentage) || 0;
    const hasClasses = parseInt(s.total_sessions) > 0;
    const totalDays = parseInt(s.total_days) || 0;
    // Use actual sessions conducted as denominator (not days × 7)
    const conducted = parseInt(s.total_sessions) || 0;
    const attended = parseInt(s.attended) || 0;
    const color = !hasClasses ? '#6366f1' : p >= 75 ? '#10b981' : p >= 60 ? '#f59e0b' : '#ef4444';

    // Sessions still needed to reach 75% of conducted sessions
    const target75 = Math.ceil(0.75 * conducted);
    const needMore = hasClasses && attended < target75 ? target75 - attended : 0;

    // Per-session contribution to %
    const pctPerSession = conducted > 0 ? (100 / conducted).toFixed(2) : '0.00';

    return (
      <div className="card" style={{
        position: 'relative', overflow: 'hidden',
        border: `1px solid ${color}30`,
        display: 'flex', flexDirection: 'column', gap: 0,
      }}>
        {/* Top accent */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 3,
          background: !hasClasses ? 'var(--gradient-primary)'
            : p >= 75 ? 'linear-gradient(90deg,#10b981,#34d399)'
            : p >= 60 ? 'linear-gradient(90deg,#f59e0b,#fbbf24)'
            : 'linear-gradient(90deg,#ef4444,#f87171)'
        }} />

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10, paddingTop: 4 }}>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: '0.97rem', marginBottom: 8, lineHeight: 1.3 }}>{s.name || s.subject_name}</h3>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <span className="badge badge-info">{s.code}</span>
              <span className="badge badge-purple">{s.subject_type}</span>
              <span className="badge badge-success">{s.credits} Cr</span>
            </div>
          </div>
          <div style={{ textAlign: 'center', marginLeft: 12, flexShrink: 0 }}>
            {hasClasses ? (
              <>
                <div style={{ fontSize: '1.9rem', fontWeight: 900, color, lineHeight: 1 }}>{p}%</div>
                <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>Attendance</div>
              </>
            ) : (
              <div style={{ fontSize: '0.72rem', color: '#6366f1', fontWeight: 600, textAlign: 'center' }}>No classes<br />yet</div>
            )}
          </div>
        </div>

        {/* Faculty */}
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 4 }}>
          👨‍🏫 <strong style={{ color: 'var(--text-secondary)' }}>{s.faculty_name}</strong>
        </div>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 10 }}>{s.department_name}</div>

        {/* Classroom info */}
        {s.classroom_name && (
          <div style={{
            background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)',
            borderRadius: 'var(--radius-sm)', padding: '8px 12px', marginBottom: 12,
            display: 'flex', flexDirection: 'column', gap: 4,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <School size={13} color="var(--primary-light)" />
              <span style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--primary-light)' }}>{s.classroom_name}</span>
            </div>
            {s.classroom_room && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <MapPin size={12} color="var(--text-muted)" />
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Room: {s.classroom_room}</span>
              </div>
            )}
          </div>
        )}

        {/* Progress bar + Attendance breakdown */}
        {hasClasses && (
          <>
            <div className="progress-bar" style={{ marginBottom: 6 }}>
              <div className={`progress-fill ${p >= 75 ? 'good' : p >= 60 ? 'warn' : 'bad'}`}
                style={{ width: `${Math.min(p, 100)}%` }} />
            </div>

            {/* Main stat row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 6 }}>
              <span>Attended: <b style={{ color: 'var(--text-primary)' }}>{attended}</b> / {conducted} conducted</span>
              {p >= 75 && <span style={{ color: '#10b981', fontWeight: 600 }}>✅ On track</span>}
            </div>

            {/* Cumulative breakdown pill */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
              background: 'var(--bg-card2)', borderRadius: 'var(--radius-sm)',
              padding: '6px 10px', marginBottom: needMore > 0 ? 8 : 0,
              fontSize: '0.74rem', color: 'var(--text-muted)',
            }}>
              <span>📅 {totalDays} day{totalDays !== 1 ? 's' : ''} · {conducted} sessions conducted</span>
              <span style={{ color: color, fontWeight: 700 }}>
                +{pctPerSession}% per session
              </span>
            </div>
          </>
        )}

        {/* Shortage warning */}
        {needMore > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
            borderRadius: 'var(--radius-sm)', padding: '6px 10px',
            fontSize: '0.76rem', color: '#ef4444', fontWeight: 600,
          }}>
            <AlertCircle size={14} />
            Need {needMore} more session{needMore > 1 ? 's' : ''} to reach 75%
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      <div className="page-header">
        <h1>📚 My Subjects</h1>
        <p>Your enrolled subjects and attendance summary</p>
      </div>

      {subjects.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 48 }}>
          <div className="empty-state">
            <BookOpen size={52} style={{ opacity: 0.3, marginBottom: 12 }} />
            <h3>No subjects enrolled yet</h3>
            <p style={{ maxWidth: 360, margin: '8px auto 0' }}>
              Your subjects will appear here once the admin assigns you to a classroom. Contact your admin or faculty to get enrolled.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Overall Summary Bar */}
          {totalSessions > 0 && (
            <div style={{
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)', padding: '16px 24px', marginBottom: 24,
              display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
                <div style={{
                  width: 52, height: 52, borderRadius: '50%',
                  background: `conic-gradient(${overallPct >= 75 ? '#10b981' : overallPct >= 60 ? '#f59e0b' : '#ef4444'} ${overallPct * 3.6}deg, var(--bg-card2) 0deg)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: '50%', background: 'var(--bg-card)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 900, fontSize: '0.78rem',
                    color: overallPct >= 75 ? '#10b981' : overallPct >= 60 ? '#f59e0b' : '#ef4444'
                  }}>{overallPct}%</div>
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>Overall Attendance</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    {totalAttended} attended out of {totalSessions} total sessions
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontWeight: 800, fontSize: '1.3rem', color: 'var(--primary-light)' }}>{subjects.length}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Subjects</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontWeight: 800, fontSize: '1.3rem', color: '#10b981' }}>{subjects.filter(s => parseFloat(s.percentage) >= 75).length}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>On Track</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontWeight: 800, fontSize: '1.3rem', color: '#ef4444' }}>{subjects.filter(s => parseFloat(s.percentage) < 75 && parseInt(s.total_sessions) > 0).length}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Shortage</div>
                </div>
              </div>
            </div>
          )}

          {/* ── Section 1: Attended Sessions (completed) ─────── */}
          {completedSubjects.length > 0 && (
            <div style={{ marginBottom: 32 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <CheckCircle size={18} color="#10b981" />
                <span style={{ fontWeight: 700, fontSize: '1rem' }}>Attended Sessions</span>
                <span style={{
                  padding: '2px 10px', background: 'rgba(16,185,129,0.12)',
                  color: '#10b981', border: '1px solid rgba(16,185,129,0.3)',
                  borderRadius: 20, fontSize: '0.72rem', fontWeight: 700
                }}>{completedSubjects.length}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 18 }}>
                {completedSubjects.map(s => <SubjectCard key={s.id} s={s} />)}
              </div>
            </div>
          )}

          {/* ── Section 2: Pending / Not started yet ────────── */}
          {pendingSubjects.length > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <Clock size={18} color="#6366f1" />
                <span style={{ fontWeight: 700, fontSize: '1rem' }}>Upcoming Subjects</span>
                <span style={{
                  padding: '2px 10px', background: 'rgba(99,102,241,0.12)',
                  color: '#6366f1', border: '1px solid rgba(99,102,241,0.3)',
                  borderRadius: 20, fontSize: '0.72rem', fontWeight: 700
                }}>{pendingSubjects.length}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 18 }}>
                {pendingSubjects.map(s => <SubjectCard key={s.id} s={s} />)}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
