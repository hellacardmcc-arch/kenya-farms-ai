import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  getAccessRequests,
  approveAccessRequest,
  rejectAccessRequest,
  type AccessRequest
} from '../api/adminApi';
import './AdminPage.css';
import './RequestsView.css';

const RequestsView: React.FC = () => {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [modal, setModal] = useState<'approve' | 'reject' | null>(null);
  const [selected, setSelected] = useState<AccessRequest | null>(null);
  const [feedback, setFeedback] = useState('');
  const [saving, setSaving] = useState(false);

  const load = () => {
    if (!token) return;
    getAccessRequests(token, statusFilter)
      .then(setRequests)
      .catch(() => setRequests([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [token, statusFilter]);

  const openApprove = (r: AccessRequest) => {
    setSelected(r);
    setFeedback('');
    setModal('approve');
  };

  const openReject = (r: AccessRequest) => {
    setSelected(r);
    setFeedback('');
    setModal('reject');
  };

  const handleApprove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !selected) return;
    setSaving(true);
    setMessage(null);
    try {
      await approveAccessRequest(token, selected.id, feedback.trim() || undefined);
      setMessage({ type: 'success', text: 'Request approved. User created and feedback email sent.' });
      setModal(null);
      setSelected(null);
      load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed';
      setMessage({ type: 'error', text: msg });
    } finally {
      setSaving(false);
    }
  };

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !selected) return;
    if (!feedback.trim()) {
      setMessage({ type: 'error', text: 'Feedback message is required when rejecting.' });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await rejectAccessRequest(token, selected.id, feedback.trim());
      setMessage({ type: 'success', text: 'Request rejected. Feedback email sent.' });
      setModal(null);
      setSelected(null);
      load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed';
      setMessage({ type: 'error', text: msg });
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (d: string) => new Date(d).toLocaleString();

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div className="admin-header-row">
          <div>
            <h1>🇰🇪 Kenya Farms AI Admin</h1>
            <p>Access Requests</p>
          </div>
          <div className="admin-header-actions">
            <button onClick={() => navigate('/')}>Dashboard</button>
            <button onClick={() => navigate('/users')}>👥 Admin Users</button>
            <button onClick={() => navigate('/profile')}>👤 Profile</button>
            <button onClick={() => { logout(); navigate('/login'); }}>Logout</button>
          </div>
        </div>
      </header>

      <div className="admin-page-content">
        <div className="admin-toolbar requests-toolbar">
          <div className="requests-filters">
            <button
              className={`filter-btn ${statusFilter === 'pending' ? 'active' : ''}`}
              onClick={() => setStatusFilter('pending')}
            >
              Pending
            </button>
            <button
              className={`filter-btn ${statusFilter === 'approved' ? 'active' : ''}`}
              onClick={() => setStatusFilter('approved')}
            >
              Approved
            </button>
            <button
              className={`filter-btn ${statusFilter === 'rejected' ? 'active' : ''}`}
              onClick={() => setStatusFilter('rejected')}
            >
              Rejected
            </button>
          </div>
        </div>

        {message && (
          <div className={`admin-message admin-message-${message.type}`}>{message.text}</div>
        )}

        {loading ? (
          <div className="admin-loading">Loading...</div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Farm</th>
                  <th>Date</th>
                  {statusFilter === 'pending' && <th>Actions</th>}
                  {statusFilter !== 'pending' && <th>Feedback</th>}
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => (
                  <tr key={r.id}>
                    <td>{r.name || '—'}</td>
                    <td>{r.email}</td>
                    <td><span className={`badge-role ${r.requested_role}`}>{r.requested_role}</span></td>
                    <td>{r.requested_role === 'farmer' ? (r.farm_name || '—') : '—'}</td>
                    <td>{formatDate(r.created_at)}</td>
                    {statusFilter === 'pending' && (
                      <td>
                        <button className="btn-sm btn-success" onClick={() => openApprove(r)}>Approve</button>
                        <button className="btn-sm btn-danger" onClick={() => openReject(r)}>Reject</button>
                      </td>
                    )}
                    {statusFilter !== 'pending' && (
                      <td className="feedback-cell">{r.feedback_message || '—'}</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {requests.length === 0 && (
              <p className="admin-empty">No {statusFilter} requests</p>
            )}
          </div>
        )}
      </div>

      {modal === 'approve' && selected && (
        <div className="admin-modal-overlay" onClick={() => { setModal(null); setSelected(null); }}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <h3>✅ Approve Request</h3>
            <p><strong>{selected.name || selected.email}</strong> — {selected.requested_role}</p>
            <form onSubmit={handleApprove}>
              <div className="admin-form-field">
                <label>Feedback message (optional, included in approval email)</label>
                <textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="e.g. Welcome! You can now log in."
                  rows={3}
                />
              </div>
              <div className="admin-form-actions">
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? 'Approving...' : 'Approve & Send Email'}
                </button>
                <button type="button" className="btn-secondary" onClick={() => { setModal(null); setSelected(null); }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modal === 'reject' && selected && (
        <div className="admin-modal-overlay" onClick={() => { setModal(null); setSelected(null); }}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <h3>❌ Reject Request</h3>
            <p><strong>{selected.name || selected.email}</strong> — {selected.requested_role}</p>
            <form onSubmit={handleReject}>
              <div className="admin-form-field">
                <label>Feedback message (required, sent to user via email)</label>
                <textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="e.g. We cannot approve your request at this time because..."
                  rows={4}
                  required
                />
              </div>
              <div className="admin-form-actions">
                <button type="submit" className="btn-danger" disabled={saving || !feedback.trim()}>
                  {saving ? 'Rejecting...' : 'Reject & Send Email'}
                </button>
                <button type="button" className="btn-secondary" onClick={() => { setModal(null); setSelected(null); }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="admin-footer">
        <span onClick={() => navigate('/')}>🏠 Dashboard</span>
        <span onClick={() => navigate('/farmers')}>👥 Farmers</span>
        <span onClick={() => navigate('/crops')}>🌱 Crops</span>
        <span onClick={() => navigate('/analytics')}>📊 Analytics</span>
        <span onClick={() => navigate('/sensors')}>📡 Sensors</span>
        <span onClick={() => navigate('/robots')}>🤖 Robots</span>
        <span onClick={() => navigate('/profile')}>👤 Profile</span>
        <span onClick={() => navigate('/settings')}>⚙️ Settings</span>
        <span onClick={() => navigate('/users')}>👤 Admin Users</span>
        <span className="active">📋 Requests</span>
      </div>
    </div>
  );
};

export default RequestsView;
