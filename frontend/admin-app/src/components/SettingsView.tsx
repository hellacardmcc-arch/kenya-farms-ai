import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  getSettingsConfig,
  updateSettingsConfig,
  getSettingsLogs,
  addSettingsLog,
  getAuditLogs,
  getAdminHealth,
  requestSystemRestart,
  requestRebuildService,
  requestRunMigrations,
  type SystemConfig,
  type SystemLog
} from '../api/adminApi';
import './AdminPage.css';
import './SettingsView.css';

type TabId = 'ports' | 'endpoints' | 'logs' | 'audit' | 'maintenance';

const SettingsView: React.FC = () => {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabId>('ports');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Config
  const [config, setConfig] = useState<SystemConfig>({});
  const [configLoading, setConfigLoading] = useState(true);
  const [editingPort, setEditingPort] = useState<{ key: string; value: number } | null>(null);
  const [editingEndpoint, setEditingEndpoint] = useState<{ key: string; value: string } | null>(null);

  // Logs
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [auditLogs, setAuditLogs] = useState<{ id: string; action: string; email?: string; created_at: string; metadata?: unknown }[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [logLevel, setLogLevel] = useState('');
  const [newLog, setNewLog] = useState<{ level: 'info' | 'warn' | 'error' | 'debug'; message: string }>({ level: 'info', message: '' });
  const [addingLog, setAddingLog] = useState(false);

  // Maintenance / Health
  const [health, setHealth] = useState<{ status: string; db?: string } | null>(null);
  const [maintenanceAction, setMaintenanceAction] = useState<string | null>(null);

  // Restart modal: 0=closed, 1=first warning, 2=second warning, 3=final confirm
  const [restartStep, setRestartStep] = useState(0);
  const [restartConfirmText, setRestartConfirmText] = useState('');
  const [restarting, setRestarting] = useState(false);

  // Rebuild service
  const [rebuildService, setRebuildService] = useState<string>('');
  const [rebuilding, setRebuilding] = useState(false);

  // Run migrations
  const [migrating, setMigrating] = useState(false);

  const loadConfig = () => {
    if (!token) return;
    getSettingsConfig(token)
      .then(setConfig)
      .catch(() => setConfig({}))
      .finally(() => setConfigLoading(false));
  };

  const loadLogs = () => {
    if (!token) return;
    getSettingsLogs(token, { limit: 100, level: logLevel || undefined })
      .then(setLogs)
      .catch(() => setLogs([]))
      .finally(() => setLogsLoading(false));
  };

  const loadAuditLogs = () => {
    if (!token) return;
    getAuditLogs(token, 100)
      .then(setAuditLogs)
      .catch(() => setAuditLogs([]));
  };

  const loadHealth = () => {
    if (!token) return;
    getAdminHealth(token)
      .then(setHealth)
      .catch(() => setHealth({ status: 'error' }));
  };

  useEffect(() => {
    loadConfig();
  }, [token]);

  useEffect(() => {
    if (activeTab === 'logs') loadLogs();
    if (activeTab === 'audit') loadAuditLogs();
    if (activeTab === 'maintenance') loadHealth();
  }, [token, activeTab, logLevel]);

  const handleSavePort = async () => {
    if (!token || !editingPort) return;
    setMessage(null);
    try {
      const ports = { ...(config.ports || {}), [editingPort.key]: editingPort.value };
      await updateSettingsConfig(token, 'ports', ports);
      setConfig({ ...config, ports });
      setMessage({ type: 'success', text: 'Port updated. Restart services for changes to take effect.' });
      setEditingPort(null);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed';
      setMessage({ type: 'error', text: msg });
    }
  };

  const handleSaveEndpoint = async () => {
    if (!token || !editingEndpoint) return;
    setMessage(null);
    try {
      const endpoints = { ...(config.endpoints || {}), [editingEndpoint.key]: editingEndpoint.value };
      await updateSettingsConfig(token, 'endpoints', endpoints);
      setConfig({ ...config, endpoints });
      setMessage({ type: 'success', text: 'Endpoint updated.' });
      setEditingEndpoint(null);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed';
      setMessage({ type: 'error', text: msg });
    }
  };

  const handleAddLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !newLog.message.trim()) return;
    setAddingLog(true);
    setMessage(null);
    try {
      await addSettingsLog(token, { level: newLog.level, message: newLog.message.trim() });
      setMessage({ type: 'success', text: 'Log entry added' });
      setNewLog({ level: 'info', message: '' });
      loadLogs();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed';
      setMessage({ type: 'error', text: msg });
    } finally {
      setAddingLog(false);
    }
  };

  const runMaintenance = async (action: string) => {
    if (!token) return;
    setMaintenanceAction(action);
    setMessage(null);
    try {
      if (action === 'health') {
        await loadHealth();
        setMessage({ type: 'success', text: 'Health check completed' });
      } else if (action === 'clear-cache') {
        setMessage({ type: 'success', text: 'Cache clear requested. Backend may need to implement this.' });
      } else if (action === 'db-backup') {
        setMessage({ type: 'success', text: 'Backup requested. Configure backup job in your deployment.' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Maintenance action failed' });
    } finally {
      setMaintenanceAction(null);
    }
  };

  const openRestartModal = () => {
    setRestartStep(1);
    setRestartConfirmText('');
    setMessage(null);
  };

  const closeRestartModal = () => {
    setRestartStep(0);
    setRestartConfirmText('');
  };

  const handleRestartStep = () => {
    if (restartStep === 1) setRestartStep(2);
    else if (restartStep === 2) setRestartStep(3);
  };

  const handleRestartConfirm = async () => {
    if (restartStep !== 3 || restartConfirmText.toUpperCase() !== 'RESTART') return;
    if (!token) return;
    setRestarting(true);
    setMessage(null);
    try {
      const result = await requestSystemRestart(token);
      setMessage({ type: 'success', text: result.message || 'System restart requested. Services will restart shortly.' });
      closeRestartModal();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Restart request failed';
      setMessage({ type: 'error', text: msg });
    } finally {
      setRestarting(false);
    }
  };

  const handleRunMigrations = async () => {
    if (!token) return;
    setMigrating(true);
    setMessage(null);
    try {
      const result = await requestRunMigrations(token);
      if (result.ok) {
        setMessage({ type: 'success', text: result.message || 'All database migrations completed successfully.' });
      } else {
        setMessage({ type: 'error', text: result.error || result.message || 'Migrations failed' });
      }
    } catch (err: unknown) {
      const res = (err as { response?: { data?: { error?: string; message?: string } } })?.response?.data;
      setMessage({ type: 'error', text: res?.error || res?.message || 'Run migrations failed' });
    } finally {
      setMigrating(false);
    }
  };

  const handleRebuildService = async () => {
    if (!token || !rebuildService) return;
    setRebuilding(true);
    setMessage(null);
    try {
      const result = await requestRebuildService(token, rebuildService);
      if (result.ok) {
        setMessage({ type: 'success', text: result.message || `${rebuildService} rebuilt and restarted.` });
      } else {
        const cmd = result.command ? ` Run manually: ${result.command}` : '';
        setMessage({ type: 'error', text: (result.error || result.message || 'Rebuild failed') + cmd });
      }
    } catch (err: unknown) {
      const res = (err as { response?: { data?: { error?: string; message?: string; command?: string } } })?.response?.data;
      const msg = res?.error || res?.message || 'Rebuild request failed';
      const cmd = res?.command ? ` Run manually: ${res.command}` : '';
      setMessage({ type: 'error', text: msg + cmd });
    } finally {
      setRebuilding(false);
    }
  };

  const tabs: { id: TabId; label: string; icon: string }[] = [
    { id: 'ports', label: 'Ports', icon: '🔌' },
    { id: 'endpoints', label: 'Endpoints', icon: '🌐' },
    { id: 'logs', label: 'System Logs', icon: '📋' },
    { id: 'audit', label: 'Audit Logs', icon: '📜' },
    { id: 'maintenance', label: 'Maintenance', icon: '🔧' }
  ];

  return (
    <div className="admin-page settings-page">
      <header className="admin-header">
        <div className="admin-header-row">
          <div>
            <h1>🇰🇪 Kenya Farms AI Admin</h1>
            <p>System Settings &amp; Maintenance</p>
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
        <div className="settings-tabs">
          {tabs.map((t) => (
            <button
              key={t.id}
              className={`settings-tab ${activeTab === t.id ? 'active' : ''}`}
              onClick={() => setActiveTab(t.id)}
            >
              <span>{t.icon}</span> {t.label}
            </button>
          ))}
        </div>

        {message && (
          <div className={`admin-message admin-message-${message.type}`}>{message.text}</div>
        )}

        {/* Ports */}
        {activeTab === 'ports' && (
          <div className="settings-panel">
            <h2>Service Ports</h2>
            <p className="settings-desc">Configure ports for each microservice. Changes require service restart.</p>
            {configLoading ? (
              <div className="admin-loading">Loading...</div>
            ) : (
              <div className="settings-config-grid">
                {Object.entries(config.ports || {}).map(([key, val]) => (
                  <div key={key} className="settings-config-item">
                    <span className="config-key">{key.replace(/_/g, ' ')}</span>
                    {editingPort?.key === key ? (
                      <div className="config-edit">
                        <input
                          type="number"
                          value={editingPort.value}
                          onChange={(e) => setEditingPort({ ...editingPort, value: parseInt(e.target.value, 10) || 0 })}
                          min={1024}
                          max={65535}
                          aria-label="Port value"
                        />
                        <button className="btn-sm btn-primary" onClick={handleSavePort}>Save</button>
                        <button className="btn-sm btn-secondary" onClick={() => setEditingPort(null)}>Cancel</button>
                      </div>
                    ) : (
                      <div className="config-value">
                        <span>{val}</span>
                        <button className="btn-sm btn-primary" onClick={() => setEditingPort({ key, value: val })}>Edit</button>
                      </div>
                    )}
                  </div>
                ))}
                {(!config.ports || Object.keys(config.ports).length === 0) && (
                  <p className="admin-empty">No port config. Run migration 006 to seed defaults.</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Endpoints */}
        {activeTab === 'endpoints' && (
          <div className="settings-panel">
            <h2>Service Endpoints</h2>
            <p className="settings-desc">Base URLs for each microservice. Used for internal service-to-service calls.</p>
            {configLoading ? (
              <div className="admin-loading">Loading...</div>
            ) : (
              <div className="settings-config-grid">
                {Object.entries(config.endpoints || {}).map(([key, val]) => (
                  <div key={key} className="settings-config-item endpoint-item">
                    <span className="config-key">{key.replace(/_/g, ' ')}</span>
                    {editingEndpoint?.key === key ? (
                      <div className="config-edit">
                        <input
                          type="text"
                          value={editingEndpoint.value}
                          onChange={(e) => setEditingEndpoint({ ...editingEndpoint, value: e.target.value })}
                          placeholder="http://localhost:4000"
                          className="config-endpoint-input"
                        />
                        <button className="btn-sm btn-primary" onClick={handleSaveEndpoint}>Save</button>
                        <button className="btn-sm btn-secondary" onClick={() => setEditingEndpoint(null)}>Cancel</button>
                      </div>
                    ) : (
                      <div className="config-value">
                        <span className="endpoint-url">{val}</span>
                        <button className="btn-sm btn-primary" onClick={() => setEditingEndpoint({ key, value: val })}>Edit</button>
                      </div>
                    )}
                  </div>
                ))}
                {(!config.endpoints || Object.keys(config.endpoints).length === 0) && (
                  <p className="admin-empty">No endpoint config. Run migration 006 to seed defaults.</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* System Logs */}
        {activeTab === 'logs' && (
          <div className="settings-panel">
            <h2>System Logs</h2>
            <p className="settings-desc">Application logs for troubleshooting. Filter by level.</p>
            <div className="settings-toolbar">
              <select value={logLevel} onChange={(e) => setLogLevel(e.target.value)} aria-label="Filter by log level">
                <option value="">All levels</option>
                <option value="error">Error</option>
                <option value="warn">Warn</option>
                <option value="info">Info</option>
                <option value="debug">Debug</option>
              </select>
              <button className="btn-secondary" onClick={loadLogs}>Refresh</button>
            </div>
            <form onSubmit={handleAddLog} className="settings-log-add">
              <input
                type="text"
                value={newLog.message}
                onChange={(e) => setNewLog({ ...newLog, message: e.target.value })}
                placeholder="Add test log message..."
                aria-label="Log message"
              />
              <select value={newLog.level} onChange={(e) => setNewLog({ ...newLog, level: e.target.value as 'info' | 'warn' | 'error' | 'debug' })} aria-label="Log level">
                <option value="info">Info</option>
                <option value="warn">Warn</option>
                <option value="error">Error</option>
                <option value="debug">Debug</option>
              </select>
              <button type="submit" className="btn-primary" disabled={addingLog || !newLog.message.trim()}>Add Log</button>
            </form>
            {logsLoading ? (
              <div className="admin-loading">Loading...</div>
            ) : (
              <div className="settings-logs">
                {logs.map((log) => (
                  <div key={log.id} className={`settings-log-item log-${log.level}`}>
                    <span className="log-time">{new Date(log.created_at).toLocaleString()}</span>
                    <span className="log-level">{log.level}</span>
                    {log.service && <span className="log-service">{log.service}</span>}
                    <span className="log-message">{log.message}</span>
                  </div>
                ))}
                {logs.length === 0 && <p className="admin-empty">No system logs</p>}
              </div>
            )}
          </div>
        )}

        {/* Audit Logs */}
        {activeTab === 'audit' && (
          <div className="settings-panel">
            <h2>Audit Logs</h2>
            <p className="settings-desc">User action history for compliance and troubleshooting.</p>
            <button className="btn-secondary" onClick={loadAuditLogs}>Refresh</button>
            <div className="settings-logs">
              {auditLogs.map((log) => (
                <div key={log.id} className="settings-log-item log-info">
                  <span className="log-time">{new Date(log.created_at).toLocaleString()}</span>
                  <span className="log-message">{log.action}</span>
                  {log.email && <span className="log-service">{log.email}</span>}
                </div>
              ))}
              {auditLogs.length === 0 && <p className="admin-empty">No audit logs</p>}
            </div>
          </div>
        )}

        {/* Maintenance */}
        {activeTab === 'maintenance' && (
          <div className="settings-panel">
            <h2>Maintenance &amp; Troubleshooting</h2>
            <p className="settings-desc">Run health checks and maintenance tasks to resolve system issues.</p>
            <div className="maintenance-health">
              <h3>Database Health</h3>
              {health ? (
                <div className={`health-status ${health.status === 'ok' ? 'ok' : 'error'}`}>
                  <span>{health.status === 'ok' ? '🟢' : '🔴'}</span>
                  <span>{health.status === 'ok' ? 'Connected' : 'Disconnected'}</span>
                  {health.db && <span>({health.db})</span>}
                </div>
              ) : (
                <span>—</span>
              )}
              <button className="btn-primary" onClick={() => runMaintenance('health')} disabled={maintenanceAction !== null}>
                {maintenanceAction === 'health' ? 'Checking...' : 'Run Health Check'}
              </button>
            </div>
            <div className="maintenance-actions">
              <h3>Quick Actions</h3>
              <div className="maintenance-buttons">
                <button className="btn-secondary" onClick={() => runMaintenance('clear-cache')} disabled={maintenanceAction !== null}>
                  Clear Cache
                </button>
                <button className="btn-secondary" onClick={() => runMaintenance('db-backup')} disabled={maintenanceAction !== null}>
                  Request DB Backup
                </button>
                <button className="btn-restart" onClick={openRestartModal} disabled={restarting}>
                  🔄 Restart System
                </button>
              </div>
            </div>
            <div className="maintenance-migrations">
              <h3>Database Migrations</h3>
              <p className="settings-desc">Run all database migrations (001–007) to create or update tables. Safe to run multiple times (uses IF NOT EXISTS).</p>
              <button
                className="btn-primary"
                onClick={handleRunMigrations}
                disabled={migrating}
              >
                {migrating ? 'Running migrations...' : 'Run Full Database Migrations'}
              </button>
            </div>
            <div className="maintenance-rebuild">
              <h3>Rebuild &amp; Restart Service</h3>
              <p className="settings-desc">Rebuild Docker image with <code>--no-cache</code> and restart the container. Use when a service has outdated code (e.g. auth-service missing request-access route). Requires <code>COMPOSE_PROJECT_DIR</code> env.</p>
              <div className="rebuild-controls">
                <select
                  value={rebuildService}
                  onChange={(e) => setRebuildService(e.target.value)}
                  aria-label="Select service to rebuild"
                  className="rebuild-select"
                >
                  <option value="">Select service...</option>
                  <option value="auth-service">auth-service</option>
                  <option value="api-gateway">api-gateway</option>
                  <option value="farmer-service">farmer-service</option>
                  <option value="admin-service">admin-service</option>
                  <option value="device-service">device-service</option>
                  <option value="system-service">system-service</option>
                </select>
                <button
                  className="btn-primary"
                  onClick={handleRebuildService}
                  disabled={rebuilding || !rebuildService}
                >
                  {rebuilding ? 'Rebuilding...' : 'Rebuild & Restart'}
                </button>
              </div>
            </div>
            <div className="maintenance-tips">
              <h3>Troubleshooting Tips</h3>
              <ul>
                <li><strong>Database connection failed:</strong> Check PostgreSQL is running and DATABASE_URL is correct.</li>
                <li><strong>API Gateway timeout:</strong> Ensure all microservices (auth, farmer, admin, system) are running.</li>
                <li><strong>Sensor/Robot not responding:</strong> Verify device is initialized and configured in admin Sensors/Robots pages.</li>
                <li><strong>Farmer app cannot connect:</strong> Confirm REACT_APP_API_URL points to API Gateway (e.g. http://localhost:5001).</li>
                <li><strong>Request Farmer Access fails / 404:</strong> Rebuild auth-service (above) or run: <code>docker compose build --no-cache auth-service &amp;&amp; docker compose up -d auth-service</code></li>
                <li><strong>Missing tables / Run migration X first:</strong> Click &quot;Run Full Database Migrations&quot; above, or run migrations manually via psql.</li>
              </ul>
            </div>
          </div>
        )}

        {/* Restart confirmation modal - 3 steps */}
        {restartStep > 0 && (
          <div className="admin-modal-overlay restart-modal-overlay" onClick={() => restartStep < 3 && closeRestartModal()}>
            <div className="admin-modal restart-modal" onClick={(e) => e.stopPropagation()}>
              <h3>⚠️ System Restart</h3>
              {restartStep === 1 && (
                <>
                  <p className="restart-warning-text">
                    <strong>Step 1 of 3:</strong> Are you sure you want to restart the entire system?
                  </p>
                  <p className="restart-detail">This will restart all microservices (API Gateway, Auth, Farmer, Admin, System, etc.). Active user sessions will be disconnected.</p>
                  <div className="admin-form-actions">
                    <button type="button" className="btn-primary" onClick={handleRestartStep}>I understand, continue</button>
                    <button type="button" className="btn-secondary" onClick={closeRestartModal}>Cancel</button>
                  </div>
                </>
              )}
              {restartStep === 2 && (
                <>
                  <p className="restart-warning-text">
                    <strong>Step 2 of 3:</strong> Final warning
                  </p>
                  <p className="restart-detail">This action cannot be undone. All services will be stopped and restarted. Estimated downtime: 30–60 seconds. Farmers and admins will need to log in again.</p>
                  <div className="admin-form-actions">
                    <button type="button" className="btn-primary" onClick={handleRestartStep}>I accept the risk, proceed</button>
                    <button type="button" className="btn-secondary" onClick={closeRestartModal}>Cancel</button>
                  </div>
                </>
              )}
              {restartStep === 3 && (
                <>
                  <p className="restart-warning-text">
                    <strong>Step 3 of 3:</strong> Type RESTART to confirm
                  </p>
                  <p className="restart-detail">To prevent accidental restarts, type <strong>RESTART</strong> (all caps) in the box below.</p>
                  <div className="admin-form-field">
                    <input
                      type="text"
                      value={restartConfirmText}
                      onChange={(e) => setRestartConfirmText(e.target.value)}
                      placeholder="Type RESTART here"
                      aria-label="Type RESTART to confirm"
                      className="restart-confirm-input"
                      autoComplete="off"
                    />
                  </div>
                  <div className="admin-form-actions">
                    <button
                      type="button"
                      className="btn-restart-confirm"
                      onClick={handleRestartConfirm}
                      disabled={restarting || restartConfirmText.toUpperCase() !== 'RESTART'}
                    >
                      {restarting ? 'Restarting...' : 'Confirm & Restart System'}
                    </button>
                    <button type="button" className="btn-secondary" onClick={closeRestartModal}>Cancel</button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="admin-footer">
        <span onClick={() => navigate('/')}>🏠 Dashboard</span>
        <span onClick={() => navigate('/farmers')}>👥 Farmers</span>
        <span onClick={() => navigate('/crops')}>🌱 Crops</span>
        <span onClick={() => navigate('/analytics')}>📊 Analytics</span>
        <span onClick={() => navigate('/sensors')}>📡 Sensors</span>
        <span onClick={() => navigate('/robots')}>🤖 Robots</span>
        <span onClick={() => navigate('/profile')}>👤 Profile</span>
        <span className="active">⚙️ Settings</span>
        <span onClick={() => navigate('/requests')}>📋 Requests</span>
        <span onClick={() => navigate('/users')}>👤 Admin Users</span>
      </div>
    </div>
  );
};

export default SettingsView;
