import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getFarms, type Farm } from '../api/adminApi';
import { AreaDisplay } from './AreaDisplay';
import { AreaUnitSelector } from './AreaUnitSelector';
import './AdminPage.css';

const FarmsView: React.FC = () => {
  const { token, logout } = useAuth();
  const navigate = useNavigate();
  const [farms, setFarms] = useState<Farm[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = () => {
    if (!token) return;
    getFarms(token, true)
      .then(setFarms)
      .catch(() => setFarms([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [token]);

  const formatDate = (d: string | undefined) => (d ? new Date(d).toLocaleDateString() : '—');

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div className="admin-header-row">
          <div>
            <h1>🇰🇪 Kenya Farms AI Admin</h1>
            <p>Registered Farms</p>
          </div>
          <div className="admin-header-actions">
            <button onClick={() => navigate('/')}>Dashboard</button>
            <button onClick={() => navigate('/farmers')}>👥 Farmers</button>
            <button onClick={() => navigate('/settings')}>⚙️ Settings</button>
            <button onClick={() => { logout(); navigate('/login'); }}>Logout</button>
          </div>
        </div>
      </header>

      <div className="admin-page-content">
        <div className="admin-toolbar">
          <AreaUnitSelector />
        </div>

        {loading ? (
          <div className="admin-loading">Loading...</div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table farms-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Unique Code</th>
                  <th>Farmer</th>
                  <th>Location</th>
                  <th>Area</th>
                  <th>Coordinates</th>
                  <th>Sensors</th>
                  <th>Robots</th>
                  <th>Crops</th>
                  <th>Created</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {farms.map((f) => (
                  <React.Fragment key={f.id}>
                    <tr>
                      <td><strong>{f.name || '—'}</strong></td>
                      <td><code className="farm-code">{f.unique_code || '—'}</code></td>
                      <td>{f.farmer_name || '—'}</td>
                      <td>{f.location || '—'}</td>
                      <td><AreaDisplay hectares={f.area_hectares} /></td>
                      <td className="coords-cell">
                        {f.latitude != null && f.longitude != null
                          ? `${Number(f.latitude).toFixed(4)}, ${Number(f.longitude).toFixed(4)}`
                          : '—'}
                      </td>
                      <td><span className="badge-count">{f.sensor_count ?? 0}</span></td>
                      <td><span className="badge-count">{f.robot_count ?? 0}</span></td>
                      <td><span className="badge-count">{f.crops_count ?? 0}</span></td>
                      <td>{formatDate(f.created_at)}</td>
                      <td>
                        {(f.crops?.length ?? 0) > 0 && (
                          <button
                            className="btn-sm btn-primary"
                            onClick={() => setExpandedId(expandedId === f.id ? null : f.id)}
                          >
                            {expandedId === f.id ? 'Hide' : 'View'} crops
                          </button>
                        )}
                      </td>
                    </tr>
                    {expandedId === f.id && f.crops && f.crops.length > 0 && (
                      <tr className="farm-detail-row">
                        <td colSpan={11}>
                          <div className="farm-crops-detail">
                            <h4>Current crops on this farm</h4>
                            <table className="admin-table nested-table">
                              <thead>
                                <tr>
                                  <th>Crop</th>
                                  <th>Swahili</th>
                                  <th>Status</th>
                                  <th>Planted</th>
                                  <th>Harvest</th>
                                  <th>Area</th>
                                </tr>
                              </thead>
                              <tbody>
                                {f.crops.map((c) => (
                                  <tr key={c.id}>
                                    <td>{c.name}</td>
                                    <td>{c.swahili_name || '—'}</td>
                                    <td><span className={`badge-status badge-${c.status || 'growing'}`}>{c.status || 'growing'}</span></td>
                                    <td>{formatDate(c.planted_date)}</td>
                                    <td>{formatDate(c.harvest_date)}</td>
                                    <td><AreaDisplay hectares={c.area_hectares} /></td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
            {farms.length === 0 && <p className="admin-empty">No farms found</p>}
          </div>
        )}
      </div>

      <div className="admin-footer">
        <span onClick={() => navigate('/')}>🏠 Dashboard</span>
        <span onClick={() => navigate('/farmers')}>👥 Farmers</span>
        <span className="active">🌾 Farms</span>
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

export default FarmsView;
