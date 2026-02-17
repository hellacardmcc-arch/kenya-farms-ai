import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getAnalytics, type Analytics } from '../api/adminApi';
import './AdminPage.css';

const AnalyticsView: React.FC = () => {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    getAnalytics(token)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div className="admin-header-row">
          <div>
            <h1>🇰🇪 Kenya Farms AI Admin</h1>
            <p>Analytics</p>
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
        {loading ? (
          <div className="admin-loading">Loading...</div>
        ) : data ? (
          <>
            <div className="admin-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
              <div className="stat-card" style={{ background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                <div style={{ fontSize: '14px', color: '#64748b' }}>Farmers</div>
                <div style={{ fontSize: '28px', fontWeight: '700', color: '#1e293b' }}>{data.farmers}</div>
              </div>
              <div className="stat-card" style={{ background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                <div style={{ fontSize: '14px', color: '#64748b' }}>Crops</div>
                <div style={{ fontSize: '28px', fontWeight: '700', color: '#1e293b' }}>{data.crops}</div>
              </div>
              <div className="stat-card" style={{ background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                <div style={{ fontSize: '14px', color: '#64748b' }}>Farms</div>
                <div style={{ fontSize: '28px', fontWeight: '700', color: '#1e293b' }}>{data.farms}</div>
              </div>
              <div className="stat-card" style={{ background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                <div style={{ fontSize: '14px', color: '#64748b' }}>Alerts</div>
                <div style={{ fontSize: '28px', fontWeight: '700', color: '#1e293b' }}>{data.alerts}</div>
              </div>
            </div>

            <div style={{ background: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <h3 style={{ margin: '0 0 16px 0' }}>Top Crops</h3>
              {data.topCrops.length === 0 ? (
                <p style={{ color: '#64748b' }}>No crop data yet</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {data.topCrops.map((c) => (
                    <div key={c.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: '500' }}>{c.name}</span>
                      <span style={{ color: '#64748b' }}>{c.farmers} farmers</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <p className="admin-empty">Failed to load analytics</p>
        )}
      </div>

      <div className="admin-footer">
        <span onClick={() => navigate('/')}>🏠 Dashboard</span>
        <span onClick={() => navigate('/farmers')}>👥 Farmers</span>
        <span onClick={() => navigate('/farms')}>🌾 Farms</span>
        <span onClick={() => navigate('/crops')}>🌱 Crops</span>
        <span className="active">📊 Analytics</span>
        <span onClick={() => navigate('/sensors')}>📡 Sensors</span>
        <span onClick={() => navigate('/robots')}>🤖 Robots</span>
        <span onClick={() => navigate('/settings')}>⚙️ Settings</span>
        <span onClick={() => navigate('/users')}>👤 Admin Users</span>
      </div>
    </div>
  );
};

export default AnalyticsView;
