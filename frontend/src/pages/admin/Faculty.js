import React, { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Search, GraduationCap, BookOpen, FileSpreadsheet } from 'lucide-react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import ExcelImportModal from '../../components/ExcelImportModal';

function FacultyModal({ faculty, depts, onClose, onSave }) {
  const [form, setForm] = useState(faculty || {
    name: '', email: '', phone: '', faculty_id: '', department_id: '',
    designation: '', qualification: '', experience_years: 0, joining_date: '', password: 'Faculty@123'
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      if (faculty?.id) { await api.put(`/admin/faculty/${faculty.id}`, form); toast.success('Faculty updated!'); }
      else { await api.post('/admin/faculty', form); toast.success('Faculty created!'); }
      onSave();
    } catch (err) { toast.error(err.response?.data?.message || 'Error saving'); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 640 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">{faculty?.id ? '✏️ Edit Faculty' : '➕ Add Faculty'}</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Full Name *</label><input className="form-input" value={form.name} onChange={e => set('name', e.target.value)} required /></div>
            <div className="form-group"><label className="form-label">Email *</label><input type="email" className="form-input" value={form.email} onChange={e => set('email', e.target.value)} required /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Faculty ID *</label><input className="form-input" value={form.faculty_id} onChange={e => set('faculty_id', e.target.value)} required /></div>
            <div className="form-group"><label className="form-label">Phone</label><input className="form-input" value={form.phone} onChange={e => set('phone', e.target.value)} /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Department *</label>
              <select className="form-select" value={form.department_id} onChange={e => set('department_id', e.target.value)} required>
                <option value="">Select Department</option>
                {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div className="form-group"><label className="form-label">Designation</label><input className="form-input" value={form.designation} onChange={e => set('designation', e.target.value)} placeholder="Associate Professor" /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Qualification</label><input className="form-input" value={form.qualification} onChange={e => set('qualification', e.target.value)} placeholder="Ph.D, M.Tech" /></div>
            <div className="form-group"><label className="form-label">Experience (Years)</label><input type="number" className="form-input" value={form.experience_years} onChange={e => set('experience_years', e.target.value)} min={0} /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Joining Date</label><input type="date" className="form-input" value={form.joining_date} onChange={e => set('joining_date', e.target.value)} /></div>
            {!faculty?.id && <div className="form-group"><label className="form-label">Password</label><input className="form-input" value={form.password} onChange={e => set('password', e.target.value)} /></div>}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save Faculty'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AdminFaculty() {
  const [faculty, setFaculty] = useState([]);
  const [depts, setDepts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null);
  const [assignModal, setAssignModal] = useState(null);
  const [importModal, setImportModal] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [fRes, dRes] = await Promise.all([api.get('/admin/faculty'), api.get('/admin/departments')]);
      setFaculty(fRes.data.data || []);
      setDepts(dRes.data.data || []);
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete faculty "${name}"?`)) return;
    try { await api.delete(`/admin/faculty/${id}`); toast.success('Deleted!'); load(); }
    catch (err) { toast.error(err.response?.data?.message || 'Delete failed'); }
  };

  const filtered = faculty.filter(f =>
    !search || f.name?.toLowerCase().includes(search.toLowerCase()) || f.faculty_id?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="page-header">
        <h1>🎓 Faculty</h1>
        <p>Manage faculty members ({faculty.length} total)</p>
      </div>

      <div className="section-header">
        <div className="search-box" style={{ width: 280 }}>
          <Search size={16} />
          <input placeholder="Search faculty..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-outline" onClick={() => setImportModal(true)} style={{ gap: 6 }}>
            <FileSpreadsheet size={16} /> Import Excel
          </button>
          <button className="btn btn-primary" onClick={() => setModal('create')}><Plus size={16} /> Add Faculty</button>
        </div>
      </div>

      {loading ? <div className="loading-center"><div className="spinner-lg spinner" /><p style={{ color: 'var(--text-muted)' }}>Loading...</p></div> : (
        <div className="table-wrapper">
          <table>
            <thead><tr><th>Faculty</th><th>Faculty ID</th><th>Department</th><th>Designation</th><th>Experience</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7}><div className="empty-state"><GraduationCap size={36} /><p>No faculty found</p></div></td></tr>
              ) : filtered.map(f => (
                <tr key={f.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg,#10b981,#059669)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', fontWeight: 700, color: 'white', flexShrink: 0 }}>
                        {f.name?.charAt(0)}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{f.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{f.email}</div>
                      </div>
                    </div>
                  </td>
                  <td><span className="badge badge-success">{f.faculty_id}</span></td>
                  <td>{f.department_name}</td>
                  <td>{f.designation || '—'}</td>
                  <td>{f.experience_years ? `${f.experience_years} yrs` : '—'}</td>
                  <td><span className={`badge ${f.is_active ? 'badge-success' : 'badge-danger'}`}>{f.is_active ? 'Active' : 'Inactive'}</span></td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-outline btn-icon btn-sm" onClick={() => setAssignModal(f)} title="Assign Subjects"><BookOpen size={14} /></button>
                      <button className="btn btn-outline btn-icon btn-sm" onClick={() => setModal(f)} title="Edit"><Pencil size={14} /></button>
                      <button className="btn btn-danger btn-icon btn-sm" onClick={() => handleDelete(f.id, f.name)} title="Delete"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <FacultyModal
          faculty={modal === 'create' ? null : modal}
          depts={depts}
          onClose={() => setModal(null)}
          onSave={() => { setModal(null); load(); }}
        />
      )}

      {assignModal && (
        <AssignModal
          faculty={assignModal}
          onClose={() => setAssignModal(null)}
        />
      )}
      {importModal && (
        <ExcelImportModal
          type="faculty"
          onClose={() => setImportModal(false)}
          onSuccess={() => { setImportModal(false); load(); }}
        />
      )}
    </div>
  );
}

function AssignModal({ faculty, onClose }) {
  const [assignments, setAssignments] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ subject_id: '', semester_id: '', academic_year: new Date().getFullYear().toString() + '-' + (new Date().getFullYear() + 1).toString() });

  const loadAssignments = async () => {
    try {
      const res = await api.get(`/admin/faculty/${faculty.id}/assignments`);
      setAssignments(res.data.data || []);
    } catch {
      toast.error('Failed to load assignments');
    }
  };

  const loadDropdowns = async () => {
    try {
      const [subRes, semRes] = await Promise.all([
        api.get('/admin/subjects'),
        api.get('/admin/semesters')
      ]);
      setSubjects(subRes.data.data || []);
      setSemesters(semRes.data.data || []);
    } catch {
      toast.error('Failed to load subjects or semesters');
    }
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([loadAssignments(), loadDropdowns()]);
      setLoading(false);
    };
    init();
  }, [faculty.id]);

  const handleAssign = async (e) => {
    e.preventDefault();
    if (!form.subject_id || !form.semester_id || !form.academic_year) {
      toast.error('Please fill in all fields');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/admin/assign-subject', {
        faculty_id: faculty.id,
        subject_id: parseInt(form.subject_id),
        semester_id: parseInt(form.semester_id),
        academic_year: form.academic_year
      });
      toast.success('Subject assigned successfully!');
      loadAssignments();
      setForm(prev => ({ ...prev, subject_id: '', semester_id: '' }));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to assign');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = async (id) => {
    if (!window.confirm('Are you sure you want to remove this assignment?')) return;
    try {
      await api.delete(`/admin/assignments/${id}`);
      toast.success('Assignment removed successfully!');
      loadAssignments();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 700 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">📚 Assign Subjects — {faculty.name}</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
            <div className="spinner" />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* New Assignment Form */}
            <form onSubmit={handleAssign} style={{ background: 'var(--bg-card2)', padding: 16, borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
              <h4 style={{ marginBottom: 12, fontSize: '0.9rem', color: 'var(--text-primary)' }}>Assign New Subject</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 10, alignItems: 'flex-end' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Subject</label>
                  <select className="form-select" value={form.subject_id} onChange={e => setForm({ ...form, subject_id: e.target.value })} required>
                    <option value="">Select Subject</option>
                    {subjects.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                    ))}
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Semester</label>
                  <select className="form-select" value={form.semester_id} onChange={e => setForm({ ...form, semester_id: e.target.value })} required>
                    <option value="">Select Semester</option>
                    {semesters.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Academic Year</label>
                  <input className="form-input" placeholder="e.g. 2025-2026" value={form.academic_year} onChange={e => setForm({ ...form, academic_year: e.target.value })} required />
                </div>
                <button type="submit" className="btn btn-primary" style={{ padding: '10px 20px', height: '40px' }} disabled={submitting}>
                  {submitting ? 'Assigning...' : 'Assign'}
                </button>
              </div>
            </form>

            {/* List of current assignments */}
            <div>
              <h4 style={{ marginBottom: 10, fontSize: '0.9rem', color: 'var(--text-primary)' }}>Current Assignments</h4>
              {assignments.length === 0 ? (
                <div className="empty-state" style={{ padding: 20 }}>
                  <p>No subjects assigned to this faculty yet.</p>
                </div>
              ) : (
                <div className="table-wrapper" style={{ maxHeight: 250, overflowY: 'auto' }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Subject Name</th>
                        <th>Code</th>
                        <th>Semester</th>
                        <th>Academic Year</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {assignments.map(a => (
                        <tr key={a.id}>
                          <td style={{ fontWeight: 600 }}>{a.subject_name}</td>
                          <td><span className="badge badge-info">{a.subject_code}</span></td>
                          <td>{a.semester_name}</td>
                          <td>{a.academic_year}</td>
                          <td>
                            <button type="button" className="btn btn-danger btn-icon btn-sm" onClick={() => handleRemove(a.id)} title="Remove assignment">
                              <Trash2 size={12} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
        <div className="modal-footer" style={{ marginTop: 10 }}>
          <button type="button" className="btn btn-outline" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
