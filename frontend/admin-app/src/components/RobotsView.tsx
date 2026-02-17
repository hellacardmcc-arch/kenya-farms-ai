import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  getRobots,
  registerRobot,
  initializeRobot,
  configureRobot,
  updateRobot,
  deleteRobot,
  type Robot
} from '../api/adminApi';
import './AdminPage.css';

const RobotsView: React.FC = () => {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const [robots, setRobots] = useState<Robot[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<'register' | 'configure' | 'edit' | null>(null);
  const [editing, setEditing] = useState<Robot | null>(null);
  const [regForm, setRegForm] = useState({ device_id: '', name: '', type: '', battery: '' });
  const [configForm, setConfigForm] = useState({ api_key: '', endpoint: '', heartbeat_interval_sec: 30 });
  const [editForm, setEditForm] = useState<Partial<Robot>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const load = () => {
    if (!token) return;
    getRobots(token).then(setRobots).catch(() => setRobots([])).finally(() => setLoading(false));
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
      await registerRobot(token, {
        device_id: regForm.device_id.trim(),
        name: regForm.name.trim(),
        type: regForm.type || undefined,
        battery: regForm.battery ? parseInt(regForm.battery, 10) : undefined
      });
      setMessage({ type: 'success', text: 'Robot registered. Now initialize it.' });
      setModal(null);
      setRegForm({ device_id: '', name: '', type: '', battery: '' });
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
      await initializeRobot(token, id);
      setMessage({ type: 'success', text: 'Robot initialized. Now configure server communication.' });
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
      await configureRobot(token, editing.id, {
        api_key: configForm.api_key.trim(),
        endpoint: configForm.endpoint?.trim() || undefined,
        heartbeat_interval_sec: configForm.heartbeat_interval_sec || 30
      });
      setMessage({ type: 'success', text: 'Robot configured. Farmer can now activate and pair to farm.' });
      setModal(null);
      setEditing(null);
      setConfigForm({ api_key: '', endpoint: '', heartbeat_interval_sec: 30 });
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
      await updateRobot(token, editing.id, editForm);
      setMessage({ type: 'success', text: 'Robot updated!' });
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
    if (!token || !confirm('Delete this robot?')) return;
    try {
      await deleteRobot(token, id);
      setMessage({ type: 'success', text: 'Robot deleted' });
      load();
    } catch {
      setMessage({ type: 'error', text: 'Failed to delete' });
    }
  };

  const status = (r: Robot) => r.registration_status || (r.farmer_id ? 'active' : 'registered');

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div className="admin-header-row">
          <div>
            <h1>🇰🇪 Kenya Farms AI Admin</h1>
            <p>Register, Initialize & Configure Robots</p>
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
          <button className="btn-primary" onClick={() => { setModal('register'); setRegForm({ device_id: '', name: '', type: '', battery: '' }); }}>
            + Register Robot
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
                  <th>Status</th>
                  <th>Battery</th>
                  <th>Registration</th>
                  <th>Farmer</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {robots.map((r) => (
                  <tr key={r.id}>
                    <td>{r.device_id || '—'}</td>
                    <td>{r.name}</td>
                    <td>{r.type || '—'}</td>
                    <td>{r.status || '—'}</td>
                    <td>{r.battery != null ? `${r.battery}%` : '—'}</td>
                    <td><span className={`badge-${status(r)}`}>{status(r)}</span></td>
                    <td>{r.farmer_name || '—'}</td>
                    <td>
                      {status(r) === 'registered' && (
                        <button className="btn-sm btn-success" onClick={() => handleInitialize(r.id)} disabled={saving}>Initialize</button>
                      )}
                      {(status(r) === 'initialized' || status(r) === 'registered') && (
                        <button className="btn-sm btn-primary" onClick={() => { setEditing(r); setConfigForm({ api_key: '', endpoint: '', heartbeat_interval_sec: 30 }); setModal('configure'); }}>Configure</button>
                      )}
                      <button className="btn-sm btn-primary" onClick={() => { setEditing(r); setEditForm({ name: r.name, type: r.type, status: r.status, battery: r.battery }); setModal('edit'); }}>Edit</button>
                      <button className="btn-sm btn-danger" onClick={() => handleDelete(r.id)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {robots.length === 0 && <p className="admin-empty">No robots. Register a robot to begin.</p>}
          </div>
        )}
      </div>

      {modal === 'register' && (
        <div className="admin-modal-overlay" onClick={() => setModal(null)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Register Robot</h3>
            <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>All robots must be registered before farmers can activate them.</p>
            <form onSubmit={handleRegister}>
              <div className="admin-form-field">
                <label>Device ID / Serial *</label>
                <input type="text" value={regForm.device_id} onChange={(e) => setRegForm({ ...regForm, device_id: e.target.value })} required placeholder="e.g. RBT-001" />
              </div>
              <div className="admin-form-field">
                <label>Name *</label>
                <input type="text" value={regForm.name} onChange={(e) => setRegForm({ ...regForm, name: e.target.value })} required placeholder="e.g. Irrigation Bot A" />
              </div>
              <div className="admin-form-field">
                <label>Type</label>
                <select value={regForm.type} onChange={(e) => setRegForm({ ...regForm, type: e.target.value })}>
                  <option value="">Select</option>
                  <option value="irrigation">Irrigation</option>
                  <option value="scout">Soil Scout</option>
                  <option value="pest_scout">Pest Scout</option>
                  <option value="weeds_scout">Weeds Scout</option>
                </select>
              </div>
              <div className="admin-form-field">
                <label>Battery %</label>
                <input type="number" min="0" max="100" value={regForm.battery} onChange={(e) => setRegForm({ ...regForm, battery: e.target.value })} />
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
            <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>Set API key and endpoint so the robot can communicate with the server.</p>
            <form onSubmit={handleConfigure}>
              <div className="admin-form-field">
                <label>API Key *</label>
                <input type="text" value={configForm.api_key} onChange={(e) => setConfigForm({ ...configForm, api_key: e.target.value })} required placeholder="Device API key" />
              </div>
              <div className="admin-form-field">
                <label>Server Endpoint</label>
                <input type="url" value={configForm.endpoint} onChange={(e) => setConfigForm({ ...configForm, endpoint: e.target.value })} placeholder="https://api.example.com/commands" />
              </div>
              <div className="admin-form-field">
                <label>Heartbeat Interval (sec)</label>
                <input type="number" min="5" value={configForm.heartbeat_interval_sec} onChange={(e) => setConfigForm({ ...configForm, heartbeat_interval_sec: parseInt(e.target.value, 10) || 30 })} />
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
            <h3>Edit Robot</h3>
            <form onSubmit={handleUpdate}>
              <div className="admin-form-field">
                <label>Name</label>
                <input type="text" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
              </div>
              <div className="admin-form-field">
                <label>Type</label>
                <select value={editForm.type} onChange={(e) => setEditForm({ ...editForm, type: e.target.value })}>
                  <option value="">Select</option>
                  <option value="irrigation">Irrigation</option>
                  <option value="scout">Soil Scout</option>
                  <option value="pest_scout">Pest Scout</option>
                  <option value="weeds_scout">Weeds Scout</option>
                </select>
              </div>
              <div className="admin-form-field">
                <label>Status</label>
                <select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}>
                  <option value="idle">Idle</option>
                  <option value="online">Online</option>
                  <option value="watering">Watering</option>
                </select>
              </div>
              <div className="admin-form-field">
                <label>Battery %</label>
                <input type="number" min="0" max="100" value={editForm.battery ?? ''} onChange={(e) => setEditForm({ ...editForm, battery: e.target.value ? parseInt(e.target.value, 10) : undefined })} />
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
        <span onClick={() => navigate('/sensors')}>📡 Sensors</span>
        <span className="active">🤖 Robots</span>
        <span onClick={() => navigate('/settings')}>⚙️ Settings</span>
        <span onClick={() => navigate('/users')}>👤 Admin Users</span>
      </div>
    </div>
  );
};

export default RobotsView;
