import React, { useState, useRef } from 'react';
import { Upload, Download, CheckCircle, AlertCircle, FileSpreadsheet, X } from 'lucide-react';
import api from '../api/axios';
import toast from 'react-hot-toast';

/**
 * ExcelImportModal — reusable Excel bulk-import dialog
 * Props:
 *   type        — 'students' | 'faculty' | 'subjects' | 'departments'
 *   onClose     — called when modal is closed
 *   onSuccess   — called after a successful import (to refresh parent list)
 */
export default function ExcelImportModal({ type, onClose, onSuccess }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null); // { inserted, skipped, errors[] }
  const fileRef = useRef();

  const labels = {
    students:    { title: 'Import Students',    color: '#f59e0b', icon: '👨‍🎓' },
    faculty:     { title: 'Import Faculty',     color: '#10b981', icon: '🎓' },
    subjects:    { title: 'Import Subjects',    color: '#6366f1', icon: '📚' },
    departments: { title: 'Import Departments', color: '#06b6d4', icon: '🏢' },
  };
  const info = labels[type] || { title: 'Import', color: '#6366f1', icon: '📋' };

  const handleFile = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    if (!f.name.match(/\.(xlsx|xls)$/i)) {
      toast.error('Please select an Excel file (.xlsx or .xls)');
      return;
    }
    setFile(f);
    setResult(null);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) { fileRef.current.files = e.dataTransfer.files; handleFile({ target: { files: [f] } }); }
  };

  const handleUpload = async () => {
    if (!file) return toast.error('Please select a file first');
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await api.post(`/admin/import/${type}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setResult(res.data.results);
      if (res.data.results.inserted > 0) {
        toast.success(`✅ ${res.data.results.inserted} records imported successfully!`);
        onSuccess?.();
      } else {
        toast.error('No records imported. Check errors below.');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Import failed');
    } finally {
      setUploading(false);
    }
  };

  const downloadTemplate = () => {
    // Use a direct link so the browser triggers the file download
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    const a = document.createElement('a');
    a.href = `${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/admin/import/template/${type}`;
    a.setAttribute('download', `${type}_template.xlsx`);
    // Pass auth header via fetch to get the blob
    fetch(a.href, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob())
      .then(blob => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${type}_template.xlsx`;
        link.click();
        URL.revokeObjectURL(url);
      })
      .catch(() => toast.error('Failed to download template'));
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 580 }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <h3 className="modal-title">
            <span style={{ marginRight: 8 }}>{info.icon}</span>
            {info.title} via Excel
          </h3>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>

        {/* Step 1: Download Template */}
        <div style={{ marginBottom: 20, padding: 14, background: 'var(--bg-card2)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
          <div className="excel-import-step1">
            <div>
              <p style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: 2 }}>Step 1: Download Template</p>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Get the Excel template with the correct column format
              </p>
            </div>
            <button className="btn btn-outline btn-sm" onClick={downloadTemplate} style={{ flexShrink: 0, gap: 6 }}>
              <Download size={14} /> Template
            </button>
          </div>
        </div>

        {/* Step 2: Upload File */}
        <div style={{ marginBottom: 20 }}>
          <p style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: 10 }}>Step 2: Upload Your File</p>
          <div
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            onClick={() => fileRef.current?.click()}
            style={{
              border: `2px dashed ${file ? info.color : 'var(--border)'}`,
              borderRadius: 'var(--radius-lg)',
              padding: '32px 20px',
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              background: file ? `${info.color}08` : 'var(--bg-card2)',
            }}
          >
            <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleFile} />
            {file ? (
              <>
                <FileSpreadsheet size={40} color={info.color} style={{ marginBottom: 10 }} />
                <p style={{ fontWeight: 700, color: info.color }}>{file.name}</p>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>
                  {(file.size / 1024).toFixed(1)} KB — Click to change
                </p>
              </>
            ) : (
              <>
                <Upload size={36} color="var(--text-muted)" style={{ marginBottom: 10 }} />
                <p style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Drop your Excel file here</p>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>or click to browse (.xlsx, .xls)</p>
              </>
            )}
          </div>
        </div>

        {/* Results */}
        {result && (
          <div style={{ marginBottom: 20, borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
              <div style={{ padding: 16, background: 'rgba(16,185,129,0.08)', borderRight: '1px solid var(--border)', textAlign: 'center' }}>
                <CheckCircle size={24} color="#10b981" style={{ marginBottom: 4 }} />
                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#10b981' }}>{result.inserted}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Imported</div>
              </div>
              <div style={{ padding: 16, background: 'rgba(239,68,68,0.08)', textAlign: 'center' }}>
                <AlertCircle size={24} color="#ef4444" style={{ marginBottom: 4 }} />
                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#ef4444' }}>{result.skipped}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Skipped</div>
              </div>
            </div>
            {result.errors.length > 0 && (
              <div style={{ padding: 12, maxHeight: 150, overflowY: 'auto', borderTop: '1px solid var(--border)' }}>
                <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#ef4444', marginBottom: 6 }}>Errors:</p>
                {result.errors.map((e, i) => (
                  <p key={i} style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 2 }}>• {e}</p>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Column Guide */}
        {!result && (
          <div style={{ marginBottom: 16, fontSize: '0.75rem', color: 'var(--text-muted)', background: 'var(--bg-card2)', borderRadius: 'var(--radius-md)', padding: 12 }}>
            <p style={{ fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>📋 Required Columns:</p>
            {type === 'students' && <p>name, email, roll_number, department, semester  <span style={{ color: '#6366f1' }}>(optional: phone, batch_year, section, gender, password)</span></p>}
            {type === 'faculty' && <p>name, email, department  <span style={{ color: '#6366f1' }}>(optional: phone, faculty_id, designation, qualification, password)</span></p>}
            {type === 'subjects' && <p>name, code, department, semester  <span style={{ color: '#6366f1' }}>(optional: credits, type)</span></p>}
            {type === 'departments' && <p>name, code  <span style={{ color: '#6366f1' }}>(optional: description)</span></p>}
          </div>
        )}

        {/* Footer */}
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Close</button>
          <button
            className="btn btn-primary"
            onClick={handleUpload}
            disabled={!file || uploading}
            style={{ gap: 8 }}
          >
            {uploading
              ? <><div className="spinner" style={{ width: 16, height: 16 }} /> Importing...</>
              : <><Upload size={16} /> Import Now</>
            }
          </button>
        </div>
      </div>
    </div>
  );
}
