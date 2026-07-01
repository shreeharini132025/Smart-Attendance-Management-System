import React, { useEffect, useState, useCallback } from 'react';
import {
  Plus, Pencil, Trash2, Users, School, ChevronRight,
  X, UserPlus, UserMinus, Search, Building2, FileSpreadsheet,
  Upload, Download, CheckCircle, AlertCircle, BookOpen
} from 'lucide-react';
import api from '../../api/axios';
import toast from 'react-hot-toast';

// ── Helper: initials avatar ───────────────────────────────────
const Initials = ({ name, size = 36, bg = 'var(--primary)' }) => (
  <div style={{
    width: size, height: size, borderRadius: '50%', background: bg,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontWeight: 700, fontSize: size * 0.36, color: '#fff', flexShrink: 0
  }}>
    {(name || '?').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
  </div>
);

// ── Classroom Form Modal ──────────────────────────────────────
function ClassroomModal({ classroom, depts, semesters, facultyList, subjects, onClose, onSave }) {
  const [form, setForm] = useState(classroom ? {
    name: classroom.name || '',
    room_number: classroom.room_number || '',
    department_id: classroom.department_id || '',
    semester_id: classroom.semester_id || '',
    faculty_id: classroom.faculty_id || '',
    subject_id: classroom.subject_id || '',
    capacity: classroom.capacity || 60,
    description: classroom.description || '',
    is_active: classroom.is_active !== undefined ? classroom.is_active : 1,
  } : {
    name: '', room_number: '', department_id: '', semester_id: '',
    faculty_id: '', subject_id: '', capacity: 60, description: '', is_active: 1,
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (classroom?.id) {
        await api.put(`/admin/classrooms/${classroom.id}`, form);
        toast.success('Classroom updated!');
      } else {
        await api.post('/admin/classrooms', form);
        toast.success('Classroom created!');
      }
      onSave();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error saving classroom');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 620 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">{classroom?.id ? '✏️ Edit Classroom' : '🏫 New Classroom'}</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Classroom Name *</label>
              <input className="form-input" value={form.name} onChange={e => set('name', e.target.value)}
                placeholder="e.g. CSE-A, ECE-B" required />
            </div>
            <div className="form-group">
              <label className="form-label">Room Number</label>
              <input className="form-input" value={form.room_number} onChange={e => set('room_number', e.target.value)}
                placeholder="e.g. Block A - 101" />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Department *</label>
              <select className="form-select" value={form.department_id} onChange={e => set('department_id', e.target.value)} required>
                <option value="">Select Department</option>
                {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Semester *</label>
              <select className="form-select" value={form.semester_id} onChange={e => set('semester_id', e.target.value)} required>
                <option value="">Select Semester</option>
                {semesters.map(s => <option key={s.id} value={s.id}>{s.name} ({s.academic_year})</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Assigned Faculty</label>
              <select className="form-select" value={form.faculty_id} onChange={e => set('faculty_id', e.target.value)}>
                <option value="">No Faculty Assigned</option>
                {facultyList.map(f => <option key={f.id} value={f.id}>{f.name} ({f.faculty_id})</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Assigned Subject</label>
              <select className="form-select" value={form.subject_id} onChange={e => set('subject_id', e.target.value)}>
                <option value="">No Subject Assigned</option>
                {subjects.map(s => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Capacity</label>
              <input type="number" className="form-input" value={form.capacity} min={1} max={500}
                onChange={e => set('capacity', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <input className="form-input" value={form.description} onChange={e => set('description', e.target.value)}
                placeholder="Optional notes" />
            </div>
          </div>
          {classroom?.id && (
            <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input type="checkbox" id="is_active" checked={!!form.is_active}
                onChange={e => set('is_active', e.target.checked ? 1 : 0)} />
              <label htmlFor="is_active" className="form-label" style={{ margin: 0 }}>Active Classroom</label>
            </div>
          )}
          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : classroom?.id ? 'Update Classroom' : 'Create Classroom'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Manage Students Panel ─────────────────────────────────────
function ManageStudentsModal({ classroom, onClose, onRefresh }) {
  const [enrolled, setEnrolled] = useState([]);
  const [available, setAvailable] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState([]);
  const [tab, setTab] = useState('enrolled'); // 'enrolled' | 'add' | 'import'

  // Excel import state
  const [importFile, setImportFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  const fetchEnrolled = useCallback(async () => {
    const res = await api.get(`/admin/classrooms/${classroom.id}/students`);
    setEnrolled(res.data.data || []);
  }, [classroom.id]);

  const fetchAvailable = useCallback(async () => {
    const params = {};
    if (classroom.department_id) params.department_id = classroom.department_id;
    if (classroom.semester_id) params.semester_id = classroom.semester_id;
    const res = await api.get('/admin/students', { params });
    setAvailable(res.data.data || []);
  }, [classroom.department_id, classroom.semester_id]);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchEnrolled(), fetchAvailable()]).finally(() => setLoading(false));
  }, [fetchEnrolled, fetchAvailable]);

  const enrolledIds = new Set(enrolled.map(s => s.student_id));
  const filteredAvailable = available.filter(s =>
    !enrolledIds.has(s.id) &&
    (s.name?.toLowerCase().includes(search.toLowerCase()) ||
     s.roll_number?.toLowerCase().includes(search.toLowerCase()))
  );
  const filteredEnrolled = enrolled.filter(s =>
    s.name?.toLowerCase().includes(search.toLowerCase()) ||
    s.roll_number?.toLowerCase().includes(search.toLowerCase())
  );

  const handleAssign = async () => {
    if (!selected.length) return;
    try {
      await api.post(`/admin/classrooms/${classroom.id}/students`, { student_ids: selected });
      toast.success(`${selected.length} student(s) assigned!`);
      setSelected([]);
      await fetchEnrolled();
      onRefresh();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error assigning students');
    }
  };

  const handleRemove = async (studentId, name) => {
    if (!window.confirm(`Remove ${name} from this classroom?`)) return;
    try {
      await api.delete(`/admin/classrooms/${classroom.id}/students/${studentId}`);
      toast.success('Student removed from classroom');
      await fetchEnrolled();
      onRefresh();
    } catch (err) {
      toast.error('Error removing student');
    }
  };

  const toggleSelect = (id) => {
    setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  };

  // ── Excel Import handlers ────────────────────────────────────
  const handleDownloadTemplate = () => {
    // Use a direct link with auth header via axios blob
    api.get(`/admin/classrooms/${classroom.id}/import-template`, { responseType: 'blob' })
      .then(res => {
        const url = URL.createObjectURL(res.data);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'classroom_students_template.xlsx';
        a.click();
        URL.revokeObjectURL(url);
      })
      .catch(() => toast.error('Could not download template'));
  };

  const handleImport = async () => {
    if (!importFile) return toast.error('Please select an Excel file first');
    setImporting(true);
    setImportResult(null);
    try {
      const formData = new FormData();
      formData.append('file', importFile);
      const res = await api.post(
        `/admin/classrooms/${classroom.id}/import-students`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      setImportResult(res.data);
      toast.success(res.data.message);
      await fetchEnrolled();
      onRefresh();
      setImportFile(null);
      // Reset file input
      const fi = document.getElementById('classroom-excel-input');
      if (fi) fi.value = '';
    } catch (err) {
      toast.error(err.response?.data?.message || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 700, maxHeight: '88vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3 className="modal-title">👥 Manage Students</h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 2 }}>
              {classroom.name} · {classroom.room_number || 'No room'} · {enrolled.length}/{classroom.capacity} students
            </p>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, padding: '0 24px', borderBottom: '1px solid var(--border)' }}>
          {[
            ['enrolled', `Enrolled (${enrolled.length})`],
            ['add', 'Add Students'],
            ['import', '📊 Import Excel']
          ].map(([key, label]) => (
            <button key={key} onClick={() => { setTab(key); setSearch(''); setSelected([]); setImportResult(null); }}
              style={{
                padding: '10px 16px', background: 'none', border: 'none', cursor: 'pointer',
                borderBottom: tab === key ? '2px solid var(--primary)' : '2px solid transparent',
                color: tab === key ? 'var(--primary)' : 'var(--text-muted)',
                fontWeight: tab === key ? 600 : 400, fontSize: '0.88rem', transition: 'var(--transition)'
              }}>
              {label}
            </button>
          ))}
        </div>

        {/* Search (only for enrolled + add tabs) */}
        {tab !== 'import' && (
          <div style={{ padding: '16px 24px 8px', position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: 36, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input className="form-input" placeholder="Search by name or roll number..."
              value={search} onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: 36 }} />
          </div>
        )}

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 16px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40 }}><div className="spinner" /></div>
          ) : tab === 'enrolled' ? (
            filteredEnrolled.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                <Users size={40} style={{ opacity: 0.3, marginBottom: 8 }} />
                <p>No students enrolled yet</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 8 }}>
                {filteredEnrolled.map(s => (
                  <div key={s.student_id} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 14px', background: 'var(--bg-card2)',
                    borderRadius: 'var(--radius-md)', border: '1px solid var(--border)'
                  }}>
                    <Initials name={s.name} size={34} bg="var(--primary)" />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{s.name}</div>
                      <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>{s.roll_number} · {s.department_name}</div>
                    </div>
                    <button onClick={() => handleRemove(s.student_id, s.name)}
                      className="btn btn-outline" style={{ padding: '4px 10px', fontSize: '0.78rem', color: 'var(--danger)' }}>
                      <UserMinus size={14} /> Remove
                    </button>
                  </div>
                ))}
              </div>
            )
          ) : tab === 'add' ? (
            <>
              {selected.length > 0 && (
                <div style={{ margin: '8px 0 12px', display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>{selected.length} selected</span>
                  <button className="btn btn-primary" style={{ padding: '6px 16px', fontSize: '0.82rem' }} onClick={handleAssign}>
                    <UserPlus size={14} /> Assign to Classroom
                  </button>
                </div>
              )}
              {filteredAvailable.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                  <Users size={40} style={{ opacity: 0.3, marginBottom: 8 }} />
                  <p>No available students found</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 8 }}>
                  {filteredAvailable.map(s => {
                    const isSel = selected.includes(s.id);
                    return (
                      <div key={s.id} onClick={() => toggleSelect(s.id)} style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '10px 14px', background: isSel ? 'rgba(99,102,241,0.08)' : 'var(--bg-card2)',
                        borderRadius: 'var(--radius-md)',
                        border: `1px solid ${isSel ? 'var(--primary)' : 'var(--border)'}`,
                        cursor: 'pointer', transition: 'var(--transition)'
                      }}>
                        <div style={{
                          width: 18, height: 18, borderRadius: 4,
                          border: `2px solid ${isSel ? 'var(--primary)' : 'var(--border)'}`,
                          background: isSel ? 'var(--primary)' : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                        }}>
                          {isSel && <span style={{ color: '#fff', fontSize: 11, fontWeight: 700 }}>✓</span>}
                        </div>
                        <Initials name={s.name} size={34} bg="var(--info, #06b6d4)" />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{s.name}</div>
                          <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>{s.roll_number} · {s.department_name} · {s.semester_name}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            /* ── Import Excel Tab ─────────────────────────────── */
            <div style={{ paddingTop: 16 }}>
              {/* How it works */}
              <div style={{
                background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)',
                borderRadius: 'var(--radius-md)', padding: '14px 16px', marginBottom: 20
              }}>
                <div style={{ fontWeight: 600, fontSize: '0.88rem', marginBottom: 8, color: 'var(--primary-light)' }}>
                  📋 How Bulk Import Works
                </div>
                <ul style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <li>Download the Excel template below</li>
                  <li>Fill in student <strong>roll numbers</strong> (or emails) — one per row</li>
                  <li>Upload the filled file — students will be auto-matched and assigned</li>
                  <li>Students not found in the system will be listed as errors</li>
                </ul>
              </div>

              {/* Download template */}
              <button className="btn btn-outline" style={{ width: '100%', justifyContent: 'center', marginBottom: 20, padding: '10px' }}
                onClick={handleDownloadTemplate}>
                <Download size={16} /> Download Excel Template
              </button>

              {/* File upload area */}
              <div
                style={{
                  border: `2px dashed ${importFile ? 'var(--primary)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius-lg)', padding: '28px 20px',
                  textAlign: 'center', marginBottom: 16, cursor: 'pointer',
                  background: importFile ? 'rgba(99,102,241,0.05)' : 'transparent',
                  transition: 'var(--transition)'
                }}
                onClick={() => document.getElementById('classroom-excel-input').click()}
              >
                <FileSpreadsheet size={36} style={{ color: importFile ? 'var(--primary)' : 'var(--text-muted)', marginBottom: 10 }} />
                {importFile ? (
                  <>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--primary-light)' }}>{importFile.name}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>
                      {(importFile.size / 1024).toFixed(1)} KB · Click to change
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Click to select Excel file</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>.xlsx or .xls · Max 10MB</div>
                  </>
                )}
                <input
                  id="classroom-excel-input"
                  type="file"
                  accept=".xlsx,.xls"
                  style={{ display: 'none' }}
                  onChange={e => { setImportFile(e.target.files[0] || null); setImportResult(null); }}
                />
              </div>

              {/* Import button */}
              <button
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center', padding: '11px' }}
                onClick={handleImport}
                disabled={!importFile || importing}
              >
                {importing ? (
                  <><div className="spinner" style={{ width: 16, height: 16 }} /> Importing...</>
                ) : (
                  <><Upload size={16} /> Import Students from Excel</>
                )}
              </button>

              {/* Import results */}
              {importResult && (
                <div style={{ marginTop: 20 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 12 }}>Import Results</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
                    {[
                      { label: 'Assigned', value: importResult.results?.assigned || 0, color: '#10b981', icon: CheckCircle },
                      { label: 'Already Enrolled', value: importResult.results?.already_enrolled || 0, color: '#f59e0b', icon: CheckCircle },
                      { label: 'Not Found', value: importResult.results?.not_found || 0, color: '#ef4444', icon: AlertCircle },
                    ].map(s => (
                      <div key={s.label} style={{
                        background: `${s.color}15`, border: `1px solid ${s.color}30`,
                        borderRadius: 'var(--radius-md)', padding: '12px', textAlign: 'center'
                      }}>
                        <s.icon size={20} color={s.color} style={{ marginBottom: 6 }} />
                        <div style={{ fontWeight: 800, fontSize: '1.4rem', color: s.color }}>{s.value}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{s.label}</div>
                      </div>
                    ))}
                  </div>
                  {importResult.results?.errors?.length > 0 && (
                    <div style={{
                      background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)',
                      borderRadius: 'var(--radius-md)', padding: 14, maxHeight: 160, overflowY: 'auto'
                    }}>
                      <div style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--danger)', marginBottom: 8 }}>⚠️ Errors / Not Found:</div>
                      {importResult.results.errors.map((e, i) => (
                        <div key={i} style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', padding: '2px 0' }}>{e}</div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ── Main Classrooms Page ──────────────────────────────────────
export default function Classrooms() {
  const [classrooms, setClassrooms] = useState([]);
  const [depts, setDepts] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [facultyList, setFacultyList] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null); // null | { type: 'form'|'students', data }
  const [filter, setFilter] = useState('all'); // 'all' | 'active' | 'inactive'

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [crRes, deptRes, semRes, facRes, subRes] = await Promise.all([
        api.get('/admin/classrooms'),
        api.get('/admin/departments'),
        api.get('/admin/semesters'),
        api.get('/admin/faculty'),
        api.get('/admin/subjects'),
      ]);
      setClassrooms(crRes.data.data || []);
      setDepts(deptRes.data.data || []);
      setSemesters(semRes.data.data || []);
      setFacultyList(facRes.data.data || []);
      setSubjects(subRes.data.data || []);
    } catch {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete classroom "${name}"? This will also remove all student assignments.`)) return;
    try {
      await api.delete(`/admin/classrooms/${id}`);
      toast.success('Classroom deleted');
      setClassrooms(c => c.filter(cr => cr.id !== id));
    } catch {
      toast.error('Error deleting classroom');
    }
  };

  const filtered = classrooms.filter(cr => {
    const matchSearch = cr.name.toLowerCase().includes(search.toLowerCase()) ||
      (cr.room_number || '').toLowerCase().includes(search.toLowerCase()) ||
      (cr.department_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (cr.faculty_name || '').toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'all' || (filter === 'active' ? cr.is_active : !cr.is_active);
    return matchSearch && matchFilter;
  });

  const stats = {
    total: classrooms.length,
    active: classrooms.filter(c => c.is_active).length,
    students: classrooms.reduce((s, c) => s + (c.student_count || 0), 0),
    withFaculty: classrooms.filter(c => c.faculty_id).length,
  };

  return (
    <div>
      {/* Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1>🏫 Classrooms</h1>
          <p>Manage classroom assignments, faculty, and enrolled students</p>
        </div>
        <button className="btn btn-primary" onClick={() => setModal({ type: 'form', data: null })}>
          <Plus size={16} /> New Classroom
        </button>
      </div>

      {/* Stats */}
      <div className="stats-grid" style={{ marginBottom: 24 }}>
        {[
          { label: 'Total Classrooms', value: stats.total, icon: School, color: '#6366f1' },
          { label: 'Active', value: stats.active, icon: Building2, color: '#10b981' },
          { label: 'Total Students', value: stats.students, icon: Users, color: '#f59e0b' },
          { label: 'With Faculty', value: stats.withFaculty, icon: ChevronRight, color: '#06b6d4' },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div className="stat-icon" style={{ background: `${s.color}20`, color: s.color }}>
              <s.icon size={20} />
            </div>
            <div className="stat-info">
              <h3>{s.value}</h3>
              <p>{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input className="form-input" placeholder="Search classrooms..."
            value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 36 }} />
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {['all', 'active', 'inactive'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`btn ${filter === f ? 'btn-primary' : 'btn-outline'}`}
              style={{ padding: '8px 16px', fontSize: '0.82rem', textTransform: 'capitalize' }}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Classroom Cards */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 80 }}><div className="spinner-lg spinner" /></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <School size={52} style={{ opacity: 0.3 }} />
          <h3>No classrooms found</h3>
          <p>{search ? 'Try a different search term' : 'Create your first classroom to get started'}</p>
          {!search && <button className="btn btn-primary" onClick={() => setModal({ type: 'form', data: null })}>
            <Plus size={16} /> Create Classroom
          </button>}
        </div>
      ) : (
        <div className="classroom-grid">
          {filtered.map(cr => (
            <div key={cr.id} className="card" style={{
              border: `1px solid ${cr.is_active ? 'var(--border)' : 'var(--border-muted, var(--border))'}`,
              opacity: cr.is_active ? 1 : 0.65, transition: 'var(--transition)',
            }}>
              {/* Card Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div style={{
                    width: 46, height: 46, borderRadius: 12, background: 'rgba(99,102,241,0.12)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)'
                  }}>
                    <School size={22} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '1rem' }}>{cr.name}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      {cr.room_number || 'No room assigned'}
                    </div>
                  </div>
                </div>
                <span className={`badge ${cr.is_active ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: '0.68rem' }}>
                  {cr.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>

              {/* Details */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                <div style={{ display: 'flex', gap: 8, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  <Building2 size={14} style={{ marginTop: 1, flexShrink: 0 }} />
                  <span>{cr.department_name} · {cr.semester_name}</span>
                </div>
                {cr.subject_name && (
                  <div style={{ display: 'flex', gap: 8, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                    <BookOpen size={14} style={{ marginTop: 1, flexShrink: 0 }} />
                    <span>Subject: <strong>{cr.subject_name} ({cr.subject_code})</strong></span>
                  </div>
                )}

                {/* Faculty */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {cr.faculty_name ? (
                    <>
                      <Initials name={cr.faculty_name} size={26} bg="var(--primary)" />
                      <div>
                        <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>{cr.faculty_name}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{cr.faculty_code}</div>
                      </div>
                    </>
                  ) : (
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      No faculty assigned
                    </div>
                  )}
                </div>

                {/* Student count */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 12px', background: 'var(--bg-card2)', borderRadius: 8,
                  border: '1px solid var(--border)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.82rem' }}>
                    <Users size={14} color="var(--primary)" />
                    <span><strong>{cr.student_count || 0}</strong> / {cr.capacity} students</span>
                  </div>
                  <div style={{
                    width: 80, height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden'
                  }}>
                    <div style={{
                      height: '100%', background: 'var(--primary)',
                      width: `${Math.min(100, ((cr.student_count || 0) / cr.capacity) * 100)}%`,
                      transition: 'width 0.4s ease'
                    }} />
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="classroom-card-actions">
                <button className="btn btn-primary" style={{ fontSize: '0.82rem', padding: '7px 12px' }}
                  onClick={() => setModal({ type: 'students', data: cr })}>
                  <Users size={14} /> Manage Students
                </button>
                <div className="classroom-action-row">
                  <button className="btn btn-outline" style={{ padding: '7px 10px' }}
                    onClick={() => setModal({ type: 'form', data: cr })}>
                    <Pencil size={14} /> Edit
                  </button>
                  <button className="btn btn-outline" style={{ padding: '7px 10px', color: 'var(--danger)' }}
                    onClick={() => handleDelete(cr.id, cr.name)}>
                    <Trash2 size={14} /> Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      {modal?.type === 'form' && (
        <ClassroomModal
          classroom={modal.data}
          depts={depts}
          semesters={semesters}
          facultyList={facultyList}
          subjects={subjects}
          onClose={() => setModal(null)}
          onSave={() => { setModal(null); fetchAll(); }}
        />
      )}
      {modal?.type === 'students' && (
        <ManageStudentsModal
          classroom={modal.data}
          onClose={() => setModal(null)}
          onRefresh={fetchAll}
        />
      )}
    </div>
  );
}
