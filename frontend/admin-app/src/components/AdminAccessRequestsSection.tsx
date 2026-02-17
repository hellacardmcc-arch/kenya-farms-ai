import React, { useState, useEffect } from 'react';
import {
  getAccessRequests,
  approveAccessRequest,
  rejectAccessRequest,
  type AccessRequest
} from '../api/adminApi';
import './RequestsView.css';

interface AdminAccessRequestsSectionProps {
  token: string;
  onRefresh?: () => void;
}

const AdminAccessRequestsSection: React.FC<AdminAccessRequestsSectionProps> = ({ token, onRefresh }) => {
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
    getAccessRequests(token, statusFilter, 'admin')
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
      setMessage({ type: 'success', text: 'Request approved. Admin user created and feedback email sent.' });
      setModal(null);
      setSelected(null);
      load();
      onRefresh?.();
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
      onRefresh?.();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed';
      setMessage({ type: 'error', text: msg });
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (d: string) => new Date(d).toLocaleString();

  return (
    <div className="admin-access-requests-section">
      <h3 className="section-title">Admin Access Requests</h3>
      <p className="section-desc">Users who requested admin access via the registration form.</p>
      <div className="requests-filters" style={{ marginBottom: 12 }}>
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
            <p className="admin-empty">No {statusFilter} admin requests</p>
          )}
        </div>
      )}

      {modal === 'approve' && selected && (
        <div className="admin-modal-overlay" onClick={() => { setModal(null); setSelected(null); }}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <h3>✅ Approve Admin Request</h3>
            <p><strong>{selected.name || selected.email}</strong></p>
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
            <h3>❌ Reject Admin Request</h3>
            <p><strong>{selected.name || selected.email}</strong></p>
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
    </div>
  );
};

export default AdminAccessRequestsSection;
