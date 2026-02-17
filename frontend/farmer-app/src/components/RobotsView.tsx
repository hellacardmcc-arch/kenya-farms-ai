import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { getRobots, getAvailableRobots, activateRobot, controlRobot, type Robot } from '../api/systemApi';
import LanguageSelector from './LanguageSelector';
import FarmSelectorBar from './FarmSelectorBar';
import './RobotsView.css';

const RobotsView: React.FC = () => {
  const { token, logout } = useAuth();
  const navigate = useNavigate();
  const { language, setLanguage } = useLanguage();
  const [robots, setRobots] = useState<Robot[]>([]);
  const [availableRobots, setAvailableRobots] = useState<{ id: string; name: string; type?: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState<string | null>(null);

  const load = () => {
    if (!token) return;
    Promise.all([getRobots(token), getAvailableRobots(token)])
      .then(([r, a]) => { setRobots(r); setAvailableRobots(a); })
      .catch(() => { setRobots([]); setAvailableRobots([]); })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [token]);

  const handleActivateRobot = async (robotId: string) => {
    if (!token) return;
    setActivating(robotId);
    try {
      await activateRobot(token, robotId);
      alert(language === 'sw' ? 'Roboti imeunganishwa!' : 'Robot activated and paired!');
      load();
    } catch {
      alert(language === 'sw' ? 'Imeshindwa' : 'Failed');
    } finally {
      setActivating(null);
    }
  };

  const handleRobotCommand = async (robotId: string, action: 'start' | 'stop' | 'pause') => {
    if (!token) return;
    try {
      await controlRobot(token, robotId, action);
      alert(language === 'sw' ? `Amri imetumwa: ${action}` : `Command sent: ${action}`);
    } catch {
      alert(language === 'sw' ? 'Imeshindwa' : 'Failed');
    }
  };

  const [showAddSection, setShowAddSection] = useState(false);

  const t = {
    en: {
      title: 'Robots',
      subtitle: 'Farm automation & irrigation bots',
      addDevice: 'Add Robot',
      myRobots: 'My Robots',
      activateTitle: 'Activate New Robot',
      activateDesc: 'Pair a registered robot to your account. Click Activate to add it to your devices.',
      activate: 'Activate',
      noAvailable: 'No robots available to activate. Contact admin to register new robots.',
      status: 'Status',
      battery: 'Battery',
      lastActive: 'Last active',
      online: 'Online',
      idle: 'Idle',
      watering: 'Watering',
      back: 'Back',
      home: 'Home',
      sensors: 'Sensors'
    },
    sw: {
      title: 'Roboti',
      subtitle: 'Otomatiki na roboti wa umwagiliaji',
      addDevice: 'Ongeza Roboti',
      myRobots: 'Roboti Zangu',
      activateTitle: 'Unganisha Roboti Mpya',
      activateDesc: 'Unganisha roboti iliyosajiliwa na akaunti yako. Bofya Unganisha kuongeza kwenye vifaa vyako.',
      activate: 'Unganisha',
      noAvailable: 'Hakuna roboti zinazoweza kuunganishwa. Wasiliana na msimamizi kusajili roboti mpya.',
      status: 'Hali',
      battery: 'Betri',
      lastActive: 'Ilitumika mwisho',
      online: 'Inatumika',
      idle: 'Inapumzika',
      watering: 'Inamwagilia',
      back: 'Rudi',
      home: 'Nyumbani',
      sensors: 'Vipima'
    }
  };

  const currentLang = t[language];
  const displayRobots = robots.length ? robots : [
    { id: '1', name: 'Irrigation Bot A', type: 'irrigation', status: 'watering', battery: 85, last_active: new Date().toISOString() },
    { id: '2', name: 'Irrigation Bot B', type: 'irrigation', status: 'idle', battery: 92, last_active: new Date().toISOString() },
    { id: '3', name: 'Soil Scout', type: 'scout', status: 'online', battery: 78, last_active: new Date().toISOString() },
    { id: '4', name: 'Pest Scout', type: 'pest_scout', status: 'online', battery: 88, last_active: new Date().toISOString() },
    { id: '5', name: 'Weeds Scout', type: 'weeds_scout', status: 'idle', battery: 91, last_active: new Date().toISOString() }
  ];

  return (
    <div className="robots-view farmer-dashboard">
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

      <FarmSelectorBar />

      <div className="robots-content">
        <button onClick={() => navigate('/')} className="back-btn">
          ← {currentLang.back}
        </button>
        <h2 className="robots-title">{currentLang.subtitle}</h2>

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
              {availableRobots.length === 0 ? (
                <p className="activate-no-farm">{currentLang.noAvailable}</p>
              ) : (
                <div className="activate-list">
                  {availableRobots.map((r) => (
                    <div key={r.id} className="activate-item">
                      <span>🤖 {r.name}{r.type ? ` (${r.type})` : ''}</span>
                      <button className="control-btn start" onClick={() => handleActivateRobot(r.id)} disabled={activating === r.id}>
                        {activating === r.id ? '...' : currentLang.activate}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <h3 className="my-devices-title">{currentLang.myRobots}</h3>
        {loading ? <div className="robots-loading">{language === 'sw' ? 'Inapakia...' : 'Loading...'}</div> : (
        <div className="robots-grid">
          {displayRobots.map(robot => (
            <div key={robot.id} className="robot-card">
              <span className="robot-icon">{robot.type === 'pest_scout' ? '🐛' : robot.type === 'weeds_scout' ? '🌿' : robot.type === 'scout' ? '🔍' : '🤖'}</span>
              <h3>{robot.name}</h3>
              <div className="robot-meta">
                <span className="robot-status">{currentLang.status}: {robot.status === 'watering' ? currentLang.watering : robot.status === 'idle' ? currentLang.idle : currentLang.online}</span>
                <span className="robot-battery">{currentLang.battery}: {robot.battery}%</span>
                <span className="robot-active">{currentLang.lastActive}: {robot.last_active ? new Date(robot.last_active).toLocaleString() : '—'}</span>
              </div>
              <div className="robot-controls">
                <button onClick={() => handleRobotCommand(robot.id, 'start')} className="control-btn start">{language === 'sw' ? 'Anza' : 'Start'}</button>
                <button onClick={() => handleRobotCommand(robot.id, 'pause')} className="control-btn pause">{language === 'sw' ? 'Simama' : 'Pause'}</button>
                <button onClick={() => handleRobotCommand(robot.id, 'stop')} className="control-btn stop">{language === 'sw' ? 'Zima' : 'Stop'}</button>
              </div>
            </div>
          ))}
        </div>
        )}
      </div>

      <nav className="bottom-nav">
        <div className="nav-item" onClick={() => navigate('/')}><i className="fas fa-home"></i><span>{currentLang.home}</span></div>
        <div className="nav-item" onClick={() => navigate('/sensors')}><i className="fas fa-tower-broadcast"></i><span>{currentLang.sensors}</span></div>
        <div className="nav-item active"><i className="fas fa-robot"></i><span>{currentLang.title}</span></div>
      </nav>
    </div>
  );
};

export default RobotsView;
