// EXACT Farmer Dashboard Component - Matches Preview
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getFarmerDashboard, type Crop, type WateringTask, type Alert } from '../api/farmerApi';
import { getSensors, type Sensor } from '../api/systemApi';
import LanguageSelector from './LanguageSelector';
import './Dashboard.css';

const SWAHILI_NAMES: Record<string, string> = { Maize: 'Mahindi', Tomatoes: 'Nyanya', Kale: 'Sukuma Wiki', Beans: 'Maharage' };

const Dashboard = (): JSX.Element => {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const [farmer, setFarmer] = useState({ name: user?.name || 'Farmer', phone: '', county: '', farmSize: 0 });
  const [loading, setLoading] = useState(true);
  const [weather] = useState({
    location: 'Nairobi',
    temp: 27,
    condition: 'Sunny',
    forecast: [
      { day: 'Today', high: 27, low: 18, condition: 'Sunny' },
      { day: 'Tomorrow', high: 26, low: 17, condition: 'Partly Cloudy' },
      { day: 'Wed', high: 25, low: 17, condition: 'Light Rain' }
    ]
  });
  const [sensorReadings, setSensorReadings] = useState<{
    moisture: { value: number; unit: string; lastReadingAt: string | null } | null;
    humidity: { value: number; unit: string; lastReadingAt: string | null } | null;
    temperature: { value: number; unit: string; lastReadingAt: string | null } | null;
  }>({ moisture: null, humidity: null, temperature: null });
  const [moistureHistory, setMoistureHistory] = useState<number[]>([42, 43, 41, 44, 45, 43, 42, 45, 44, 43, 42, 41, 43, 44, 45, 46, 44, 43, 42, 45, 46, 45, 44, 43]);
  const [tasks, setTasks] = useState<Array<{ id: string; crop: string; cropSwahili: string; amount: number; time: string; completed: boolean; field: string }>>([]);
  const [crops, setCrops] = useState<Array<{ id: string; name: string; swahili: string; planted: string; area: number; harvest: string; daysLeft: number; status: string; completedTasks: number; totalTasks: number }>>([]);
  const [alerts, setAlerts] = useState<Array<{ id: string; severity: string; message: string; time: string }>>([]);
  const [language, setLanguage] = useState<'sw' | 'en'>('sw');

  const deriveReadings = (sensors: Sensor[]) => {
    const byType: Record<string, Sensor[]> = {};
    sensors.forEach((s) => {
      const t = (s.type || '').toLowerCase();
      if (['moisture', 'humidity', 'temperature', 'temp'].includes(t)) {
        const key = t === 'temp' ? 'temperature' : t;
        if (!byType[key]) byType[key] = [];
        byType[key].push(s);
      }
    });
    return {
      moisture: byType.moisture?.length ? { value: Math.round(byType.moisture.reduce((a, s) => a + (s.value ?? 0), 0) / byType.moisture.length), unit: byType.moisture[0]?.unit || '%', lastReadingAt: byType.moisture[0]?.last_reading_at || null } : null,
      humidity: byType.humidity?.length ? { value: Math.round(byType.humidity.reduce((a, s) => a + (s.value ?? 0), 0) / byType.humidity.length), unit: byType.humidity[0]?.unit || '%', lastReadingAt: byType.humidity[0]?.last_reading_at || null } : null,
      temperature: byType.temperature?.length ? { value: Math.round(byType.temperature.reduce((a, s) => a + (s.value ?? 0), 0) * 10) / 10, unit: byType.temperature[0]?.unit || '°C', lastReadingAt: byType.temperature[0]?.last_reading_at || null } : null,
    };
  };

  const formatLastReading = (iso: string | null) => {
    if (!iso) return '—';
    const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    return language === 'sw' ? `${mins} dakika zilizopita` : `${mins} min ago`;
  };

  useEffect(() => {
    if (!token) return;
    Promise.allSettled([getFarmerDashboard(token), getSensors(token)])
      .then(([dashboardResult, sensorsResult]) => {
        const data = dashboardResult.status === 'fulfilled' ? dashboardResult.value : null;
        const sensors = sensorsResult.status === 'fulfilled' ? sensorsResult.value : [];
        if (sensors.length) {
          setSensorReadings(deriveReadings(sensors));
          const m = sensors.find((s) => (s.type || '').toLowerCase() === 'moisture');
          if (m?.value != null) setMoistureHistory((prev) => [...prev.slice(1), m.value]);
        }
        if (!data) return;
        setFarmer({
          name: data.farmer.name || user?.name || 'Farmer',
          phone: data.farmer.phone || '',
          county: data.farmer.region || 'Nairobi',
          farmSize: data.farms.reduce((s, f) => s + (Number(f.area_hectares) || 0), 0)
        });
        setTasks(data.tasks.map((t: WateringTask) => ({
          id: t.id,
          crop: 'Crop',
          cropSwahili: 'Mazao',
          amount: t.amount_mm || 15,
          time: t.scheduled_time ? t.scheduled_time.slice(0, 5) : '6:00',
          completed: false,
          field: 'Field'
        })));
        setCrops(data.crops.map((c: Crop) => {
          const planted = c.planted_date || new Date().toISOString().slice(0, 10);
          const harvest = c.harvest_date || new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);
          const daysLeft = Math.max(0, Math.ceil((new Date(harvest).getTime() - Date.now()) / 86400000));
          return {
            id: c.id,
            name: c.name,
            swahili: c.swahili_name || SWAHILI_NAMES[c.name] || c.name,
            planted,
            area: Number(c.area_hectares) || 0.5,
            harvest,
            daysLeft,
            status: c.status || 'growing',
            completedTasks: 0,
            totalTasks: 30
          };
        }));
        setAlerts(data.alerts.map((a: Alert) => ({ id: a.id, severity: a.severity, message: a.message, time: a.time })));
      })
      .catch(() => {
        setCrops([
          { id: '1', name: 'Maize', swahili: 'Mahindi', planted: '2026-01-15', area: 1.5, harvest: '2026-05-15', daysLeft: 88, status: 'growing', completedTasks: 15, totalTasks: 45 },
          { id: '2', name: 'Kale', swahili: 'Sukuma Wiki', planted: '2026-02-01', area: 0.75, harvest: '2026-04-01', daysLeft: 48, status: 'growing', completedTasks: 8, totalTasks: 24 }
        ]);
        setAlerts([
          { id: '1', severity: 'high', message: 'Connect to add your farms and crops.', time: 'Now' }
        ]);
      })
      .finally(() => setLoading(false));
  }, [token, user?.name]);

  const t: Record<string, Record<string, string>> = {
    en: {
      moisture: "Soil Moisture", humidity: "Humidity", temperature: "Temperature", lastReading: "Last reading", todayTasks: "Today's Watering Tasks", tasks: "tasks",
      myCrops: "My Crops", active: "active", planted: "Planted", area: "Area", harvest: "Harvest", daysLeft: "days left",
      viewDetails: "View Details", addCrop: "Add New Crop", history: "Moisture History", alerts: "Alerts", new: "new",
      quickActions: "Quick Actions", waterToday: "Water Today", plantNew: "Plant New", callSupport: "Call Support",
      help: "Help", home: "Home", crops: "Crops", water: "Water", stats: "Stats", profile: "Profile"
    },
    sw: {
      moisture: "Unyevu wa Udongo", humidity: "Unyevu wa Hewa", temperature: "Joto", lastReading: "Sensa ya mwisho", todayTasks: "Kumwagilia Leo", tasks: "kazi",
      myCrops: "Mazao Yangu", active: "yanayolimwa", planted: "Ilipandwa", area: "Eneo", harvest: "Kuvuna",
      daysLeft: "siku zimesalia", viewDetails: "Angalia", addCrop: "Panda Zao Jipya", history: "Historia ya Unyevu",
      alerts: "Arifa", new: "mpya", quickActions: "Vitendo Haraka", waterToday: "Mwagilia Leo", plantNew: "Panda Upya",
      callSupport: "Piga Support", help: "Msaada", home: "Nyumbani", crops: "Mazao", water: "Maji", stats: "Takwimu", profile: "Wasifu"
    }
  };

  const currentLang = t[language];

  const getBarStatus = (type: 'moisture' | 'humidity' | 'temperature', value: number): string => {
    if (type === 'moisture') {
      if (value < 30) return 'low';
      if (value < 60) return 'medium';
      return 'good';
    }
    if (type === 'humidity') {
      if (value < 20 || value > 90) return 'low';
      if (value < 40 || value > 75) return 'medium';
      return 'good';
    }
    if (type === 'temperature') {
      if (value < 10 || value > 38) return 'low';
      if (value < 18 || value > 32) return 'medium';
      return 'good';
    }
    return 'medium';
  };

  const getBarFillPercent = (type: 'moisture' | 'humidity' | 'temperature', value: number): number => {
    if (type === 'moisture' || type === 'humidity') return Math.min(100, Math.max(0, value));
    return Math.min(100, Math.max(0, (value / 50) * 100));
  };

  const completeTask = (taskId: string): void => {
    setTasks(tasks.map(task => task.id === taskId ? { ...task, completed: true } : task));
    alert(language === 'sw' ? 'Kazi imekamilika!' : 'Task completed!');
  };

  const handleLanguageChange = (lang: 'sw' | 'en'): void => {
    setLanguage(lang);
  };

  if (loading) {
    return (
      <div className="farmer-dashboard" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <div>{language === 'sw' ? 'Inapakia...' : 'Loading...'}</div>
      </div>
    );
  }

  return (
    <div className="farmer-dashboard">
      <header className="kenya-flag-header">
        <div>
          <h1>Kenya Farms AI</h1>
          <p style={{ fontSize: '14px', opacity: 0.9 }}>
            {language === 'sw' ? `Karibu, ${user?.name || farmer.name}` : `Welcome, ${user?.name || farmer.name}`}
          </p>
        </div>
        <div className="header-actions">
          <LanguageSelector language={language} onLanguageChange={handleLanguageChange} />
          <button
            onClick={() => { logout(); navigate('/login'); }}
            style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', padding: '8px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' }}
          >
            {language === 'sw' ? 'Toka' : 'Logout'}
          </button>
        </div>
      </header>

      <div className="weather-widget">
        <div>
          <span className="weather-location">{weather.location}</span>
          <div className="weather-temp">{weather.temp}°C</div>
        </div>
        <div className="weather-icon">☀️</div>
        <div style={{ textAlign: 'right' }}>
          <div>{weather.condition}</div>
          <div style={{ fontSize: '12px', color: '#64748b' }}>{language === 'sw' ? 'Upepo: 12km/h' : 'Wind: 12km/h'}</div>
        </div>
      </div>

      <div className="sensor-indicators-card">
        <h3 style={{ marginBottom: '16px' }}>{language === 'sw' ? 'Vipima Vya Shamba' : 'Farm Sensor Readings'}</h3>
        <div className="sensor-indicators-grid">
          {(['moisture', 'humidity', 'temperature'] as const).map((key) => {
            const r = sensorReadings[key];
            const label = currentLang[key];
            const value = r?.value ?? (key === 'moisture' ? 45 : key === 'humidity' ? 62 : 27);
            const unit = r?.unit ?? (key === 'temperature' ? '°C' : '%');
            const status = getBarStatus(key, value);
            const fillPct = getBarFillPercent(key, value);
            return (
              <div key={key} className="sensor-indicator-bar">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span className="sensor-indicator-label">{label}</span>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>{formatLastReading(r?.lastReadingAt ?? null)}</span>
                </div>
                <div className="sensor-indicator-value">
                  <span className={`moisture-indicator moisture-${status}`}></span>
                  {value}{unit}
                </div>
                <div className="moisture-bar">
                  <div className={`moisture-fill ${status}`} style={{ width: `${fillPct}%` }}></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ margin: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3>{currentLang.todayTasks}</h3>
          <span style={{ background: '#dbeafe', padding: '4px 12px', borderRadius: '20px', fontSize: '12px' }}>
            {tasks.filter(task => !task.completed).length} {currentLang.tasks}
          </span>
        </div>
        {tasks.filter(task => !task.completed).map(task => (
          <div key={task.id} className="task-card">
            <div>
              <div className="task-crop">{language === 'sw' ? task.cropSwahili : task.crop}</div>
              <div className="task-details">• {task.amount}mm {language === 'sw' ? 'maji' : 'water'} • {task.time}</div>
              <div className="task-amount">{task.field}</div>
            </div>
            <button className="complete-button" onClick={() => completeTask(task.id)}>✓</button>
          </div>
        ))}
        {tasks.filter(task => !task.completed).length === 0 && (
          <div style={{ textAlign: 'center', padding: '24px', color: '#64748b' }}>
            ✨ {language === 'sw' ? 'Hakuna kazi leo!' : 'No tasks today!'}
          </div>
        )}
      </div>

      <div style={{ margin: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3>{currentLang.myCrops}</h3>
          <span style={{ background: '#dcfce7', padding: '4px 12px', borderRadius: '20px', fontSize: '12px' }}>{crops.length} {currentLang.active}</span>
        </div>
        {crops.map(crop => (
          <div key={crop.id} className="crop-card">
            <div className="crop-header">
              <span className="crop-name">{language === 'sw' ? crop.swahili : crop.name}</span>
              <span className="crop-badge">{crop.status}</span>
            </div>
            <div className="crop-details">
              <div>📅 {currentLang.planted}: {new Date(crop.planted).toLocaleDateString()}</div>
              <div>📍 {currentLang.area}: {crop.area} {language === 'sw' ? 'eka' : 'acres'}</div>
              <div>🌾 {currentLang.harvest}: {new Date(crop.harvest).toLocaleDateString()}</div>
              <div>⏳ {crop.daysLeft} {currentLang.daysLeft}</div>
            </div>
            <div className="crop-progress">
              <div className="progress-fill" style={{ width: `${(crop.completedTasks / crop.totalTasks) * 100}%` }}></div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
              <span style={{ fontSize: '12px', color: '#64748b' }}>{crop.completedTasks}/{crop.totalTasks} {language === 'sw' ? 'kumwagilia' : 'waterings'}</span>
              <button type="button" style={{ color: '#3b82f6', border: 'none', background: 'none', cursor: 'pointer' }} onClick={() => navigate('/crops')}>{currentLang.viewDetails} →</button>
            </div>
          </div>
        ))}
        <button type="button" className="quick-action-btn" style={{ margin: '8px 0' }} onClick={() => navigate('/crops')}>
          <i className="fas fa-plus-circle"></i>
          <span>{currentLang.addCrop}</span>
        </button>
      </div>

      <div className="chart-container">
        <h3 style={{ marginBottom: '12px' }}>{currentLang.history}</h3>
        <div style={{ height: '140px', display: 'flex', alignItems: 'flex-end', gap: '4px' }}>
          {moistureHistory.slice(-14).map((value, i) => (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ height: `${value * 1.5}px`, width: '100%', background: value < 30 ? '#dc2626' : value < 60 ? '#f59e0b' : '#10b981', borderRadius: '2px 2px 0 0' }}></div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: '8px', fontSize: '10px', color: '#64748b' }}>
          <span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span><span>S</span>
        </div>
      </div>

      <div style={{ margin: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
          <h3>⚠️ {currentLang.alerts}</h3>
          <span style={{ background: '#fee2e2', padding: '4px 12px', borderRadius: '20px', fontSize: '12px' }}>{alerts.length} {currentLang.new}</span>
        </div>
        {alerts.map(alert => (
          <div key={alert.id} className={`alert-card alert-${alert.severity}`}>
            <span className="alert-icon">{alert.severity === 'high' ? '🔴' : alert.severity === 'medium' ? '🟡' : '🔵'}</span>
            <span className="alert-message">{alert.message}</span>
            <span style={{ fontSize: '10px', color: '#64748b' }}>{alert.time}</span>
          </div>
        ))}
      </div>

      <div className="quick-actions">
        <button type="button" className="quick-action-btn" onClick={() => navigate('/crops')}><i className="fas fa-seedling"></i><span>{currentLang.myCrops}</span></button>
        <button type="button" className="quick-action-btn" onClick={() => navigate('/sensors')}><i className="fas fa-tower-broadcast"></i><span>{language === 'sw' ? 'Vipima' : 'Sensors'}</span></button>
        <button type="button" className="quick-action-btn" onClick={() => navigate('/robots')}><i className="fas fa-robot"></i><span>{language === 'sw' ? 'Roboti' : 'Robots'}</span></button>
        <button type="button" className="quick-action-btn"><i className="fas fa-tint"></i><span>{currentLang.waterToday}</span></button>
        <button type="button" className="quick-action-btn" onClick={() => navigate('/crops')}><i className="fas fa-plus-circle"></i><span>{currentLang.addCrop}</span></button>
        <button type="button" className="quick-action-btn"><i className="fas fa-phone"></i><span>{currentLang.callSupport}</span></button>
        <button className="quick-action-btn"><i className="fas fa-question-circle"></i><span>{currentLang.help}</span></button>
      </div>

      <nav className="bottom-nav">
        <div className="nav-item active"><i className="fas fa-home"></i><span>{currentLang.home}</span></div>
        <div className="nav-item" onClick={() => navigate('/sensors')}><i className="fas fa-tower-broadcast"></i><span>{language === 'sw' ? 'Vipima' : 'Sensors'}</span></div>
        <div className="nav-item" onClick={() => navigate('/robots')}><i className="fas fa-robot"></i><span>{language === 'sw' ? 'Roboti' : 'Robots'}</span></div>
        <div className="nav-item" onClick={() => navigate('/crops')}><i className="fas fa-seedling"></i><span>{currentLang.crops}</span></div>
        <div className="nav-item"><i className="fas fa-tint"></i><span>{currentLang.water}</span></div>
        <div className="nav-item"><i className="fas fa-chart-line"></i><span>{currentLang.stats}</span></div>
        <div className="nav-item" onClick={() => navigate('/profile')}><i className="fas fa-user"></i><span>{currentLang.profile}</span></div>
      </nav>
    </div>
  );
};

export default Dashboard;
