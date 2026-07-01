import React, { useEffect, useState } from 'react';
import { Download, Filter, FileText } from 'lucide-react';
import api from '../../api/axios';
import toast from 'react-hot-toast';

function AttPct({ pct }) {
  const p = parseFloat(pct) || 0;
  const cls = p >= 75 ? 'good' : p >= 60 ? 'warn' : 'bad';
  const color = p >= 75 ? '#10b981' : p >= 60 ? '#f59e0b' : '#ef4444';
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: '0.85rem', fontWeight: 700, color }}>{p}%</span>
      </div>
      <div className="progress-bar">
        <div className={`progress-fill ${cls}`} style={{ width: `${Math.min(p, 100)}%` }} />
      </div>
    </div>
  );
}

export default function AdminReports() {
  const [depts, setDepts] = useState([]);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ department_id: '', from_date: '', to_date: '' });

  useEffect(() => {
    api.get('/admin/departments').then(r => setDepts(r.data.data || []));
    loadReport();
  }, []);

  const loadReport = async (f = filters) => {
    setLoading(true);
    const params = new URLSearchParams();
    if (f.department_id) params.append('department_id', f.department_id);
    if (f.from_date) params.append('from_date', f.from_date);
    if (f.to_date) params.append('to_date', f.to_date);
    try {
      const res = await api.get(`/admin/reports/attendance?${params}`);
      setData(res.data.data || []);
    } catch { toast.error('Failed to load report'); }
    finally { setLoading(false); }
  };

  const handleFilter = () => loadReport(filters);

  const exportCSV = () => {
    if (!data.length) return toast.error('No data to export');
    const headers = ['Student Name', 'Roll Number', 'Department', 'Subject', 'Total Sessions', 'Attended', 'Percentage'];
    const rows = data.map(d => [d.student_name, d.roll_number, d.department_name, d.subject_name, d.total_sessions, d.attended, d.percentage + '%']);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'attendance_report.csv'; a.click();
    URL.revokeObjectURL(url);
    toast.success('Report exported!');
  };

  const shortageStudents = data.filter(d => parseFloat(d.percentage) < 75);

  return (
    <div>
      <div className="page-header">
        <h1>📊 Attendance Reports</h1>
        <p>Generate and export attendance reports</p>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ flex: 1, minWidth: 150, marginBottom: 0 }}>
            <label className="form-label">Department</label>
            <select className="form-select" value={filters.department_id} onChange={e => setFilters({ ...filters, department_id: e.target.value })}>
              <option value="">All Departments</option>
              {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ flex: 1, minWidth: 150, marginBottom: 0 }}>
            <label className="form-label">From Date</label>
            <input type="date" className="form-input" value={filters.from_date} onChange={e => setFilters({ ...filters, from_date: e.target.value })} />
          </div>
          <div className="form-group" style={{ flex: 1, minWidth: 150, marginBottom: 0 }}>
            <label className="form-label">To Date</label>
            <input type="date" className="form-input" value={filters.to_date} onChange={e => setFilters({ ...filters, to_date: e.target.value })} />
          </div>
          <button className="btn btn-primary" onClick={handleFilter}><Filter size={16} /> Apply Filter</button>
          <button className="btn btn-success" onClick={exportCSV}><Download size={16} /> Export CSV</button>
        </div>
      </div>

      {/* Summary stats */}
      {data.length > 0 && (
        <div className="stats-grid" style={{ marginBottom: 24 }}>
          {[
            { label: 'Total Records', value: data.length, color: '#6366f1' },
            { label: 'Shortage (<75%)', value: shortageStudents.length, color: '#ef4444' },
            { label: 'Good (≥75%)', value: data.length - shortageStudents.length, color: '#10b981' },
            { label: 'Avg Attendance', value: data.length ? `${(data.reduce((a, d) => a + (parseFloat(d.percentage) || 0), 0) / data.length).toFixed(1)}%` : '0%', color: '#f59e0b' },
          ].map((s, i) => (
            <div key={i} className="card" style={{ textAlign: 'center', borderColor: s.color + '30' }}>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Report Table */}
      {loading ? <div className="loading-center"><div className="spinner-lg spinner" /></div> : (
        <div className="table-wrapper">
          <table>
            <thead><tr><th>Student</th><th>Roll No.</th><th>Department</th><th>Subject</th><th>Sessions</th><th>Attended</th><th>Percentage</th></tr></thead>
            <tbody>
              {data.length === 0 ? (
                <tr><td colSpan={7}><div className="empty-state"><FileText size={40} /><h3>No report data</h3><p>Apply filters and generate a report.</p></div></td></tr>
              ) : data.map((d, i) => (
                <tr key={i} style={{ background: parseFloat(d.percentage) < 75 ? 'rgba(239,68,68,0.04)' : 'transparent' }}>
                  <td style={{ fontWeight: 600 }}>{d.student_name}</td>
                  <td><span className="badge badge-info">{d.roll_number}</span></td>
                  <td>{d.department_name}</td>
                  <td>{d.subject_name}</td>
                  <td>{d.total_sessions}</td>
                  <td>{d.attended}</td>
                  <td style={{ minWidth: 160 }}><AttPct pct={d.percentage} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
