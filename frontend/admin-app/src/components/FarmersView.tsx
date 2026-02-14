import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  getFarmers,
  registerFarmer,
  updateFarmer,
  deleteFarmer,
  restoreFarmer,
  type Farmer
} from '../api/adminApi';
import './AdminPage.css';

const FarmersView: React.FC = () => {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDeleted, setShowDeleted] = useState(false);
  const [modal, setModal] = useState<'new' | 'edit' | null>(null);
  const [editing, setEditing] = useState<Farmer | null>(null);
  const [form, setForm] = useState({ email: '', password: '', name: '', phone: '', region: '', farm_name: '', farm_size: '' });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const load = () => {
    if (!token) return;
    getFarmers(token, showDeleted)
      .then(setFarmers)
      .catch(() => setFarmers([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [token, showDeleted]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !form.email || !form.password || !form.farm_name?.trim()) return;
    setSaving(true);
    setMessage(null);
    try {
      await registerFarmer(token, {
        email: form.email,
        password: form.password,
        name: form.name || undefined,
        phone: form.phone || undefined,
        region: form.region || undefined,
        farm_name: form.farm_name.trim(),
        farm_size: (() => { const n = parseFloat(form.farm_size); return form.farm_size !== '' && !isNaN(n) ? n : undefined; })()
      });
      setMessage({ type: 'success', text: 'Farmer registered with farm!' });
      setModal(null);
      setForm({ email: '', password: '', name: '', phone: '', region: '', farm_name: '', farm_size: '' });
      load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed';
      setMessage({ type: 'error', text: msg });
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !editing) return;
    setSaving(true);
    setMessage(null);
    try {
      await updateFarmer(token, editing.id, {
        name: form.name || undefined,
        phone: form.phone || undefined,
        region: form.region || undefined
      });
      setMessage({ type: 'success', text: 'Farmer updated!' });
      setModal(null);
      setEditing(null);
      setForm({ email: '', password: '', name: '', phone: '', region: '', farm_name: '', farm_size: '' });
      load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed';
      setMessage({ type: 'error', text: msg });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!token || !confirm('Delete this farmer?')) return;
    try {
      await deleteFarmer(token, id);
      setMessage({ type: 'success', text: 'Farmer deleted' });
      load();
    } catch {
      setMessage({ type: 'error', text: 'Failed to delete' });
    }
  };

  const handleRestore = async (id: string) => {
    if (!token) return;
    try {
      await restoreFarmer(token, id);
      setMessage({ type: 'success', text: 'Farmer restored' });
      load();
    } catch {
      setMessage({ type: 'error', text: 'Failed to restore' });
    }
  };

  const openEdit = (f: Farmer) => {
    setEditing(f);
    setForm({ email: f.email || '', password: '', name: f.name || '', phone: f.phone || '', region: f.region || '', farm_name: '', farm_size: '' });
    setModal('edit');
  };

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div className="admin-header-row">
          <div>
            <h1>🇰🇪 Kenya Farms AI Admin</h1>
            <p>Manage Farmers</p>
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
        <div className="admin-toolbar">
          <button className="btn-primary" onClick={() => { setModal('new'); setForm({ email: '', password: '', name: '', phone: '', region: '', farm_name: '', farm_size: '' }); }}>
            + Register New Farmer
          </button>
          <label className="admin-checkbox">
            <input type="checkbox" checked={showDeleted} onChange={(e) => setShowDeleted(e.target.checked)} />
            Show deleted
          </label>
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
                  <th>Phone</th>
                  <th>Region</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {farmers.map((f) => (
                  <tr key={f.id} className={f.deleted_at ? 'row-deleted' : ''}>
                    <td>{f.name || '—'}</td>
                    <td>{f.email || '—'}</td>
                    <td>{f.phone || '—'}</td>
                    <td>{f.region || '—'}</td>
                    <td>{f.created_at ? new Date(f.created_at).toLocaleDateString() : '—'}</td>
                    <td>
                      {f.deleted_at ? (
                        <button className="btn-sm btn-success" onClick={() => handleRestore(f.id)}>Restore</button>
                      ) : (
                        <>
                          <button className="btn-sm btn-primary" onClick={() => openEdit(f)}>Edit</button>
                          <button className="btn-sm btn-danger" onClick={() => handleDelete(f.id)}>Delete</button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {farmers.length === 0 && <p className="admin-empty">No farmers found</p>}
          </div>
        )}
      </div>

      {modal === 'new' && (
        <div className="admin-modal-overlay" onClick={() => setModal(null)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Register New Farmer</h3>
            <form onSubmit={handleRegister}>
              <div className="admin-form-field">
                <label>Email *</label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
              </div>
              <div className="admin-form-field">
                <label>Password *</label>
                <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={6} />
              </div>
              <div className="admin-form-field">
                <label>Name</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="admin-form-field">
                <label>Phone</label>
                <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="admin-form-field">
                <label>Region</label>
                <input type="text" value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} />
              </div>
              <div className="admin-form-field">
                <label htmlFor="farmer-farm-name">Farm Name *</label>
                <input id="farmer-farm-name" type="text" value={form.farm_name} onChange={(e) => setForm({ ...form, farm_name: e.target.value })} required placeholder="e.g. Main Farm" aria-label="Farm Name" />
              </div>
              <div className="admin-form-field">
                <label htmlFor="farmer-farm-size">Farm Size (hectares)</label>
                <input id="farmer-farm-size" type="number" step="0.01" min="0" value={form.farm_size} onChange={(e) => setForm({ ...form, farm_size: e.target.value })} placeholder="e.g. 2.5" aria-label="Farm Size in hectares" />
              </div>
              <div className="admin-form-actions">
                <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Register'}</button>
                <button type="button" className="btn-secondary" onClick={() => setModal(null)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modal === 'edit' && editing && (
        <div className="admin-modal-overlay" onClick={() => { setModal(null); setEditing(null); }}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Edit Farmer</h3>
            <form onSubmit={handleUpdate}>
              <div className="admin-form-field">
                <label>Name</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="admin-form-field">
                <label>Phone</label>
                <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="admin-form-field">
                <label>Region</label>
                <input type="text" value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} />
              </div>
              <div className="admin-form-actions">
                <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Update'}</button>
                <button type="button" className="btn-secondary" onClick={() => { setModal(null); setEditing(null); }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="admin-footer">
        <span onClick={() => navigate('/')}>🏠 Dashboard</span>
        <span className="active">👥 Farmers</span>
        <span onClick={() => navigate('/crops')}>🌱 Crops</span>
        <span onClick={() => navigate('/analytics')}>📊 Analytics</span>
        <span onClick={() => navigate('/sensors')}>📡 Sensors</span>
        <span onClick={() => navigate('/robots')}>🤖 Robots</span>
        <span onClick={() => navigate('/profile')}>👤 Profile</span>
        <span onClick={() => navigate('/settings')}>⚙️ Settings</span>
        <span onClick={() => navigate('/requests')}>📋 Requests</span>
        <span onClick={() => navigate('/users')}>👤 Admin Users</span>
      </div>
    </div>
  );
};

export default FarmersView;
