import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  getFarmers,
  registerFarmer,
  updateFarmer,
  deleteFarmer,
  restoreFarmer,
  createFarm,
  type Farmer
} from '../api/adminApi';
import { AreaInput } from './AreaInput';
import { AreaUnitSelector } from './AreaUnitSelector';
import FarmerAccessRequestsSection from './FarmerAccessRequestsSection';
import './AdminPage.css';

const FarmersView: React.FC = () => {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDeleted, setShowDeleted] = useState(false);
  const [modal, setModal] = useState<'new' | 'edit' | 'addFarm' | null>(null);
  const [editing, setEditing] = useState<Farmer | null>(null);
  const [addingFarmFor, setAddingFarmFor] = useState<Farmer | null>(null);
  const [farmForm, setFarmForm] = useState({ name: '', location: '', area_ha: null as number | null, latitude: '', longitude: '' });
  const [form, setForm] = useState({ email: '', password: '', name: '', phone: '', location: '', farm_name: '', farm_size_ha: null as number | null, farm_location: '', farm_latitude: '', farm_longitude: '' });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const load = () => {
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setMessage(null);
    getFarmers(token, showDeleted, true)
      .then((data) => {
        setFarmers(data || []);
      })
      .catch((err) => {
        setFarmers([]);
        const msg = (err as { response?: { data?: { error?: string }; status?: number } })?.response?.data?.error;
        const status = (err as { response?: { status?: number } })?.response?.status;
        const isNetwork = (err as { code?: string })?.code === 'ERR_NETWORK';
        setMessage({
          type: 'error',
          text: msg || (isNetwork
            ? 'Cannot connect to API. Ensure API Gateway (port 5001) and Admin Service (port 4006) are running.'
            : status === 401
              ? 'Session expired. Please log in again.'
              : 'Failed to load farmers.')
        });
      })
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
        location: form.location || undefined,
        farm_name: form.farm_name.trim(),
        farm_size: form.farm_size_ha ?? undefined,
        farm_location: form.farm_location || undefined,
        farm_latitude: form.farm_latitude !== '' && !isNaN(parseFloat(form.farm_latitude)) ? parseFloat(form.farm_latitude) : undefined,
        farm_longitude: form.farm_longitude !== '' && !isNaN(parseFloat(form.farm_longitude)) ? parseFloat(form.farm_longitude) : undefined
      });
      setMessage({ type: 'success', text: 'Farmer registered with farm!' });
      setModal(null);
      setForm({ email: '', password: '', name: '', phone: '', location: '', farm_name: '', farm_size_ha: null, farm_location: '', farm_latitude: '', farm_longitude: '' });
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
        location: form.location || undefined
      });
      setMessage({ type: 'success', text: 'Farmer updated!' });
      setModal(null);
      setEditing(null);
      setForm({ email: '', password: '', name: '', phone: '', location: '', farm_name: '', farm_size_ha: null, farm_location: '', farm_latitude: '', farm_longitude: '' });
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
    setForm({ email: f.email || '', password: '', name: f.name || '', phone: f.phone || '', location: f.location || '', farm_name: '', farm_size_ha: null, farm_location: '', farm_latitude: '', farm_longitude: '' });
    setModal('edit');
  };

  const openAddFarm = (f: Farmer) => {
    setAddingFarmFor(f);
    setFarmForm({ name: '', location: '', area_ha: null, latitude: '', longitude: '' });
    setModal('addFarm');
  };

  const handleAddFarm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !addingFarmFor || !farmForm.name.trim()) return;
    setSaving(true);
    setMessage(null);
    try {
      await createFarm(token, {
        farmer_id: addingFarmFor.id,
        name: farmForm.name.trim(),
        location: farmForm.location || undefined,
        area_hectares: farmForm.area_ha ?? undefined,
        latitude: farmForm.latitude !== '' && !isNaN(parseFloat(farmForm.latitude)) ? parseFloat(farmForm.latitude) : undefined,
        longitude: farmForm.longitude !== '' && !isNaN(parseFloat(farmForm.longitude)) ? parseFloat(farmForm.longitude) : undefined
      });
      setMessage({ type: 'success', text: 'Farm added!' });
      setModal(null);
      setAddingFarmFor(null);
      setFarmForm({ name: '', location: '', area_ha: null, latitude: '', longitude: '' });
      load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed';
      setMessage({ type: 'error', text: msg });
    } finally {
      setSaving(false);
    }
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
            <button onClick={() => navigate('/settings')}>⚙️ Settings</button>
            <button onClick={() => { logout(); navigate('/login'); }}>Logout</button>
          </div>
        </div>
      </header>

      <div className="admin-page-content">
        <div className="admin-toolbar">
          <button className="btn-primary" onClick={() => { setModal('new'); setForm({ email: '', password: '', name: '', phone: '', location: '', farm_name: '', farm_size_ha: null, farm_location: '', farm_latitude: '', farm_longitude: '' }); }}>
            + Register New Farmer
          </button>
          <label className="admin-checkbox">
            <input type="checkbox" checked={showDeleted} onChange={(e) => setShowDeleted(e.target.checked)} />
            Show deleted
          </label>
        </div>

        {message && (
          <div className={`admin-message admin-message-${message.type}`}>
            {message.text}
            {message.type === 'error' && (
              <button className="btn-sm btn-primary" onClick={() => load()} style={{ marginLeft: 8 }}>Retry</button>
            )}
          </div>
        )}

        {loading ? (
          <div className="admin-loading">Loading...</div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Farmer ID</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Location</th>
                  <th>Farms</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {farmers.map((f) => (
                  <tr key={f.id} className={f.deleted_at ? 'row-deleted' : ''}>
                    <td><code className="farmer-id-cell" title={f.id}>{f.id}</code></td>
                    <td>{f.name || '—'}</td>
                    <td>{f.email || '—'}</td>
                    <td>{f.phone || '—'}</td>
                    <td>{f.location || '—'}</td>
                    <td>
                      {(f.farms_count ?? 0) > 0 ? (
                        <span className="badge-count" onClick={() => navigate(`/farms?farmer=${f.id}`)} title="View farms">
                          {f.farms_count}
                        </span>
                      ) : (
                        '0'
                      )}
                    </td>
                    <td>{f.created_at ? new Date(f.created_at).toLocaleDateString() : '—'}</td>
                    <td>
                      {f.deleted_at ? (
                        <button className="btn-sm btn-success" onClick={() => handleRestore(f.id)}>Restore</button>
                      ) : (
                        <>
                          <button className="btn-sm btn-primary" onClick={() => openEdit(f)}>Edit</button>
                          <button className="btn-sm btn-secondary" onClick={() => openAddFarm(f)} title="Add farm for this farmer">+ Farm</button>
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

        {token && (
          <div className="farmer-requests-section-wrap" style={{ marginTop: 32 }}>
            <FarmerAccessRequestsSection token={token} onRefresh={load} />
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
                <label>Location</label>
                <input type="text" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
              </div>
              <div className="admin-form-field">
                <label htmlFor="farmer-farm-name">Farm Name *</label>
                <input id="farmer-farm-name" type="text" value={form.farm_name} onChange={(e) => setForm({ ...form, farm_name: e.target.value })} required placeholder="e.g. Main Farm" aria-label="Farm Name" />
              </div>
              <AreaInput
                id="farmer-farm-size"
                label="Farm Size"
                value={form.farm_size_ha}
                onChange={(ha) => setForm({ ...form, farm_size_ha: ha })}
                placeholder="e.g. 2.5"
              />
              <div className="admin-form-field">
                <label htmlFor="farmer-farm-location">Farm Location</label>
                <input id="farmer-farm-location" type="text" value={form.farm_location} onChange={(e) => setForm({ ...form, farm_location: e.target.value })} placeholder="e.g. Nairobi County" aria-label="Farm Location" />
              </div>
              <div className="admin-form-field">
                <label htmlFor="farmer-farm-latitude">Farm Latitude</label>
                <input id="farmer-farm-latitude" type="number" step="any" value={form.farm_latitude} onChange={(e) => setForm({ ...form, farm_latitude: e.target.value })} placeholder="e.g. -1.2921" aria-label="Farm Latitude" />
              </div>
              <div className="admin-form-field">
                <label htmlFor="farmer-farm-longitude">Farm Longitude</label>
                <input id="farmer-farm-longitude" type="number" step="any" value={form.farm_longitude} onChange={(e) => setForm({ ...form, farm_longitude: e.target.value })} placeholder="e.g. 36.8219" aria-label="Farm Longitude" />
              </div>
              <p className="admin-form-hint">Unique farm code will be auto-generated.</p>
              <div className="admin-form-actions">
                <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Register'}</button>
                <button type="button" className="btn-secondary" onClick={() => setModal(null)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modal === 'addFarm' && addingFarmFor && (
        <div className="admin-modal-overlay" onClick={() => { setModal(null); setAddingFarmFor(null); }}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Add Farm for {addingFarmFor.name || addingFarmFor.email}</h3>
            <p className="admin-form-hint">Unified with farmer app: farms stored in single database.</p>
            <form onSubmit={handleAddFarm}>
              <div className="admin-form-field">
                <label htmlFor="add-farm-name">Farm Name *</label>
                <input id="add-farm-name" type="text" value={farmForm.name} onChange={(e) => setFarmForm({ ...farmForm, name: e.target.value })} required placeholder="e.g. North Field" aria-label="Farm name" />
              </div>
              <div className="admin-form-field">
                <label htmlFor="add-farm-location">Location</label>
                <input id="add-farm-location" type="text" value={farmForm.location} onChange={(e) => setFarmForm({ ...farmForm, location: e.target.value })} placeholder="e.g. Nairobi County" aria-label="Farm location" />
              </div>
              <AreaInput
                id="add-farm-area"
                label="Area"
                value={farmForm.area_ha}
                onChange={(ha) => setFarmForm({ ...farmForm, area_ha: ha })}
                placeholder="e.g. 2.5"
              />
              <div className="admin-form-field">
                <label htmlFor="add-farm-lat">Latitude</label>
                <input id="add-farm-lat" type="number" step="any" value={farmForm.latitude} onChange={(e) => setFarmForm({ ...farmForm, latitude: e.target.value })} placeholder="e.g. -1.2921" aria-label="Latitude" />
              </div>
              <div className="admin-form-field">
                <label htmlFor="add-farm-lng">Longitude</label>
                <input id="add-farm-lng" type="number" step="any" value={farmForm.longitude} onChange={(e) => setFarmForm({ ...farmForm, longitude: e.target.value })} placeholder="e.g. 36.8219" aria-label="Longitude" />
              </div>
              <p className="admin-form-hint">Unique farm code will be auto-generated.</p>
              <div className="admin-form-actions">
                <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Add Farm'}</button>
                <button type="button" className="btn-secondary" onClick={() => { setModal(null); setAddingFarmFor(null); }}>Cancel</button>
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
                <label>Location</label>
                <input type="text" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
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
        <span onClick={() => navigate('/farms')}>🌾 Farms</span>
        <span onClick={() => navigate('/crops')}>🌱 Crops</span>
        <span onClick={() => navigate('/analytics')}>📊 Analytics</span>
        <span onClick={() => navigate('/sensors')}>📡 Sensors</span>
        <span onClick={() => navigate('/robots')}>🤖 Robots</span>
        <span onClick={() => navigate('/settings')}>⚙️ Settings</span>
        <span onClick={() => navigate('/users')}>👤 Admin Users</span>
      </div>
    </div>
  );
};

export default FarmersView;
