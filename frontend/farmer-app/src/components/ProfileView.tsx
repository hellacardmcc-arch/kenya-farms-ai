import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getMe, updateProfile, changePassword } from '../api/authApi';
import LanguageSelector from './LanguageSelector';
import './ProfileView.css';

const ProfileView: React.FC = () => {
  const { user, token, logout, updateUser } = useAuth();
  const navigate = useNavigate();
  const [language, setLanguage] = useState<'sw' | 'en'>('sw');
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState((user as { phone?: string })?.phone || '');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    if (!token) return;
    getMe(token)
      .then((me) => {
        setName(me.name || '');
        setPhone(me.phone || '');
        updateUser({ name: me.name, phone: me.phone });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token, updateUser]);

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setPhone((user as { phone?: string }).phone || '');
    }
  }, [user]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    setMessage(null);
    try {
      const updated = await updateProfile(token, { name: name.trim() || undefined, phone: phone.trim() || undefined });
      updateUser({ name: updated.name, phone: updated.phone });
      setMessage({ type: 'success', text: language === 'sw' ? 'Imesahihishwa!' : 'Profile updated!' });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || (language === 'sw' ? 'Imeshindwa' : 'Failed');
      setMessage({ type: 'error', text: msg });
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: language === 'sw' ? 'Nenosiri halilingani' : 'Passwords do not match' });
      return;
    }
    if (newPassword.length < 6) {
      setMessage({ type: 'error', text: language === 'sw' ? 'Nenosiri lazima liwe angalau herufi 6' : 'Password must be at least 6 characters' });
      return;
    }
    setChangingPassword(true);
    setMessage(null);
    try {
      await changePassword(token, currentPassword, newPassword);
      setMessage({ type: 'success', text: language === 'sw' ? 'Nenosiri limebadilishwa!' : 'Password changed!' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordForm(false);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || (language === 'sw' ? 'Imeshindwa' : 'Failed');
      setMessage({ type: 'error', text: msg });
    } finally {
      setChangingPassword(false);
    }
  };

  const t = {
    en: {
      title: 'Profile',
      subtitle: 'Update your account details',
      name: 'Name',
      email: 'Email',
      phone: 'Phone',
      save: 'Save',
      changePassword: 'Change Password',
      currentPassword: 'Current Password',
      newPassword: 'New Password',
      confirmPassword: 'Confirm New Password',
      cancel: 'Cancel',
      back: 'Back',
      home: 'Home',
      sensors: 'Sensors',
      robots: 'Robots',
      profile: 'Profile'
    },
    sw: {
      title: 'Wasifu',
      subtitle: 'Sasisha taarifa zako',
      name: 'Jina',
      email: 'Barua pepe',
      phone: 'Simu',
      save: 'Hifadhi',
      changePassword: 'Badilisha Nenosiri',
      currentPassword: 'Nenosiri la Sasa',
      newPassword: 'Nenosiri Jipya',
      confirmPassword: 'Thibitisha Nenosiri Jipya',
      cancel: 'Ghairi',
      back: 'Rudi',
      home: 'Nyumbani',
      sensors: 'Vipima',
      robots: 'Roboti',
      profile: 'Wasifu'
    }
  };

  const currentLang = t[language];

  return (
    <div className="profile-view farmer-dashboard">
      <header className="kenya-flag-header">
        <div>
          <h1>Kenya Farms AI</h1>
          <p className="profile-header-subtitle">{currentLang.title}</p>
        </div>
        <div className="header-actions">
          <LanguageSelector language={language} onLanguageChange={setLanguage} />
          <button onClick={() => { logout(); navigate('/login'); }} className="header-btn">
            {language === 'sw' ? 'Toka' : 'Logout'}
          </button>
        </div>
      </header>

      <div className="profile-content">
        <button onClick={() => navigate('/')} className="back-btn">
          ← {currentLang.back}
        </button>
        <h2 className="profile-title">{currentLang.subtitle}</h2>

        {loading ? (
          <div className="profile-loading">{language === 'sw' ? 'Inapakia...' : 'Loading...'}</div>
        ) : (
          <>
            {message && (
              <div className={`profile-message profile-message-${message.type}`}>
                {message.text}
              </div>
            )}

            <form onSubmit={handleSaveProfile} className="profile-form">
              <div className="profile-field">
                <label htmlFor="profile-name">{currentLang.name}</label>
                <input
                  id="profile-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={currentLang.name}
                  aria-label={currentLang.name}
                />
              </div>
              <div className="profile-field">
                <label htmlFor="profile-email">{currentLang.email}</label>
                <input id="profile-email" type="email" value={user?.email || ''} disabled className="profile-input-disabled" aria-label={currentLang.email} />
              </div>
              <div className="profile-field">
                <label htmlFor="profile-phone">{currentLang.phone}</label>
                <input
                  id="profile-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder={currentLang.phone}
                  aria-label={currentLang.phone}
                />
              </div>
              <button type="submit" className="profile-save-btn" disabled={saving}>
                {saving ? (language === 'sw' ? 'Inahifadhi...' : 'Saving...') : currentLang.save}
              </button>
            </form>

            <div className="profile-password-section">
              <button
                type="button"
                className="profile-password-toggle"
                onClick={() => setShowPasswordForm(!showPasswordForm)}
              >
                {currentLang.changePassword}
              </button>
              {showPasswordForm && (
                <form onSubmit={handleChangePassword} className="profile-form profile-password-form">
                  <div className="profile-field">
                    <label htmlFor="profile-current-password">{currentLang.currentPassword}</label>
                    <input
                      id="profile-current-password"
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                      aria-label={currentLang.currentPassword}
                    />
                  </div>
                  <div className="profile-field">
                    <label htmlFor="profile-new-password">{currentLang.newPassword}</label>
                    <input
                      id="profile-new-password"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      minLength={6}
                      autoComplete="new-password"
                      aria-label={currentLang.newPassword}
                    />
                  </div>
                  <div className="profile-field">
                    <label htmlFor="profile-confirm-password">{currentLang.confirmPassword}</label>
                    <input
                      id="profile-confirm-password"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      autoComplete="new-password"
                      aria-label={currentLang.confirmPassword}
                    />
                  </div>
                  <div className="profile-password-actions">
                    <button type="submit" className="profile-save-btn" disabled={changingPassword}>
                      {changingPassword ? (language === 'sw' ? 'Inabadilisha...' : 'Changing...') : currentLang.save}
                    </button>
                    <button
                      type="button"
                      className="profile-cancel-btn"
                      onClick={() => { setShowPasswordForm(false); setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); }}
                    >
                      {currentLang.cancel}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </>
        )}
      </div>

      <nav className="bottom-nav">
        <div className="nav-item" onClick={() => navigate('/')}><i className="fas fa-home"></i><span>{currentLang.home}</span></div>
        <div className="nav-item" onClick={() => navigate('/sensors')}><i className="fas fa-tower-broadcast"></i><span>{currentLang.sensors}</span></div>
        <div className="nav-item" onClick={() => navigate('/robots')}><i className="fas fa-robot"></i><span>{currentLang.robots}</span></div>
        <div className="nav-item active"><i className="fas fa-user"></i><span>{currentLang.profile}</span></div>
      </nav>
    </div>
  );
};

export default ProfileView;
