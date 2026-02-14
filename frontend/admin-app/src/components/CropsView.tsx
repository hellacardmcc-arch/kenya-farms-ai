import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  getCrops,
  getFarms,
  createCrop,
  updateCrop,
  deleteCrop,
  restoreCrop,
  type Crop,
  type Farm
} from '../api/adminApi';
import './AdminPage.css';

const CropsView: React.FC = () => {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const [crops, setCrops] = useState<Crop[]>([]);
  const [farms, setFarms] = useState<Farm[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDeleted, setShowDeleted] = useState(false);
  const [modal, setModal] = useState<'new' | 'edit' | null>(null);
  const [editing, setEditing] = useState<Crop | null>(null);
  const [form, setForm] = useState<Partial<Crop>>({ name: '', farm_id: '', swahili_name: '', status: 'growing' });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const load = () => {
    if (!token) return;
    Promise.all([getCrops(token, showDeleted), getFarms(token)])
      .then(([c, f]) => { setCrops(c); setFarms(f); })
      .catch(() => { setCrops([]); setFarms([]); })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [token, showDeleted]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !form.name || !form.farm_id) return;
    setSaving(true);
    setMessage(null);
    try {
      await createCrop(token, { ...form, farm_id: form.farm_id, name: form.name });
      setMessage({ type: 'success', text: 'Crop created!' });
      setModal(null);
      setForm({ name: '', farm_id: '', swahili_name: '', status: 'growing' });
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
      await updateCrop(token, editing.id, form);
      setMessage({ type: 'success', text: 'Crop updated!' });
      setModal(null);
      setEditing(null);
      load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed';
      setMessage({ type: 'error', text: msg });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!token || !confirm('Delete this crop?')) return;
    try {
      await deleteCrop(token, id);
      setMessage({ type: 'success', text: 'Crop deleted' });
      load();
    } catch {
      setMessage({ type: 'error', text: 'Failed to delete' });
    }
  };

  const handleRestore = async (id: string) => {
    if (!token) return;
    try {
      await restoreCrop(token, id);
      setMessage({ type: 'success', text: 'Crop restored' });
      load();
    } catch {
      setMessage({ type: 'error', text: 'Failed to restore' });
    }
  };

  const openEdit = (c: Crop) => {
    setEditing(c);
    setForm({ name: c.name, swahili_name: c.swahili_name, planted_date: c.planted_date, harvest_date: c.harvest_date, area_hectares: c.area_hectares, status: c.status });
    setModal('edit');
  };

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div className="admin-header-row">
          <div>
            <h1>🇰🇪 Kenya Farms AI Admin</h1>
            <p>Manage Crops</p>
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
          <button className="btn-primary" onClick={() => { setModal('new'); setForm({ name: '', farm_id: farms[0]?.id || '', swahili_name: '', status: 'growing' }); }}>
            + Add New Crop
          </button>
          <label className="admin-checkbox">
            <input type="checkbox" checked={showDeleted} onChange={(e) => setShowDeleted(e.target.checked)} />
            Show deleted
          </label>
        </div>

        {message && <div className={`admin-message admin-message-${message.type}`}>{message.text}</div>}

        {loading ? (
          <div className="admin-loading">Loading...</div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Swahili</th>
                  <th>Farm</th>
                  <th>Farmer</th>
                  <th>Planted</th>
                  <th>Harvest</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {crops.map((c) => (
                  <tr key={c.id} className={c.deleted_at ? 'row-deleted' : ''}>
                    <td>{c.name}</td>
                    <td>{c.swahili_name || '—'}</td>
                    <td>{c.farm_name || '—'}</td>
                    <td>{c.farmer_name || '—'}</td>
                    <td>{c.planted_date ? new Date(c.planted_date).toLocaleDateString() : '—'}</td>
                    <td>{c.harvest_date ? new Date(c.harvest_date).toLocaleDateString() : '—'}</td>
                    <td>{c.status || '—'}</td>
                    <td>
                      {c.deleted_at ? (
                        <button className="btn-sm btn-success" onClick={() => handleRestore(c.id)}>Restore</button>
                      ) : (
                        <>
                          <button className="btn-sm btn-primary" onClick={() => openEdit(c)}>Edit</button>
                          <button className="btn-sm btn-danger" onClick={() => handleDelete(c.id)}>Delete</button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {crops.length === 0 && <p className="admin-empty">No crops found</p>}
          </div>
        )}
      </div>

      {modal === 'new' && (
        <div className="admin-modal-overlay" onClick={() => setModal(null)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Add New Crop</h3>
            {farms.length === 0 && <p style={{ color: '#ef4444', marginBottom: '16px' }}>No farms found. Create a farm first via Farmers page.</p>}
            <form onSubmit={handleCreate}>
              <div className="admin-form-field">
                <label>Farm *</label>
                <select value={form.farm_id} onChange={(e) => setForm({ ...form, farm_id: e.target.value })} required>
                  <option value="">Select farm</option>
                  {farms.map((f) => (
                    <option key={f.id} value={f.id}>{f.name || f.id} ({f.farmer_name})</option>
                  ))}
                </select>
              </div>
              <div className="admin-form-field">
                <label>Name *</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="admin-form-field">
                <label>Swahili Name</label>
                <input type="text" value={form.swahili_name} onChange={(e) => setForm({ ...form, swahili_name: e.target.value })} />
              </div>
              <div className="admin-form-field">
                <label>Planted Date</label>
                <input type="date" value={form.planted_date || ''} onChange={(e) => setForm({ ...form, planted_date: e.target.value })} />
              </div>
              <div className="admin-form-field">
                <label>Harvest Date</label>
                <input type="date" value={form.harvest_date || ''} onChange={(e) => setForm({ ...form, harvest_date: e.target.value })} />
              </div>
              <div className="admin-form-field">
                <label>Area (hectares)</label>
                <input type="number" step="0.01" value={form.area_hectares ?? ''} onChange={(e) => setForm({ ...form, area_hectares: e.target.value ? parseFloat(e.target.value) : undefined })} />
              </div>
              <div className="admin-form-field">
                <label>Status</label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  <option value="growing">Growing</option>
                  <option value="harvested">Harvested</option>
                  <option value="planned">Planned</option>
                </select>
              </div>
              <div className="admin-form-actions">
                <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Create'}</button>
                <button type="button" className="btn-secondary" onClick={() => setModal(null)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modal === 'edit' && editing && (
        <div className="admin-modal-overlay" onClick={() => { setModal(null); setEditing(null); }}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Edit Crop</h3>
            <form onSubmit={handleUpdate}>
              <div className="admin-form-field">
                <label>Name</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="admin-form-field">
                <label>Swahili Name</label>
                <input type="text" value={form.swahili_name} onChange={(e) => setForm({ ...form, swahili_name: e.target.value })} />
              </div>
              <div className="admin-form-field">
                <label>Planted Date</label>
                <input type="date" value={form.planted_date || ''} onChange={(e) => setForm({ ...form, planted_date: e.target.value })} />
              </div>
              <div className="admin-form-field">
                <label>Harvest Date</label>
                <input type="date" value={form.harvest_date || ''} onChange={(e) => setForm({ ...form, harvest_date: e.target.value })} />
              </div>
              <div className="admin-form-field">
                <label>Area (hectares)</label>
                <input type="number" step="0.01" value={form.area_hectares ?? ''} onChange={(e) => setForm({ ...form, area_hectares: e.target.value ? parseFloat(e.target.value) : undefined })} />
              </div>
              <div className="admin-form-field">
                <label>Status</label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  <option value="growing">Growing</option>
                  <option value="harvested">Harvested</option>
                  <option value="planned">Planned</option>
                </select>
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
        <span onClick={() => navigate('/farmers')}>👥 Farmers</span>
        <span className="active">🌱 Crops</span>
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

export default CropsView;
