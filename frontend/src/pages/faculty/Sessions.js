import React, { useEffect, useState, useCallback } from 'react';
import { Plus, RefreshCw, Users, CheckCircle, XCircle, Wifi, Clock, X, CalendarCheck, School, MapPin, BookOpen } from 'lucide-react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import io from 'socket.io-client';

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000';


function LiveSessionModal({ session, onClose, onRefresh }) {
  const [otpData, setOtpData] = useState(null);
  const [liveData, setLiveData] = useState(null);
  const [classroomStudents, setClassroomStudents] = useState([]);
  const [timeLeft, setTimeLeft] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [closing, setClosing] = useState(false);
  const [socket, setSocket] = useState(null);
  const [activeTab, setActiveTab] = useState('live'); // 'live' | 'classroom'

  useEffect(() => {
    const s = io(SOCKET_URL);
    s.emit('join_session', session.id);
    s.on('attendance_update', () => { loadLive(); loadClassroomStudents(); });
    setSocket(s);
    loadLive();
    loadClassroomStudents();
    return () => s.disconnect();
  }, [session.id]);

  const loadLive = useCallback(async () => {
    try {
      const res = await api.get(`/faculty/sessions/${session.id}/live`);
      setLiveData(res.data);
    } catch {}
  }, [session.id]);

  const loadClassroomStudents = useCallback(async () => {
    try {
      const res = await api.get(`/faculty/sessions/${session.id}/classroom-students`);
      setClassroomStudents(res.data.data || []);
    } catch {}
  }, [session.id]);

  useEffect(() => {
    const interval = setInterval(() => { loadLive(); loadClassroomStudents(); }, 5000);
    return () => clearInterval(interval);
  }, [loadLive, loadClassroomStudents]);

  useEffect(() => {
    if (!otpData?.expiresAt) return;
    const tick = setInterval(() => {
      const left = Math.max(0, Math.ceil((new Date(otpData.expiresAt) - Date.now()) / 1000));
      setTimeLeft(left);
      if (left === 0) { clearInterval(tick); setOtpData(null); }
    }, 1000);
    return () => clearInterval(tick);
  }, [otpData]);

  const generateOTP = async () => {
    setGenerating(true);
    try {
      const res = await api.post(`/faculty/sessions/${session.id}/generate-otp`);
      setOtpData(res.data);
      setTimeLeft(res.data.expiresIn);
      toast.success('OTP & QR Code generated!');
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
    finally { setGenerating(false); }
  };

  const closeSession = async () => {
    if (!window.confirm('Close this session? Remaining students will be marked absent.')) return;
    setClosing(true);
    try {
      await api.post(`/faculty/sessions/${session.id}/close`);
      toast.success('Session closed!');
      onClose(); onRefresh();
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
    finally { setClosing(false); }
  };

  const stats = liveData?.stats || {};
  const attendance = liveData?.attendance || [];
  const otpExpired = timeLeft === 0 && otpData;

  const statusColor = { present: '#10b981', absent: '#ef4444', pending: '#6366f1' };

  return (
    <div className="modal-overlay" style={{ alignItems: 'flex-start', paddingTop: 40 }}>
      <div className="modal" style={{ maxWidth: 860 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="live-dot" /> Live Session — {liveData?.session?.subject_name || 'Loading...'}
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 2 }}>
              Hour {session.hour_number}
            </p>
          </div>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
          {/* OTP / QR Section */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <button className="btn btn-primary" onClick={generateOTP} disabled={generating} style={{ width: '100%', justifyContent: 'center' }}>
              <RefreshCw size={16} className={generating ? 'spin' : ''} />
              {generating ? 'Generating...' : otpData ? 'Regenerate OTP & QR' : 'Generate OTP & QR Code'}
            </button>

            {otpData && !otpExpired && (
              <div style={{ background: 'var(--bg-card2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 16, textAlign: 'center' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600 }}>OTP CODE</div>
                <div className="otp-display">{otpData.otp}</div>
                <div className="otp-timer" style={{ color: timeLeft <= 10 ? '#ef4444' : 'var(--text-muted)' }}>
                  <Clock size={14} style={{ display: 'inline', marginRight: 4 }} />
                  Expires in {timeLeft}s
                </div>
                <div className="progress-bar" style={{ marginTop: 8 }}>
                  <div className={`progress-fill ${timeLeft > 30 ? 'good' : timeLeft > 10 ? 'warn' : 'bad'}`}
                    style={{ width: `${(timeLeft / (otpData.expiresIn || 60)) * 100}%`, transition: 'width 1s linear' }} />
                </div>
              </div>
            )}
            {otpExpired && <div style={{ textAlign: 'center', color: '#ef4444', fontSize: '0.875rem', fontWeight: 600 }}>⚠️ OTP Expired — Generate again</div>}

            {otpData && (
              <div className="qr-container" style={{ padding: 12 }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>QR CODE</div>
                <img src={otpData.qrCode} alt="QR Code" style={{ width: 180, height: 180, borderRadius: 8 }} />
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Students scan to open attendance page</p>
              </div>
            )}
          </div>

          {/* Right Panel — Live Stats */}
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              {[
                { label: 'Enrolled', value: classroomStudents.length || stats.total_enrolled || 0, color: '#6366f1' },
                { label: 'Present', value: stats.present || 0, color: '#10b981' },
                { label: 'Absent', value: classroomStudents.length ? classroomStudents.length - (stats.present || 0) : stats.absent || 0, color: '#ef4444' },
                { label: 'Attendance %', value: classroomStudents.length ? `${Math.round(((stats.present || 0) / classroomStudents.length) * 100)}%` : '0%', color: '#f59e0b' },
              ].map((s, i) => (
                <div key={i} style={{ padding: 12, background: 'var(--bg-card2)', borderRadius: 10, textAlign: 'center', border: `1px solid ${s.color}30` }}>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Tabs: Live vs Classroom roster */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 10, borderBottom: '1px solid var(--border)', paddingBottom: 4 }}>
              {[['live', '🔴 Live Feed'], ['classroom', `👥 Class Roster (${classroomStudents.length})`]].map(([key, label]) => (
                <button key={key} onClick={() => setActiveTab(key)} style={{
                  padding: '6px 12px', background: 'none', border: 'none', cursor: 'pointer',
                  borderBottom: activeTab === key ? '2px solid var(--primary)' : '2px solid transparent',
                  color: activeTab === key ? 'var(--primary)' : 'var(--text-muted)',
                  fontWeight: activeTab === key ? 600 : 400, fontSize: '0.8rem',
                }}>
                  {label}
                </button>
              ))}
            </div>

            <div style={{ maxHeight: 220, overflowY: 'auto' }}>
              {activeTab === 'live' ? (
                attendance.length === 0 ? (
                  <div className="empty-state" style={{ padding: 20 }}><p>Waiting for students...</p></div>
                ) : attendance.map((a, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: 'var(--bg-card2)', borderRadius: 8, marginBottom: 6, border: '1px solid var(--border)' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{a.student_name}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{a.roll_number}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {a.status === 'present' ? <CheckCircle size={18} color="#10b981" /> : <XCircle size={18} color="#ef4444" />}
                      <span className={`badge ${a.status === 'present' ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '0.65rem' }}>{a.status}</span>
                    </div>
                  </div>
                ))
              ) : (
                classroomStudents.length === 0 ? (
                  <div className="empty-state" style={{ padding: 20 }}>
                    <Users size={28} style={{ opacity: 0.3 }} />
                    <p>No students in classroom roster</p>
                  </div>
                ) : classroomStudents.map((s, i) => {
                  const statusC = statusColor[s.attendance_status] || '#6366f1';
                  return (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: 'var(--bg-card2)', borderRadius: 8, marginBottom: 6, border: `1px solid ${statusC}25` }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{s.name}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{s.roll_number} · {s.department_name}</div>
                      </div>
                      <span style={{
                        padding: '2px 10px', borderRadius: 20, fontSize: '0.68rem', fontWeight: 700,
                        background: `${statusC}20`, color: statusC, border: `1px solid ${statusC}40`
                      }}>
                        {s.attendance_status === 'pending' ? '⏳ pending' : s.attendance_status === 'present' ? '✅ present' : '❌ absent'}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
          <button className="btn btn-outline" onClick={onClose}>Keep Open</button>
          <button className="btn btn-danger" onClick={closeSession} disabled={closing}>{closing ? 'Closing...' : '🔒 Close Session'}</button>
        </div>
      </div>
    </div>
  );
}

export default function FacultySessions() {
  const [sessions, setSessions] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [classrooms, setClassrooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [liveSession, setLiveSession] = useState(null);
  const [startingSession, setStartingSession] = useState(null);
  const [filters, setFilters] = useState({ from_date: '', to_date: '', faculty_subject_id: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams(Object.fromEntries(Object.entries(filters).filter(([, v]) => v)));
      const [sRes, subRes, crRes] = await Promise.all([
        api.get(`/faculty/sessions?${params}`),
        api.get('/faculty/subjects?all=true'),
        api.get('/faculty/classrooms'),
      ]);
      setSessions(sRes.data.data || []);
      setSubjects(subRes.data.data || []);
      setClassrooms(crRes.data.data || []);
    } catch { toast.error('Failed to load sessions'); }
    finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  const statusColor = { scheduled: 'badge-info', active: 'badge-warning', completed: 'badge-success', cancelled: 'badge-danger' };

  return (
    <div>
      <div className="page-header">
        <h1>📅 Sessions</h1>
        <p>Manage class sessions scheduled by Admin</p>
      </div>

      {/* ── My Classrooms Banner ────────────────────────────── */}
      {classrooms.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            🏫 My Assigned Classrooms
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
            {classrooms.map(cr => (
              <div key={cr.id} style={{
                background: 'rgba(99,102,241,0.06)',
                border: '1px solid rgba(99,102,241,0.22)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                  <School size={16} color="var(--primary-light)" />
                  <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--primary-light)' }}>{cr.name}</span>
                </div>
                {cr.room_number && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    <MapPin size={12} /> {cr.room_number}
                  </div>
                )}
                {cr.subject_name && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    <BookOpen size={12} /> {cr.subject_name} ({cr.subject_code})
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    <Users size={12} /> <b>{cr.student_count}</b> students enrolled
                  </div>
                  <span style={{
                    padding: '2px 8px', background: 'rgba(16,185,129,0.12)',
                    color: '#10b981', border: '1px solid rgba(16,185,129,0.3)',
                    borderRadius: 20, fontSize: '0.68rem', fontWeight: 600
                  }}>Active</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <select className="form-select" style={{ width: 200 }} value={filters.faculty_subject_id} onChange={e => setFilters({ ...filters, faculty_subject_id: e.target.value })}>
          <option value="">All Subjects</option>
          {subjects.map(s => <option key={s.faculty_subject_id} value={s.faculty_subject_id}>{s.name}</option>)}
        </select>
        <input type="date" className="form-input" style={{ width: 160 }} value={filters.from_date} onChange={e => setFilters({ ...filters, from_date: e.target.value })} />
        <input type="date" className="form-input" style={{ width: 160 }} value={filters.to_date} onChange={e => setFilters({ ...filters, to_date: e.target.value })} />
        <button className="btn btn-outline" onClick={load}><RefreshCw size={16} /> Refresh</button>
      </div>

      {loading ? <div className="loading-center"><div className="spinner-lg spinner" /></div> : (
        <div className="table-wrapper">
          <table>
            <thead><tr><th>Subject</th><th>Date</th><th>Hour</th><th>Time</th><th>Present</th><th>Status</th><th>Action</th></tr></thead>
            <tbody>
              {sessions.length === 0 ? (
                <tr><td colSpan={7}><div className="empty-state"><CalendarCheck size={40} /><h3>No sessions scheduled</h3><p>Contact your administrator to schedule sessions.</p></div></td></tr>
              ) : sessions.map(s => (
                <tr key={s.id}>
                  <td><div style={{ fontWeight: 600 }}>{s.subject_name}</div><div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{s.code}</div></td>
                  <td>{new Date(s.session_date).toLocaleDateString('en-IN')}</td>
                  <td>Hour {s.hour_number}</td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{s.start_time?.slice(0,5)}</td>
                  <td style={{ fontWeight: 700, color: '#10b981' }}>{s.present_count || 0}/{s.total_records || 0}</td>
                  <td><span className={`badge ${statusColor[s.status]}`}>{s.status}</span></td>
                  <td>
                    {s.status === 'scheduled' ? (
                      <button
                        className="btn btn-primary btn-sm"
                        disabled={startingSession === s.id}
                        onClick={async () => {
                          setStartingSession(s.id);
                          try {
                            const today = new Date().toISOString().split('T')[0];
                            await api.put(`/faculty/sessions/${s.id}/configure`, {
                              session_date: s.session_date ? new Date(s.session_date).toISOString().split('T')[0] : today,
                              hour_number: s.hour_number || 1,
                              start_time: s.start_time?.slice(0, 5) || '09:00',
                              end_time: s.end_time?.slice(0, 5) || '10:00',
                            });
                            await load();
                            setLiveSession(s);
                          } catch (err) {
                            toast.error(err.response?.data?.message || 'Failed to start session');
                          } finally {
                            setStartingSession(null);
                          }
                        }}
                      >
                        {startingSession === s.id ? '⏳ Starting...' : '⚙️ Start'}
                      </button>
                    ) : s.status === 'active' ? (
                      <button className="btn btn-primary btn-sm" onClick={() => setLiveSession(s)}>
                        <Wifi size={14} /> Open Live
                      </button>
                    ) : (
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Completed</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}


      {liveSession && <LiveSessionModal session={liveSession} onClose={() => setLiveSession(null)} onRefresh={load} />}

      <style>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
