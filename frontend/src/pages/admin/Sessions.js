import React, { useEffect, useState, useCallback } from 'react';
import { Plus, Search, Calendar, Clock, Trash2, School, BookOpen, GraduationCap, RefreshCw } from 'lucide-react';
import api from '../../api/axios';
import toast from 'react-hot-toast';

function ScheduleSessionModal({ classrooms, onClose, onSave }) {
  const today = new Date().toISOString().split('T')[0];
  const [form, setForm] = useState({
    classroom_id: '',
    session_date: today,
    hour_number: 1,
    start_time: '09:00',
    end_time: '10:00'
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.classroom_id) {
      toast.error('Please select a classroom');
      return;
    }
    setSaving(true);
    try {
      await api.post('/admin/sessions', {
        classroom_id: parseInt(form.classroom_id),
        session_date: form.session_date,
        hour_number: parseInt(form.hour_number),
        start_time: form.start_time,
        end_time: form.end_time
      });
      toast.success('Session scheduled successfully!');
      onSave();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to schedule session');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 550 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">📅 Schedule New Session</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Classroom *</label>
            <select
              className="form-select"
              value={form.classroom_id}
              onChange={e => setForm({ ...form, classroom_id: e.target.value })}
              required
            >
              <option value="">Select Classroom</option>
              {classrooms.map(c => {
                const isValid = c.faculty_id && c.subject_id;
                return (
                  <option key={c.id} value={c.id} disabled={!isValid}>
                    {c.name} {isValid ? `· ${c.subject_name} (${c.faculty_name})` : ' ⚠️ (Please assign Faculty & Subject in Classroom settings first)'}
                  </option>
                );
              })}
            </select>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4 }}>
              Classrooms must have an assigned Subject and Faculty to be scheduled.
            </p>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Date *</label>
              <input
                type="date"
                className="form-input"
                value={form.session_date}
                onChange={e => setForm({ ...form, session_date: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Hour *</label>
              <select
                className="form-select"
                value={form.hour_number}
                onChange={e => setForm({ ...form, hour_number: e.target.value })}
                required
              >
                {[1, 2, 3, 4, 5, 6, 7, 8].map(h => (
                  <option key={h} value={h}>Hour {h}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Start Time *</label>
              <input
                type="time"
                className="form-input"
                value={form.start_time}
                onChange={e => setForm({ ...form, start_time: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">End Time *</label>
              <input
                type="time"
                className="form-input"
                value={form.end_time}
                onChange={e => setForm({ ...form, end_time: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Scheduling...' : 'Schedule Session'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AdminSessions() {
  const [sessions, setSessions] = useState([]);
  const [classrooms, setClassrooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [sessRes, classRes] = await Promise.all([
        api.get('/admin/sessions'),
        api.get('/admin/classrooms')
      ]);
      setSessions(sessRes.data.data || []);
      setClassrooms(classRes.data.data || []);
    } catch {
      toast.error('Failed to load sessions data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete/cancel this scheduled session?')) return;
    try {
      await api.delete(`/admin/sessions/${id}`);
      toast.success('Session deleted successfully');
      loadData();
    } catch {
      toast.error('Failed to delete session');
    }
  };

  const filtered = sessions.filter(s => {
    const term = search.toLowerCase();
    return (
      s.subject_name?.toLowerCase().includes(term) ||
      s.subject_code?.toLowerCase().includes(term) ||
      s.faculty_name?.toLowerCase().includes(term) ||
      s.classroom_name?.toLowerCase().includes(term)
    );
  });

  const statusColor = {
    scheduled: 'badge-info',
    active: 'badge-warning',
    completed: 'badge-success',
    cancelled: 'badge-danger'
  };

  return (
    <div className="page-container">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1>📅 Sessions</h1>
          <p>Schedule and monitor classroom sessions</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={16} /> Schedule Session
        </button>
      </div>

      {/* Toolbar */}
      <div className="section-header">
        <div className="search-box" style={{ width: 280 }}>
          <Search size={16} />
          <input
            placeholder="Search sessions..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <button className="btn btn-outline" onClick={loadData} style={{ gap: 6 }}>
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="loading-center">
          <div className="spinner-lg spinner" />
          <p style={{ color: 'var(--text-muted)' }}>Loading...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <Calendar size={48} style={{ opacity: 0.3 }} />
          <h3>No sessions found</h3>
          <p>Schedule a new session to get started.</p>
        </div>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Subject</th>
                <th>Classroom</th>
                <th>Faculty</th>
                <th>Date</th>
                <th>Hour</th>
                <th>Time Window</th>
                <th>Attendance</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => (
                <tr key={s.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <BookOpen size={16} color="var(--primary)" />
                      <div>
                        <div style={{ fontWeight: 600 }}>{s.subject_name}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{s.subject_code}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <School size={15} color="var(--info)" />
                      <span style={{ fontWeight: 500 }}>{s.classroom_name || 'Classroom'}</span>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <GraduationCap size={16} color="var(--success)" />
                      <span>{s.faculty_name}</span>
                    </div>
                  </td>
                  <td>{new Date(s.session_date).toLocaleDateString('en-IN')}</td>
                  <td>Hour {s.hour_number}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      <Clock size={13} />
                      <span>{s.start_time?.slice(0, 5)} - {s.end_time?.slice(0, 5)}</span>
                    </div>
                  </td>
                  <td style={{ fontWeight: 700 }}>
                    {s.status === 'completed' ? (
                      <span style={{ color: 'var(--success)' }}>{s.attendance_count || 0} present</span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>—</span>
                    )}
                  </td>
                  <td>
                    <span className={`badge ${statusColor[s.status]}`}>{s.status}</span>
                  </td>
                  <td>
                    <button
                      className="btn btn-danger btn-icon btn-sm"
                      onClick={() => handleDelete(s.id)}
                      title="Delete/Cancel Session"
                      disabled={s.status === 'completed' || s.status === 'active'}
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <ScheduleSessionModal
          classrooms={classrooms}
          onClose={() => setShowModal(false)}
          onSave={() => {
            setShowModal(false);
            loadData();
          }}
        />
      )}
    </div>
  );
}
