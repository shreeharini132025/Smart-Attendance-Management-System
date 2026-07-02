import React, { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Search, Users, FileSpreadsheet } from 'lucide-react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import ExcelImportModal from '../../components/ExcelImportModal';

function StudentModal({ student, depts, semesters, onClose, onSave }) {
  const [form, setForm] = useState(student || {
    name: '', email: '', phone: '', roll_number: '', department_id: '', semester_id: '',
    batch_year: '', section: '', dob: '', gender: '', guardian_name: '', guardian_phone: '', password: 'Student@123'
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      if (student?.id) { await api.put(`/admin/students/${student.id}`, form); toast.success('Student updated!'); }
      else { await api.post('/admin/students', form); toast.success('Student created!'); }
      onSave();
    } catch (err) { toast.error(err.response?.data?.message || 'Error saving'); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 680 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">{student?.id ? '✏️ Edit Student' : '➕ Add Student'}</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Full Name *</label><input className="form-input" value={form.name} onChange={e => set('name', e.target.value)} required /></div>
            <div className="form-group"><label className="form-label">Email *</label><input type="email" className="form-input" value={form.email} onChange={e => set('email', e.target.value)} required /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Roll Number *</label><input className="form-input" value={form.roll_number} onChange={e => set('roll_number', e.target.value)} required /></div>
            <div className="form-group"><label className="form-label">Phone</label><input className="form-input" value={form.phone} onChange={e => set('phone', e.target.value)} /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Department *</label>
              <select className="form-select" value={form.department_id} onChange={e => set('department_id', e.target.value)} required>
                <option value="">Select Dept</option>
                {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div className="form-group"><label className="form-label">Semester *</label>
              <select className="form-select" value={form.semester_id} onChange={e => set('semester_id', e.target.value)} required>
                <option value="">Select Sem</option>
                {semesters.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Batch Year</label><input className="form-input" value={form.batch_year} onChange={e => set('batch_year', e.target.value)} placeholder="2022-2026" /></div>
            <div className="form-group"><label className="form-label">Section</label><input className="form-input" value={form.section} onChange={e => set('section', e.target.value)} placeholder="A" maxLength={5} /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Date of Birth</label><input type="date" className="form-input" value={form.dob} onChange={e => set('dob', e.target.value)} /></div>
            <div className="form-group"><label className="form-label">Gender</label>
              <select className="form-select" value={form.gender} onChange={e => set('gender', e.target.value)}>
                <option value="">Select</option>
                <option>Male</option><option>Female</option><option>Other</option>
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Guardian Name</label><input className="form-input" value={form.guardian_name} onChange={e => set('guardian_name', e.target.value)} /></div>
            <div className="form-group"><label className="form-label">Guardian Phone</label><input className="form-input" value={form.guardian_phone} onChange={e => set('guardian_phone', e.target.value)} /></div>
          </div>
          {!student?.id && <div className="form-group"><label className="form-label">Password</label><input className="form-input" value={form.password} onChange={e => set('password', e.target.value)} placeholder="Student@123" /></div>}
          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save Student'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AdminStudents() {
  const [students, setStudents] = useState([]);
  const [depts, setDepts] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [modal, setModal] = useState(null);
  const [importModal, setImportModal] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [sRes, dRes, semRes] = await Promise.all([
        api.get('/admin/students'),
        api.get('/admin/departments'),
        api.get('/admin/semesters'),
      ]);
      setStudents(sRes.data.data || []);
      setDepts(dRes.data.data || []);
      setSemesters(semRes.data.data || []);
    } catch { toast.error('Failed to load data'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete student "${name}"?`)) return;
    try { await api.delete(`/admin/students/${id}`); toast.success('Deleted!'); load(); }
    catch (err) { toast.error(err.response?.data?.message || 'Delete failed'); }
  };

  const filtered = students.filter(s =>
    (!filterDept || String(s.department_id) === filterDept) &&
    (!search || s.name?.toLowerCase().includes(search.toLowerCase()) || s.roll_number?.toLowerCase().includes(search.toLowerCase()) || s.email?.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div>
      <div className="page-header">
        <h1>👨‍🎓 Students</h1>
        <p>Manage all student records ({students.length} total)</p>
      </div>

      <div className="section-header">
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <div className="search-box" style={{ width: 260 }}>
            <Search size={16} />
            <input placeholder="Search by name, roll no..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="form-select" style={{ width: 180 }} value={filterDept} onChange={e => setFilterDept(e.target.value)}>
            <option value="">All Departments</option>
            {depts.map(d => <option key={d.id} value={d.id}>{d.code}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-outline" onClick={() => setImportModal(true)} style={{ gap: 6 }}>
            <FileSpreadsheet size={16} /> Import Excel
          </button>
          <button className="btn btn-primary" onClick={() => setModal('create')}><Plus size={16} /> Add Student</button>
        </div>
      </div>

      {loading ? <div className="loading-center"><div className="spinner-lg spinner" /><p style={{ color: 'var(--text-muted)' }}>Loading...</p></div> : (
        <div className="table-wrapper">
          <table>
            <thead><tr><th>Student</th><th>Roll No.</th><th>Department</th><th>Semester</th><th>Section</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7}><div className="empty-state"><Users size={36} /><p>No students found</p></div></td></tr>
              ) : filtered.map(s => (
                <tr key={s.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--gradient-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', fontWeight: 700, color: 'white', flexShrink: 0 }}>
                        {s.name?.charAt(0)}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{s.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{s.email}</div>
                      </div>
                    </div>
                  </td>
                  <td><span className="badge badge-info">{s.roll_number}</span></td>
                  <td>{s.department_name}</td>
                  <td>{s.semester_name}</td>
                  <td>{s.section || '—'}</td>
                  <td><span className={`badge ${s.is_active ? 'badge-success' : 'badge-danger'}`}>{s.is_active ? 'Active' : 'Inactive'}</span></td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-outline btn-icon btn-sm" onClick={() => setModal(s)} title="Edit"><Pencil size={14} /></button>
                      <button className="btn btn-danger btn-icon btn-sm" onClick={() => handleDelete(s.id, s.name)} title="Delete"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <StudentModal
          student={modal === 'create' ? null : modal}
          depts={depts} semesters={semesters}
          onClose={() => setModal(null)}
          onSave={() => { setModal(null); load(); }}
        />
      )}
      {importModal && (
        <ExcelImportModal
          type="students"
          onClose={() => setImportModal(false)}
          onSuccess={() => { setImportModal(false); load(); }}
        />
      )}
    </div>
  );
}
