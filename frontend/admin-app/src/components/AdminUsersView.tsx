import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  getAdminUsers,
  createAdminUser,
  updateUserRole,
  deleteAdminUser,
  type AdminUser
} from '../api/adminApi';
import AdminAccessRequestsSection from './AdminAccessRequestsSection';
import './AdminPage.css';

const AdminUsersView: React.FC = () => {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddUser, setShowAddUser] = useState(false);
  const [userForm, setUserForm] = useState({ email: '', password: '', name: '', phone: '' });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const load = () => {
    if (!token) return;
    getAdminUsers(token)
      .then(setUsers)
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [token]);

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !userForm.email || !userForm.password) return;
    setSaving(true);
    setMessage(null);
    try {
      await createAdminUser(token, {
        email: userForm.email,
        password: userForm.password,
        name: userForm.name || undefined,
        phone: userForm.phone || undefined
      });
      setMessage({ type: 'success', text: 'Admin user created!' });
      setShowAddUser(false);
      setUserForm({ email: '', password: '', name: '', phone: '' });
      load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed';
      setMessage({ type: 'error', text: msg });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (!token || !confirm('Delete this user? This cannot be undone.')) return;
    try {
      await deleteAdminUser(token, id);
      setMessage({ type: 'success', text: 'User deleted' });
      load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed';
      setMessage({ type: 'error', text: msg });
    }
  };

  const handleChangeRole = async (id: string, role: 'admin' | 'farmer') => {
    if (!token) return;
    try {
      await updateUserRole(token, id, role);
      setMessage({ type: 'success', text: 'Role updated' });
      load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed';
      setMessage({ type: 'error', text: msg });
    }
  };

  const adminUsers = users.filter(u => u.role === 'admin');

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div className="admin-header-row">
          <div>
            <h1>🇰🇪 Kenya Farms AI Admin</h1>
            <p>Admin Users</p>
          </div>
          <div className="admin-header-actions">
            <button onClick={() => navigate('/')}>Dashboard</button>
            <button onClick={() => navigate('/users')} className="active" aria-label="Admin Users">👥 Admin Users</button>
            <button onClick={() => navigate('/settings')}>⚙️ Settings</button>
            <button onClick={() => { logout(); navigate('/login'); }}>Logout</button>
          </div>
        </div>
      </header>

      <div className="admin-page-content">
        <div className="admin-toolbar">
          <button className="btn-primary" onClick={() => setShowAddUser(true)}>+ Add Admin</button>
        </div>

        {message && (
          <div className={`admin-message admin-message-${message.type}`}>{message.text}</div>
        )}

        {showAddUser && (
          <form onSubmit={handleCreateAdmin} className="admin-modal" style={{ marginBottom: '20px', maxWidth: '400px' }}>
            <h3 style={{ marginTop: 0 }}>Create Admin User</h3>
            <div className="admin-form-field">
              <label htmlFor="admin-user-email">Email *</label>
              <input id="admin-user-email" type="email" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} required aria-label="Admin email" />
            </div>
            <div className="admin-form-field">
              <label htmlFor="admin-user-password">Password *</label>
              <input id="admin-user-password" type="password" value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} required minLength={6} aria-label="Admin password" />
            </div>
            <div className="admin-form-field">
              <label htmlFor="admin-user-name">Name</label>
              <input id="admin-user-name" type="text" value={userForm.name} onChange={(e) => setUserForm({ ...userForm, name: e.target.value })} aria-label="Admin name" />
            </div>
            <div className="admin-form-field">
              <label htmlFor="admin-user-phone">Phone</label>
              <input id="admin-user-phone" type="tel" value={userForm.phone} onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })} aria-label="Admin phone" />
            </div>
            <div className="admin-form-actions">
              <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Creating...' : 'Create Admin'}</button>
              <button type="button" className="btn-secondary" onClick={() => setShowAddUser(false)}>Cancel</button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="admin-loading">Loading...</div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {adminUsers.map((u) => (
                  <tr key={u.id}>
                    <td>{u.email}</td>
                    <td>{u.name || '—'}</td>
                    <td>
                      <select value={u.role} onChange={(e) => handleChangeRole(u.id, e.target.value as 'admin' | 'farmer')} aria-label={`Role for ${u.email}`}>
                        <option value="admin">Admin</option>
                        <option value="farmer">Farmer</option>
                      </select>
                    </td>
                    <td>{u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}</td>
                    <td>
                      <button className="btn-sm btn-danger" onClick={() => handleDeleteUser(u.id)} disabled={adminUsers.length <= 1}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {adminUsers.length === 0 && <p className="admin-empty">No admin users</p>}
          </div>
        )}

        {token && (
          <div className="admin-requests-section-wrap" style={{ marginTop: 32 }}>
            <AdminAccessRequestsSection token={token} onRefresh={load} />
          </div>
        )}
      </div>

      <div className="admin-footer">
        <span onClick={() => navigate('/')}>🏠 Dashboard</span>
        <span onClick={() => navigate('/farmers')}>👥 Farmers</span>
        <span onClick={() => navigate('/farms')}>🌾 Farms</span>
        <span onClick={() => navigate('/crops')}>🌱 Crops</span>
        <span onClick={() => navigate('/analytics')}>📊 Analytics</span>
        <span onClick={() => navigate('/sensors')}>📡 Sensors</span>
        <span onClick={() => navigate('/robots')}>🤖 Robots</span>
        <span onClick={() => navigate('/settings')}>⚙️ Settings</span>
        <span className="active">👤 Admin Users</span>
      </div>
    </div>
  );
};

export default AdminUsersView;
