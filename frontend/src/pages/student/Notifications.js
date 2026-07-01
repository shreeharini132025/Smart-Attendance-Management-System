import React, { useEffect, useState } from 'react';
import { Bell, CheckCheck, AlertTriangle, Info } from 'lucide-react';
import api from '../../api/axios';
import toast from 'react-hot-toast';

const typeIcons = {
  shortage_alert: { icon: AlertTriangle, color: '#ef4444', bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.2)' },
  general: { icon: Info, color: '#6366f1', bg: 'rgba(99,102,241,0.1)', border: 'rgba(99,102,241,0.2)' },
  warning: { icon: AlertTriangle, color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.2)' },
  session_start: { icon: Bell, color: '#10b981', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.2)' },
};

export default function StudentNotifications() {
  const [notifs, setNotifs] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    api.get('/student/notifications')
      .then(r => setNotifs(r.data.data || []))
      .catch(() => toast.error('Failed to load notifications'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const markRead = async (id) => {
    await api.put(`/student/notifications/${id}/read`);
    setNotifs(n => n.map(x => x.id === id ? { ...x, is_read: 1 } : x));
  };

  const markAllRead = async () => {
    await api.put('/student/notifications/read-all');
    setNotifs(n => n.map(x => ({ ...x, is_read: 1 })));
    toast.success('All marked as read');
  };

  const unreadCount = notifs.filter(n => !n.is_read).length;

  return (
    <div>
      <div className="page-header">
        <h1>🔔 Notifications</h1>
        <p>Stay updated with attendance alerts and system messages</p>
      </div>

      <div className="section-header">
        <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          {unreadCount > 0 ? <><span className="badge badge-danger">{unreadCount}</span> unread</> : 'All read'}
        </span>
        {unreadCount > 0 && (
          <button className="btn btn-outline btn-sm" onClick={markAllRead}><CheckCheck size={14} /> Mark All Read</button>
        )}
      </div>

      {loading ? <div className="loading-center"><div className="spinner-lg spinner" /></div> :
        notifs.length === 0 ? (
          <div className="card"><div className="empty-state"><Bell size={48} /><h3>No notifications</h3><p>You're all caught up!</p></div></div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {notifs.map(n => {
              const cfg = typeIcons[n.type] || typeIcons.general;
              const Icon = cfg.icon;
              return (
                <div
                  key={n.id}
                  style={{ padding: 16, background: n.is_read ? 'var(--bg-card)' : cfg.bg, border: `1px solid ${n.is_read ? 'var(--border)' : cfg.border}`, borderRadius: 'var(--radius-lg)', display: 'flex', gap: 14, alignItems: 'flex-start', cursor: !n.is_read ? 'pointer' : 'default', opacity: n.is_read ? 0.7 : 1, transition: 'var(--transition)' }}
                  onClick={() => !n.is_read && markRead(n.id)}
                >
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: cfg.bg, border: `1px solid ${cfg.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon size={18} color={cfg.color} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: n.is_read ? 500 : 700, marginBottom: 4, fontSize: '0.9rem' }}>{n.title}</div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 6 }}>{n.message}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {new Date(n.created_at).toLocaleString('en-IN')}
                    </div>
                  </div>
                  {!n.is_read && <div style={{ width: 8, height: 8, borderRadius: '50%', background: cfg.color, flexShrink: 0, marginTop: 6 }} />}
                </div>
              );
            })}
          </div>
        )}
    </div>
  );
}
