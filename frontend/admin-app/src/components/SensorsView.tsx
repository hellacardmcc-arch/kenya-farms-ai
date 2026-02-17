import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  getSensors,
  registerSensor,
  initializeSensor,
  configureSensor,
  updateSensor,
  deleteSensor,
  type Sensor
} from '../api/adminApi';
import './AdminPage.css';

const SensorsView: React.FC = () => {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const [sensors, setSensors] = useState<Sensor[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<'register' | 'configure' | 'edit' | null>(null);
  const [editing, setEditing] = useState<Sensor | null>(null);
  const [regForm, setRegForm] = useState({ device_id: '', name: '', type: '', unit: '' });
  const [configForm, setConfigForm] = useState({ api_key: '', endpoint: '', poll_interval_sec: 60 });
  const [editForm, setEditForm] = useState<Partial<Sensor>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const load = () => {
    if (!token) return;
    getSensors(token).then(setSensors).catch(() => setSensors([])).finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [token]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !regForm.device_id?.trim() || !regForm.name?.trim()) return;
    setSaving(true);
    setMessage(null);
    try {
      await registerSensor(token, { device_id: regForm.device_id.trim(), name: regForm.name.trim(), type: regForm.type || undefined, unit: regForm.unit || undefined });
      setMessage({ type: 'success', text: 'Sensor registered. Now initialize it.' });
      setModal(null);
      setRegForm({ device_id: '', name: '', type: '', unit: '' });
      load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed';
      setMessage({ type: 'error', text: msg });
    } finally {
      setSaving(false);
    }
  };

  const handleInitialize = async (id: string) => {
    if (!token) return;
    setSaving(true);
    setMessage(null);
    try {
      await initializeSensor(token, id);
      setMessage({ type: 'success', text: 'Sensor initialized. Now configure server communication.' });
      load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed';
      setMessage({ type: 'error', text: msg });
    } finally {
      setSaving(false);
    }
  };

  const handleConfigure = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !editing || !configForm.api_key?.trim()) return;
    setSaving(true);
    setMessage(null);
    try {
      await configureSensor(token, editing.id, {
        api_key: configForm.api_key.trim(),
        endpoint: configForm.endpoint?.trim() || undefined,
        poll_interval_sec: configForm.poll_interval_sec || 60
      });
      setMessage({ type: 'success', text: 'Sensor configured. Farmer can now activate and pair to farm.' });
      setModal(null);
      setEditing(null);
      setConfigForm({ api_key: '', endpoint: '', poll_interval_sec: 60 });
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
      await updateSensor(token, editing.id, editForm);
      setMessage({ type: 'success', text: 'Sensor updated!' });
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
    if (!token || !confirm('Delete this sensor?')) return;
    try {
      await deleteSensor(token, id);
      setMessage({ type: 'success', text: 'Sensor deleted' });
      load();
    } catch {
      setMessage({ type: 'error', text: 'Failed to delete' });
    }
  };

  const status = (s: Sensor) => s.registration_status || (s.farm_id ? 'active' : 'registered');

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div className="admin-header-row">
          <div>
            <h1>🇰🇪 Kenya Farms AI Admin</h1>
            <p>Register, Initialize & Configure Sensors</p>
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
          <button className="btn-primary" onClick={() => { setModal('register'); setRegForm({ device_id: '', name: '', type: '', unit: '' }); }}>
            + Register Sensor
          </button>
        </div>

        {message && <div className={`admin-message admin-message-${message.type}`}>{message.text}</div>}

        {loading ? (
          <div className="admin-loading">Loading...</div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Device ID</th>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Unit</th>
                  <th>Status</th>
                  <th>Registration</th>
                  <th>Farm</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sensors.map((s) => (
                  <tr key={s.id}>
                    <td>{s.device_id || '—'}</td>
                    <td>{s.name}</td>
                    <td>{s.type || '—'}</td>
                    <td>{s.unit || '—'}</td>
                    <td>{s.status || '—'}</td>
                    <td><span className={`badge-${status(s)}`}>{status(s)}</span></td>
                    <td>{s.farm_name || '—'}</td>
                    <td>
                      {status(s) === 'registered' && (
                        <button className="btn-sm btn-success" onClick={() => handleInitialize(s.id)} disabled={saving}>Initialize</button>
                      )}
                      {(status(s) === 'initialized' || status(s) === 'registered') && (
                        <button className="btn-sm btn-primary" onClick={() => { setEditing(s); setConfigForm({ api_key: '', endpoint: '', poll_interval_sec: 60 }); setModal('configure'); }}>Configure</button>
                      )}
                      <button className="btn-sm btn-primary" onClick={() => { setEditing(s); setEditForm({ name: s.name, type: s.type, value: s.value, unit: s.unit, status: s.status }); setModal('edit'); }}>Edit</button>
                      <button className="btn-sm btn-danger" onClick={() => handleDelete(s.id)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {sensors.length === 0 && <p className="admin-empty">No sensors. Register a sensor to begin.</p>}
          </div>
        )}
      </div>

      {modal === 'register' && (
        <div className="admin-modal-overlay" onClick={() => setModal(null)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Register Sensor</h3>
            <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>All sensors must be registered before farmers can activate them.</p>
            <form onSubmit={handleRegister}>
              <div className="admin-form-field">
                <label>Device ID / Serial *</label>
                <input type="text" value={regForm.device_id} onChange={(e) => setRegForm({ ...regForm, device_id: e.target.value })} required placeholder="e.g. SNS-001" />
              </div>
              <div className="admin-form-field">
                <label>Name *</label>
                <input type="text" value={regForm.name} onChange={(e) => setRegForm({ ...regForm, name: e.target.value })} required placeholder="e.g. Soil Moisture A" />
              </div>
              <div className="admin-form-field">
                <label>Type</label>
                <select value={regForm.type} onChange={(e) => setRegForm({ ...regForm, type: e.target.value })}>
                  <option value="">Select</option>
                  <option value="moisture">Moisture</option>
                  <option value="temperature">Temperature</option>
                  <option value="humidity">Humidity</option>
                  <option value="light">Light</option>
                </select>
              </div>
              <div className="admin-form-field">
                <label>Unit</label>
                <input type="text" value={regForm.unit} onChange={(e) => setRegForm({ ...regForm, unit: e.target.value })} placeholder="e.g. %, °C" />
              </div>
              <div className="admin-form-actions">
                <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Registering...' : 'Register'}</button>
                <button type="button" className="btn-secondary" onClick={() => setModal(null)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modal === 'configure' && editing && (
        <div className="admin-modal-overlay" onClick={() => { setModal(null); setEditing(null); }}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Configure Server Communication</h3>
            <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>Set API key and endpoint so the sensor can communicate with the server.</p>
            <form onSubmit={handleConfigure}>
              <div className="admin-form-field">
                <label>API Key *</label>
                <input type="text" value={configForm.api_key} onChange={(e) => setConfigForm({ ...configForm, api_key: e.target.value })} required placeholder="Device API key" />
              </div>
              <div className="admin-form-field">
                <label>Server Endpoint</label>
                <input type="url" value={configForm.endpoint} onChange={(e) => setConfigForm({ ...configForm, endpoint: e.target.value })} placeholder="https://api.example.com/ingest" />
              </div>
              <div className="admin-form-field">
                <label>Poll Interval (sec)</label>
                <input type="number" min="10" value={configForm.poll_interval_sec} onChange={(e) => setConfigForm({ ...configForm, poll_interval_sec: parseInt(e.target.value, 10) || 60 })} />
              </div>
              <div className="admin-form-actions">
                <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Configuring...' : 'Configure'}</button>
                <button type="button" className="btn-secondary" onClick={() => { setModal(null); setEditing(null); }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modal === 'edit' && editing && (
        <div className="admin-modal-overlay" onClick={() => { setModal(null); setEditing(null); }}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Edit Sensor</h3>
            <form onSubmit={handleUpdate}>
              <div className="admin-form-field">
                <label>Name</label>
                <input type="text" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
              </div>
              <div className="admin-form-field">
                <label>Type</label>
                <input type="text" value={editForm.type} onChange={(e) => setEditForm({ ...editForm, type: e.target.value })} />
              </div>
              <div className="admin-form-field">
                <label>Value</label>
                <input type="number" step="0.01" value={editForm.value ?? ''} onChange={(e) => setEditForm({ ...editForm, value: e.target.value ? parseFloat(e.target.value) : undefined })} />
              </div>
              <div className="admin-form-field">
                <label>Unit</label>
                <input type="text" value={editForm.unit} onChange={(e) => setEditForm({ ...editForm, unit: e.target.value })} />
              </div>
              <div className="admin-form-field">
                <label>Status</label>
                <select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}>
                  <option value="online">Online</option>
                  <option value="offline">Offline</option>
                  <option value="maintenance">Maintenance</option>
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
        <span onClick={() => navigate('/farms')}>🌾 Farms</span>
        <span onClick={() => navigate('/crops')}>🌱 Crops</span>
        <span onClick={() => navigate('/analytics')}>📊 Analytics</span>
        <span className="active">📡 Sensors</span>
        <span onClick={() => navigate('/robots')}>🤖 Robots</span>
        <span onClick={() => navigate('/settings')}>⚙️ Settings</span>
        <span onClick={() => navigate('/users')}>👤 Admin Users</span>
      </div>
    </div>
  );
};

export default SensorsView;
