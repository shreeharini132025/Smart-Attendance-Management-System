import React, { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Search, Building2, FileSpreadsheet } from 'lucide-react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import ExcelImportModal from '../../components/ExcelImportModal';

function Modal({ dept, onClose, onSave, depts }) {
  const [form, setForm] = useState(dept || { name: '', code: '', description: '', hod_name: '' });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (dept?.id) { await api.put(`/admin/departments/${dept.id}`, form); toast.success('Department updated!'); }
      else { await api.post('/admin/departments', form); toast.success('Department created!'); }
      onSave();
    } catch (err) { toast.error(err.response?.data?.message || 'Error saving department'); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">{dept?.id ? '✏️ Edit Department' : '➕ New Department'}</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Department Name *</label>
              <input className="form-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Computer Science" required />
            </div>
            <div className="form-group">
              <label className="form-label">Code *</label>
              <input className="form-input" value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="CSE" maxLength={10} required />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">HOD Name</label>
            <input className="form-input" value={form.hod_name} onChange={e => setForm({ ...form, hod_name: e.target.value })} placeholder="Dr. John Smith" />
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea className="form-textarea" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Department description..." />
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save Department'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AdminDepartments() {
  const [depts, setDepts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null); // null | 'create' | dept object
  const [importModal, setImportModal] = useState(false);

  const load = () => {
    setLoading(true);
    api.get('/admin/departments').then(r => setDepts(r.data.data || [])).catch(() => toast.error('Failed to load')).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete department "${name}"? This may affect related records.`)) return;
    try { await api.delete(`/admin/departments/${id}`); toast.success('Deleted!'); load(); }
    catch (err) { toast.error(err.response?.data?.message || 'Delete failed'); }
  };

  const filtered = depts.filter(d => d.name.toLowerCase().includes(search.toLowerCase()) || d.code.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <div className="page-header">
        <h1>🏛️ Departments</h1>
        <p>Manage academic departments</p>
      </div>

      <div className="section-header">
        <div className="search-box" style={{ width: 280 }}>
          <Search size={16} />
          <input placeholder="Search departments..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-outline" onClick={() => setImportModal(true)} style={{ gap: 6 }}>
            <FileSpreadsheet size={16} /> Import Excel
          </button>
          <button className="btn btn-primary" onClick={() => setModal('create')}><Plus size={16} /> Add Department</button>
        </div>
      </div>

      {loading ? (
        <div className="loading-center"><div className="spinner-lg spinner" /><p style={{ color: 'var(--text-muted)' }}>Loading...</p></div>
      ) : filtered.length === 0 ? (
        <div className="card"><div className="empty-state"><Building2 size={48} /><h3>No departments found</h3><p>Add your first department to get started.</p></div></div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {filtered.map(d => (
            <div key={d.id} className="card" style={{ position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'var(--gradient-primary)' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(99,102,241,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)' }}>
                    <Building2 size={20} color="var(--primary-light)" />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{d.name}</div>
                    <div style={{ fontSize: '0.75rem' }}><span className="badge badge-purple">{d.code}</span></div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-outline btn-icon btn-sm" onClick={() => setModal(d)} title="Edit"><Pencil size={14} /></button>
                  <button className="btn btn-danger btn-icon btn-sm" onClick={() => handleDelete(d.id, d.name)} title="Delete"><Trash2 size={14} /></button>
                </div>
              </div>
              {d.hod_name && <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 12 }}>HOD: {d.hod_name}</p>}
              <div style={{ display: 'flex', gap: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontWeight: 700, color: 'var(--primary-light)' }}>{d.student_count || 0}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Students</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontWeight: 700, color: '#10b981' }}>{d.faculty_count || 0}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Faculty</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontWeight: 700, color: '#f59e0b' }}>{d.subject_count || 0}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Subjects</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <Modal
          dept={modal === 'create' ? null : modal}
          depts={depts}
          onClose={() => setModal(null)}
          onSave={() => { setModal(null); load(); }}
        />
      )}
      {importModal && (
        <ExcelImportModal
          type="departments"
          onClose={() => setImportModal(false)}
          onSuccess={() => { setImportModal(false); load(); }}
        />
      )}
    </div>
  );
}
