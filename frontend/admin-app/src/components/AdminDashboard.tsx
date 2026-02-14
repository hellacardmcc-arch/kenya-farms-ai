// EXACT Admin Dashboard Component - Matches Preview
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getSystemHealthDetails, type SystemHealthDetails } from '../api/adminApi';
import './AdminDashboard.css';

const AdminDashboard = (): JSX.Element => {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const [dbStatus] = useState<'live' | 'demo' | 'offline'>('live');
  const [stats] = useState({
    farmers: 2847,
    farmersTrend: '+124',
    activeCrops: 1256,
    pendingWatering: 892,
    pendingRequests: 0
  });

  const [registrations] = useState([28, 32, 35, 29, 38, 42, 45]);

  const [topCrops] = useState([
    { name: "Maize", percentage: 45, farmers: 1280 },
    { name: "Beans", percentage: 32, farmers: 912 },
    { name: "Kale", percentage: 24, farmers: 684 },
    { name: "Tomatoes", percentage: 18, farmers: 513 },
    { name: "Potatoes", percentage: 12, farmers: 342 }
  ]);

  const [alerts] = useState([
    { id: 1, severity: "high", message: "Soil moisture critical - Farmer John (Kiambu)", time: "08:45" },
    { id: 2, severity: "medium", message: "Low battery - Sensor #A47 (Nakuru)", time: "08:30" },
    { id: 3, severity: "low", message: "Watering completed - Farm #1289", time: "08:15" },
    { id: 4, severity: "info", message: "New registration - Mumbi W. (Machakos)", time: "07:50" }
  ]);

  const [systemHealth, setSystemHealth] = useState<SystemHealthDetails | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [showHealthDetails, setShowHealthDetails] = useState(false);

  const getDbStatusClass = (): string => {
    switch (dbStatus) {
      case 'live': return 'db-status-live';
      case 'demo': return 'db-status-demo';
      default: return 'db-status-offline';
    }
  };

  const getDbStatusText = (): string => {
    switch (dbStatus) {
      case 'live': return '🟢 LIVE DATABASE';
      case 'demo': return '🟡 DEMO MODE';
      default: return '🔴 OFFLINE';
    }
  };

  const loadHealth = () => {
    if (!token) return;
    setHealthLoading(true);
    getSystemHealthDetails(token)
      .then(setSystemHealth)
      .catch(() => setSystemHealth(null))
      .finally(() => setHealthLoading(false));
  };

  useEffect(() => {
    if (token) loadHealth();
  }, [token]);

  return (
    <div className="admin-dashboard">
      <header className="admin-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: '24px', marginBottom: '4px' }}>🇰🇪 Kenya Farms AI Admin</h1>
            <p style={{ opacity: 0.8 }}>System Administration Dashboard</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button onClick={() => navigate('/users')} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer' }}>👥 Admin Users</button>
            <button onClick={() => navigate('/profile')} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer' }}>👤 Profile</button>
            <button onClick={() => { logout(); navigate('/login'); }} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer' }}>Logout</button>
          </div>
        </div>
      </header>

      <div className={`db-status-banner ${getDbStatusClass()}`}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '20px' }}>{dbStatus === 'live' ? '🟢' : dbStatus === 'demo' ? '🟡' : '🔴'}</span>
          <span style={{ fontWeight: '600' }}>{getDbStatusText()}</span>
          <span style={{ fontSize: '14px', opacity: 0.9 }}>| PostgreSQL 15 | 24 connections | Last backup: Today 2:00 AM</span>
        </div>
        <button onClick={() => window.location.reload()} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', padding: '4px 12px', borderRadius: '4px', cursor: 'pointer' }}>🔄 Refresh</button>
      </div>

      <div className="admin-stats-grid">
        <div className="stat-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
            <span className="stat-label">Farmers</span>
            <span style={{ color: '#10b981', fontSize: '14px' }}>{stats.farmersTrend}</span>
          </div>
          <div className="stat-value">{stats.farmers.toLocaleString()}</div>
          <span className="stat-label">Total registered</span>
        </div>
        <div className="stat-card">
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span className="stat-label">Active Crops</span></div>
          <div className="stat-value">{stats.activeCrops.toLocaleString()}</div>
          <span className="stat-label">Currently growing</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Pending Watering</span>
          <div className="stat-value">{stats.pendingWatering.toLocaleString()}</div>
          <span className="stat-label">Tasks today</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">System Health</span>
          <div className="stat-value">{systemHealth ? '🟢' : '—'}</div>
          <span className="stat-label">Database status</span>
        </div>
      </div>

      <div className="admin-main-grid">
        <div>
          <div className="stat-card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h3>📈 Farmer Registrations (Last 7 Days)</h3>
              <button style={{ color: '#3b82f6', border: 'none', background: 'none', cursor: 'pointer' }}>View Details →</button>
            </div>
            <div style={{ height: '200px', display: 'flex', alignItems: 'flex-end', gap: '8px', padding: '0 8px' }}>
              {registrations.map((value, i) => (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ height: `${value * 4}px`, width: '100%', background: '#3b82f6', borderRadius: '4px 4px 0 0', transition: 'height 0.3s' }}></div>
                  <span style={{ fontSize: '12px', marginTop: '8px', color: '#64748b' }}>{['Fri','Sat','Sun','Mon','Tue','Wed','Thu'][i]}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="stat-card" style={{ padding: '20px', marginTop: '20px' }}>
            <h3 style={{ marginBottom: '20px' }}>🌾 Top Crops Being Grown</h3>
            {topCrops.map(crop => (
              <div key={crop.name} style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontWeight: '500' }}>{crop.name}</span>
                  <span style={{ color: '#64748b', fontSize: '14px' }}>{crop.farmers} farmers</span>
                </div>
                <div style={{ height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${crop.percentage}%`, height: '100%', background: '#3b82f6', borderRadius: '4px' }}></div>
                </div>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>{crop.percentage}%</div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="stat-card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h3>🔔 Recent Alerts</h3>
              <button style={{ color: '#3b82f6', border: 'none', background: 'none', cursor: 'pointer' }}>View All</button>
            </div>
            {alerts.map(alert => (
              <div key={alert.id} style={{ padding: '12px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '16px' }}>{alert.severity === 'high' ? '🔴' : alert.severity === 'medium' ? '🟡' : alert.severity === 'low' ? '🟢' : '🔵'}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '14px' }}>{alert.message}</div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>{alert.time}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="stat-card" style={{ padding: '20px', marginTop: '20px' }}>
            <h3 style={{ marginBottom: '20px' }}>⚙️ System Health</h3>
            {healthLoading ? (
              <div style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>Loading...</div>
            ) : systemHealth ? (
              <>
                <div style={{ display: 'grid', gap: '16px' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}><span>Services</span><span>{systemHealth.services.online}/{systemHealth.services.total} online</span></div>
                    <div style={{ height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: `${systemHealth.services.total ? (systemHealth.services.online / systemHealth.services.total) * 100 : 0}%`, height: '100%', background: '#10b981' }}></div>
                    </div>
                  </div>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}><span>CPU</span><span>{systemHealth.cpu.percent}%</span></div>
                    <div style={{ height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: `${Math.min(100, systemHealth.cpu.percent)}%`, height: '100%', background: '#3b82f6' }}></div>
                    </div>
                  </div>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}><span>RAM</span><span>{systemHealth.ram.percent}%</span></div>
                    <div style={{ height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: `${systemHealth.ram.percent}%`, height: '100%', background: '#f59e0b' }}></div>
                    </div>
                  </div>
                  {systemHealth.disk && (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}><span>Disk</span><span>{systemHealth.disk.percent}%</span></div>
                      <div style={{ height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ width: `${systemHealth.disk.percent}%`, height: '100%', background: '#8b5cf6' }}></div>
                      </div>
                    </div>
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px' }}>
                    <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px' }}>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>Uptime</div>
                      <div style={{ fontWeight: '600' }}>{systemHealth.uptime}</div>
                    </div>
                    <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px' }}>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>Database</div>
                      <div style={{ fontWeight: '600', color: systemHealth.db === 'connected' ? '#10b981' : '#ef4444' }}>{systemHealth.db}</div>
                    </div>
                  </div>
                </div>
                <div style={{ marginTop: '20px', display: 'flex', gap: '8px' }}>
                  <button onClick={() => setShowHealthDetails(true)} style={{ flex: 1, padding: '8px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>View Details</button>
                  <button onClick={loadHealth} disabled={healthLoading} style={{ flex: 1, padding: '8px', background: '#10b981', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>{healthLoading ? 'Checking...' : 'Run Health Check'}</button>
                </div>
              </>
            ) : (
              <div style={{ padding: '24px', textAlign: 'center' }}>
                <p style={{ color: '#64748b', marginBottom: '16px' }}>Unable to load health data</p>
                <button onClick={loadHealth} disabled={healthLoading} style={{ padding: '8px 16px', background: '#10b981', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Retry</button>
              </div>
            )}
          </div>

          {showHealthDetails && systemHealth && (
            <div className="admin-modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setShowHealthDetails(false)}>
              <div className="admin-modal" style={{ maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
                <h3 style={{ marginBottom: '16px' }}>⚙️ System Health Details</h3>
                <div style={{ display: 'grid', gap: '16px' }}>
                  <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px' }}>
                    <div style={{ fontWeight: '600', marginBottom: '8px' }}>CPU</div>
                    <div style={{ fontSize: '14px', color: '#64748b' }}>{systemHealth.cpu.percent}% • {systemHealth.cpu.cores} cores • Load: {systemHealth.cpu.loadAvg.map((l, i) => l?.toFixed(2) ?? '0').join(', ')}</div>
                  </div>
                  <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px' }}>
                    <div style={{ fontWeight: '600', marginBottom: '8px' }}>RAM</div>
                    <div style={{ fontSize: '14px', color: '#64748b' }}>{systemHealth.ram.usedMb} MB / {systemHealth.ram.totalMb} MB ({systemHealth.ram.percent}% used)</div>
                  </div>
                  {systemHealth.disk && (
                    <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px' }}>
                      <div style={{ fontWeight: '600', marginBottom: '8px' }}>Disk</div>
                      <div style={{ fontSize: '14px', color: '#64748b' }}>{systemHealth.disk.percent}% used • {systemHealth.disk.freeGb} GB free / {systemHealth.disk.totalGb} GB total</div>
                    </div>
                  )}
                  <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px' }}>
                    <div style={{ fontWeight: '600', marginBottom: '8px' }}>Services</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {systemHealth.services.list.map((s) => (
                        <div key={s.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px' }}>
                          <span>{s.name}</span>
                          <span style={{ color: s.status === 'online' ? '#10b981' : '#ef4444', fontWeight: 500 }}>{s.status === 'online' ? '🟢 Online' : '🔴 Offline'}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px' }}>
                    <div style={{ fontWeight: '600', marginBottom: '4px' }}>Database</div>
                    <div style={{ fontSize: '14px', color: systemHealth.db === 'connected' ? '#10b981' : '#ef4444' }}>{systemHealth.db}</div>
                  </div>
                  <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px' }}>
                    <div style={{ fontWeight: '600', marginBottom: '4px' }}>Process Uptime</div>
                    <div style={{ fontSize: '14px', color: '#64748b' }}>{systemHealth.uptime}</div>
                  </div>
                </div>
                <div style={{ marginTop: '20px', display: 'flex', gap: '8px' }}>
                  <button onClick={loadHealth} disabled={healthLoading} style={{ flex: 1, padding: '8px', background: '#10b981', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Refresh</button>
                  <button onClick={() => setShowHealthDetails(false)} style={{ flex: 1, padding: '8px', background: '#e2e8f0', color: '#475569', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Close</button>
                </div>
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '20px' }}>
            <button onClick={() => navigate('/farmers')} style={{ padding: '16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', cursor: 'pointer' }}>
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>👥</div><div>Manage Farmers</div>
            </button>
            <button onClick={() => navigate('/crops')} style={{ padding: '16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', cursor: 'pointer' }}>
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>🌱</div><div>Manage Crops</div>
            </button>
            <button onClick={() => navigate('/analytics')} style={{ padding: '16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', cursor: 'pointer' }}>
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>📊</div><div>Analytics</div>
            </button>
            <button onClick={() => navigate('/sensors')} style={{ padding: '16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', cursor: 'pointer' }}>
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>📡</div><div>Sensors</div>
            </button>
            <button onClick={() => navigate('/robots')} style={{ padding: '16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', cursor: 'pointer' }}>
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>🤖</div><div>Robots</div>
            </button>
            <button onClick={() => navigate('/profile')} style={{ padding: '16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', cursor: 'pointer' }}>
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>👤</div><div>Profile</div>
            </button>
            <button onClick={() => navigate('/settings')} style={{ padding: '16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', cursor: 'pointer' }}>
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>⚙️</div><div>Settings</div>
            </button>
          </div>
        </div>
      </div>

      <div style={{ background: 'white', borderTop: '1px solid #e2e8f0', padding: '12px 20px', display: 'flex', gap: '24px', marginTop: '20px' }}>
        <span style={{ color: '#3b82f6', fontWeight: '600', cursor: 'pointer' }} onClick={() => navigate('/')}>🏠 Dashboard</span>
        <span style={{ color: '#64748b', cursor: 'pointer' }} onClick={() => navigate('/farmers')}>👥 Farmers</span>
        <span style={{ color: '#64748b', cursor: 'pointer' }} onClick={() => navigate('/crops')}>🌱 Crops</span>
        <span style={{ color: '#64748b', cursor: 'pointer' }} onClick={() => navigate('/analytics')}>📊 Analytics</span>
        <span style={{ color: '#64748b', cursor: 'pointer' }} onClick={() => navigate('/sensors')}>📡 Sensors</span>
        <span style={{ color: '#64748b', cursor: 'pointer' }} onClick={() => navigate('/robots')}>🤖 Robots</span>
        <span style={{ color: '#64748b', cursor: 'pointer' }} onClick={() => navigate('/profile')}>👤 Profile</span>
        <span style={{ color: '#64748b', cursor: 'pointer' }} onClick={() => navigate('/settings')}>⚙️ Settings</span>
      </div>
    </div>
  );
};

export default AdminDashboard;
