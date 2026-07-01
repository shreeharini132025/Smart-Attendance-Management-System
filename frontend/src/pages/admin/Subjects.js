import React, { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Search, BookOpen, FileSpreadsheet } from 'lucide-react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import ExcelImportModal from '../../components/ExcelImportModal';

function SubjectModal({ subject, depts, semesters, onClose, onSave }) {
  const [form, setForm] = useState(subject || { name: '', code: '', department_id: '', semester_id: '', credits: 3, subject_type: 'theory', description: '' });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      if (subject?.id) { await api.put(`/admin/subjects/${subject.id}`, form); toast.success('Subject updated!'); }
      else { await api.post('/admin/subjects', form); toast.success('Subject created!'); }
      onSave();
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">{subject?.id ? '✏️ Edit Subject' : '➕ Add Subject'}</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Subject Name *</label><input className="form-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required /></div>
            <div className="form-group"><label className="form-label">Code *</label><input className="form-input" value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })} required /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Department *</label>
              <select className="form-select" value={form.department_id} onChange={e => setForm({ ...form, department_id: e.target.value })} required>
                <option value="">Select Dept</option>
                {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div className="form-group"><label className="form-label">Semester *</label>
              <select className="form-select" value={form.semester_id} onChange={e => setForm({ ...form, semester_id: e.target.value })} required>
                <option value="">Select Sem</option>
                {semesters.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Credits</label>
              <select className="form-select" value={form.credits} onChange={e => setForm({ ...form, credits: e.target.value })}>
                {[1,2,3,4,5,6].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group"><label className="form-label">Type</label>
              <select className="form-select" value={form.subject_type} onChange={e => setForm({ ...form, subject_type: e.target.value })}>
                <option value="theory">Theory</option>
                <option value="lab">Lab</option>
                <option value="elective">Elective</option>
              </select>
            </div>
          </div>
          <div className="form-group"><label className="form-label">Description</label><textarea className="form-textarea" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save Subject'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

const typeColor = { theory: 'badge-info', lab: 'badge-warning', elective: 'badge-purple' };

export default function AdminSubjects() {
  const [subjects, setSubjects] = useState([]);
  const [depts, setDepts] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null);
  const [importModal, setImportModal] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [sRes, dRes, semRes] = await Promise.all([api.get('/admin/subjects'), api.get('/admin/departments'), api.get('/admin/semesters')]);
      setSubjects(sRes.data.data || []);
      setDepts(dRes.data.data || []);
      setSemesters(semRes.data.data || []);
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete subject "${name}"?`)) return;
    try { await api.delete(`/admin/subjects/${id}`); toast.success('Deleted!'); load(); }
    catch (err) { toast.error(err.response?.data?.message || 'Delete failed'); }
  };

  const filtered = subjects.filter(s => !search || s.name?.toLowerCase().includes(search.toLowerCase()) || s.code?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <div className="page-header">
        <h1>📚 Subjects</h1>
        <p>Manage course subjects ({subjects.length} total)</p>
      </div>

      <div className="section-header">
        <div className="search-box" style={{ width: 280 }}>
          <Search size={16} />
          <input placeholder="Search subjects..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-outline" onClick={() => setImportModal(true)} style={{ gap: 6 }}>
            <FileSpreadsheet size={16} /> Import Excel
          </button>
          <button className="btn btn-primary" onClick={() => setModal('create')}><Plus size={16} /> Add Subject</button>
        </div>
      </div>

      {loading ? <div className="loading-center"><div className="spinner-lg spinner" /></div> : (
        <div className="table-wrapper">
          <table>
            <thead><tr><th>Subject</th><th>Code</th><th>Department</th><th>Semester</th><th>Credits</th><th>Type</th><th>Actions</th></tr></thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7}><div className="empty-state"><BookOpen size={36} /><p>No subjects found</p></div></td></tr>
              ) : filtered.map(s => (
                <tr key={s.id}>
                  <td style={{ fontWeight: 600 }}>{s.name}</td>
                  <td><span className="badge badge-info">{s.code}</span></td>
                  <td>{s.department_name}</td>
                  <td>{s.semester_name}</td>
                  <td>{s.credits}</td>
                  <td><span className={`badge ${typeColor[s.subject_type]}`}>{s.subject_type}</span></td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-outline btn-icon btn-sm" onClick={() => setModal(s)}><Pencil size={14} /></button>
                      <button className="btn btn-danger btn-icon btn-sm" onClick={() => handleDelete(s.id, s.name)}><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && <SubjectModal subject={modal === 'create' ? null : modal} depts={depts} semesters={semesters} onClose={() => setModal(null)} onSave={() => { setModal(null); load(); }} />}
      {importModal && (
        <ExcelImportModal
          type="subjects"
          onClose={() => setImportModal(false)}
          onSuccess={() => { setImportModal(false); load(); }}
        />
      )}
    </div>
  );
}
