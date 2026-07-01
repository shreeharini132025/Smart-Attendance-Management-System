import React, { useEffect, useState } from 'react';
import { BookOpen, Users, CalendarCheck, School, Plus, MapPin } from 'lucide-react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

function CreateSessionModal({ subject, onClose, onSave }) {
  const today = new Date().toISOString().split('T')[0];
  const [form, setForm] = useState({
    faculty_subject_id: subject.faculty_subject_id,
    session_date: today,
    hour_number: 1,
    start_time: '09:00',
    end_time: '10:00',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/faculty/sessions/create', form);
      toast.success('Session created successfully!');
      onSave();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error creating session');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">➕ Create Session</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Subject</label>
            <input className="form-input" value={`${subject.name} (${subject.code})`} disabled style={{ opacity: 0.7 }} />
          </div>
          {subject.classroom_name && (
            <div className="form-group">
              <label className="form-label">Classroom</label>
              <input className="form-input" value={`${subject.classroom_name}${subject.classroom_room ? ` — ${subject.classroom_room}` : ''}`} disabled style={{ opacity: 0.7, color: 'var(--primary-light)' }} />
            </div>
          )}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Date *</label>
              <input type="date" className="form-input" value={form.session_date} onChange={e => setForm({ ...form, session_date: e.target.value })} required />
            </div>
            <div className="form-group">
              <label className="form-label">Hour *</label>
              <select className="form-select" value={form.hour_number} onChange={e => setForm({ ...form, hour_number: parseInt(e.target.value) })}>
                {[1,2,3,4,5,6,7,8].map(h => <option key={h} value={h}>Hour {h}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Start Time</label>
              <input type="time" className="form-input" value={form.start_time} onChange={e => setForm({ ...form, start_time: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">End Time</label>
              <input type="time" className="form-input" value={form.end_time} onChange={e => setForm({ ...form, end_time: e.target.value })} />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Creating...' : 'Create Session'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function FacultySubjects() {
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createModal, setCreateModal] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/faculty/subjects')
      .then(r => setSubjects(r.data.data || []))
      .catch(() => toast.error('Failed to load subjects'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading-center"><div className="spinner-lg spinner" /></div>;

  return (
    <div>
      <div className="page-header">
        <h1>📚 My Subjects</h1>
        <p>Subjects assigned to you by the admin this semester</p>
      </div>

      {subjects.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <BookOpen size={48} />
            <h3>No subjects assigned</h3>
            <p>Contact admin to get subjects and classrooms assigned to you.</p>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 20 }}>
          {subjects.map(s => {
            return (
              <div key={s.faculty_subject_id} className="card" style={{ position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                {/* Top accent bar */}
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'var(--gradient-primary)' }} />

                <div>
                  {/* Subject header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div style={{ flex: 1 }}>
                      <h3 style={{ fontSize: '1rem', marginBottom: 8 }}>{s.name}</h3>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <span className="badge badge-info">{s.code}</span>
                        <span className={`badge ${s.subject_type === 'lab' ? 'badge-warning' : 'badge-purple'}`}>{s.subject_type}</span>
                        <span className="badge badge-success">{s.credits} Credits</span>
                      </div>
                    </div>
                  </div>

                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 4 }}>{s.department_name}</p>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 12 }}>{s.semester_name}</p>

                  {/* Classroom Info Block — always present (INNER JOIN guarantees active classroom) */}
                  <div style={{
                    background: 'rgba(99,102,241,0.08)',
                    border: '1px solid rgba(99,102,241,0.25)',
                    borderRadius: 'var(--radius-md)',
                    padding: '10px 14px',
                    marginBottom: 14,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <School size={15} color="var(--primary-light)" />
                      <span style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--primary-light)' }}>
                        {s.classroom_name}
                      </span>
                    </div>
                    {s.classroom_room && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <MapPin size={13} color="var(--text-muted)" />
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                          Room: {s.classroom_room}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Stats + Action */}
                <div>
                  <div style={{ display: 'flex', gap: 16, paddingTop: 12, marginBottom: 12, borderTop: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Users size={14} color="var(--primary-light)" />
                      <span style={{ fontSize: '0.82rem' }}>
                        <b>{s.enrolled_students || 0}</b> Students
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <BookOpen size={14} color="#10b981" />
                      <span style={{ fontSize: '0.82rem' }}>
                        <b>{s.total_sessions || 0}</b> Sessions
                      </span>
                    </div>
                    {s.classroom_capacity && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <School size={14} color="#f59e0b" />
                        <span style={{ fontSize: '0.82rem' }}>
                          Cap: <b>{s.classroom_capacity}</b>
                        </span>
                      </div>
                    )}
                  </div>

                </div>
              </div>
            );
          })}
        </div>
      )}

      {createModal && (
        <CreateSessionModal
          subject={createModal}
          onClose={() => setCreateModal(null)}
          onSave={() => {
            setCreateModal(null);
            navigate('/faculty/sessions');
          }}
        />
      )}
    </div>
  );
}
