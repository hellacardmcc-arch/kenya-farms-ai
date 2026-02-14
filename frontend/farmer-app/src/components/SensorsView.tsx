import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getSensors, getAvailableSensors, activateSensor, type Sensor } from '../api/systemApi';
import { getFarmerDashboard } from '../api/farmerApi';
import LanguageSelector from './LanguageSelector';
import './SensorsView.css';

const SensorsView: React.FC = () => {
  const { token, logout } = useAuth();
  const navigate = useNavigate();
  const [language, setLanguage] = useState<'sw' | 'en'>('sw');
  const [sensors, setSensors] = useState<Sensor[]>([]);
  const [availableSensors, setAvailableSensors] = useState<{ id: string; name: string; type?: string; unit?: string }[]>([]);
  const [farms, setFarms] = useState<{ id: string; name: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState<string | null>(null);
  const [selectedFarm, setSelectedFarm] = useState<Record<string, string>>({});

  const load = () => {
    if (!token) return;
    Promise.all([
      getSensors(token),
      getAvailableSensors(token),
      getFarmerDashboard(token)
    ])
      .then(([s, a, d]) => {
        setSensors(s);
        setAvailableSensors(a);
        setFarms(d.farms || []);
      })
      .catch(() => { setSensors([]); setAvailableSensors([]); setFarms([]); })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [token]);

  const handleActivateSensor = async (sensorId: string) => {
    const farmId = selectedFarm[sensorId];
    if (!token || !farmId) {
      alert(language === 'sw' ? 'Chagua shamba' : 'Select a farm');
      return;
    }
    setActivating(sensorId);
    try {
      await activateSensor(token, sensorId, farmId);
      alert(language === 'sw' ? 'Kipima kimeunganishwa!' : 'Sensor activated and paired!');
      load();
    } catch {
      alert(language === 'sw' ? 'Imeshindwa' : 'Failed');
    } finally {
      setActivating(null);
    }
  };

  const [showAddSection, setShowAddSection] = useState(false);

  const t = {
    en: {
      title: 'Sensors',
      subtitle: 'Monitor your farm sensors',
      addDevice: 'Add Sensor',
      mySensors: 'My Sensors',
      activateTitle: 'Activate New Sensor',
      activateDesc: 'Pair a registered sensor to your farm. Select a farm and click Activate.',
      selectFarm: 'Select farm',
      activate: 'Activate',
      soilMoisture: 'Soil Moisture',
      temperature: 'Temperature',
      humidity: 'Humidity',
      light: 'Light Level',
      status: 'Status',
      online: 'Online',
      lastReading: 'Last reading',
      back: 'Back',
      home: 'Home',
      noAvailable: 'No sensors available to activate. Contact admin to register new sensors.',
      noFarms: 'You have no farms. Add a farm first.'
    },
    sw: {
      title: 'Vipima',
      subtitle: 'Angalia vipima vya shamba lako',
      addDevice: 'Ongeza Kipima',
      mySensors: 'Vipima Vyangu',
      activateTitle: 'Unganisha Kipima Kipya',
      activateDesc: 'Unganisha kipima kilichosajiliwa na shamba lako. Chagua shamba na bofya Unganisha.',
      selectFarm: 'Chagua shamba',
      activate: 'Unganisha',
      soilMoisture: 'Unyevu wa Udongo',
      temperature: 'Joto',
      humidity: 'Unyevu wa Hewa',
      light: 'Kiwango cha Mwanga',
      status: 'Hali',
      online: 'Inatumika',
      lastReading: 'Sensa ya mwisho',
      back: 'Rudi',
      home: 'Nyumbani',
      noAvailable: 'Hakuna vipima vinavyoweza kuunganishwa. Wasiliana na msimamizi kusajili vipima vipya.',
      noFarms: 'Huna mashamba. Ongeza shamba kwanza.'
    }
  };

  const currentLang = t[language];
  const iconMap: Record<string, string> = { moisture: '💧', temperature: '🌡️', humidity: '💨', light: '☀️' };
  const displaySensors = sensors.length ? sensors : [
    { id: '1', name: currentLang.soilMoisture, type: 'moisture', value: 45, unit: '%', status: 'online', last_reading_at: '' },
    { id: '2', name: currentLang.temperature, type: 'temperature', value: 27, unit: '°C', status: 'online', last_reading_at: '' },
    { id: '3', name: currentLang.humidity, type: 'humidity', value: 62, unit: '%', status: 'online', last_reading_at: '' },
    { id: '4', name: currentLang.light, type: 'light', value: 850, unit: 'lux', status: 'online', last_reading_at: '' }
  ];

  return (
    <div className="sensors-view farmer-dashboard">
      <header className="kenya-flag-header">
        <div>
          <h1>Kenya Farms AI</h1>
          <p style={{ fontSize: '14px', opacity: 0.9 }}>{currentLang.title}</p>
        </div>
        <div className="header-actions">
          <LanguageSelector language={language} onLanguageChange={setLanguage} />
          <button onClick={() => { logout(); navigate('/login'); }} className="header-btn">
            {language === 'sw' ? 'Toka' : 'Logout'}
          </button>
        </div>
      </header>

      <div className="sensors-content">
        <button onClick={() => navigate('/')} className="back-btn">
          ← {currentLang.back}
        </button>
        <h2 className="sensors-title">{currentLang.subtitle}</h2>

        <div className="add-device-section">
          <button
            type="button"
            className={`add-device-toggle ${showAddSection ? 'expanded' : ''}`}
            onClick={() => setShowAddSection(!showAddSection)}
            aria-expanded={showAddSection}
          >
            <span>➕ {currentLang.addDevice}</span>
            <span className="toggle-icon">{showAddSection ? '▼' : '▶'}</span>
          </button>
          {showAddSection && (
            <div className="activate-section">
              <h3>{currentLang.activateTitle}</h3>
              <p className="activate-desc">{currentLang.activateDesc}</p>
              {farms.length === 0 ? (
                <p className="activate-no-farm">{currentLang.noFarms}</p>
              ) : availableSensors.length === 0 ? (
                <p className="activate-no-farm">{currentLang.noAvailable}</p>
              ) : (
                <div className="activate-list">
                  {availableSensors.map((s) => (
                    <div key={s.id} className="activate-item">
                      <span>📡 {s.name}{s.type ? ` (${s.type})` : ''}</span>
                      <select
                        value={selectedFarm[s.id] || ''}
                        onChange={(e) => setSelectedFarm({ ...selectedFarm, [s.id]: e.target.value })}
                        aria-label={currentLang.selectFarm}
                      >
                        <option value="">{currentLang.selectFarm}</option>
                        {farms.map((f) => (
                          <option key={f.id} value={f.id}>{f.name || f.id}</option>
                        ))}
                      </select>
                      <button className="control-btn start" onClick={() => handleActivateSensor(s.id)} disabled={activating === s.id}>
                        {activating === s.id ? '...' : currentLang.activate}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <h3 className="my-devices-title">{currentLang.mySensors}</h3>
        {loading ? <div className="sensors-loading">{language === 'sw' ? 'Inapakia...' : 'Loading...'}</div> : (
        <div className="sensors-grid">
          {displaySensors.map(sensor => (
            <div key={sensor.id} className="sensor-card">
              <span className="sensor-icon">{iconMap[sensor.type] || '📡'}</span>
              <h3>{sensor.name}</h3>
              <div className="sensor-value">{sensor.value}{sensor.unit}</div>
              <div className="sensor-meta">
                <span className="sensor-status">{currentLang.status}: {currentLang.online}</span>
                <span className="sensor-reading">{currentLang.lastReading}: {sensor.last_reading_at ? new Date(sensor.last_reading_at).toLocaleTimeString() : '—'}</span>
              </div>
            </div>
          ))}
        </div>
        )}
      </div>

      <nav className="bottom-nav">
        <div className="nav-item" onClick={() => navigate('/')}><i className="fas fa-home"></i><span>{currentLang.home}</span></div>
        <div className="nav-item active"><i className="fas fa-tower-broadcast"></i><span>{currentLang.title}</span></div>
        <div className="nav-item" onClick={() => navigate('/robots')}><i className="fas fa-robot"></i><span>{language === 'sw' ? 'Roboti' : 'Robots'}</span></div>
      </nav>
    </div>
  );
};

export default SensorsView;
