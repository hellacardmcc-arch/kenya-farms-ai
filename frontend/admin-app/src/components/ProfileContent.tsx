import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getMe, updateProfile, changePassword } from '../api/authApi';
import './ProfileView.css';

/** Profile form content - used inside Settings page */
const ProfileContent: React.FC = () => {
  const { user, token, updateUser } = useAuth();
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
      setMessage({ type: 'success', text: 'Profile updated!' });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed';
      setMessage({ type: 'error', text: msg });
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match' });
      return;
    }
    if (newPassword.length < 6) {
      setMessage({ type: 'error', text: 'Password must be at least 6 characters' });
      return;
    }
    setChangingPassword(true);
    setMessage(null);
    try {
      await changePassword(token, currentPassword, newPassword);
      setMessage({ type: 'success', text: 'Password changed!' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordForm(false);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed';
      setMessage({ type: 'error', text: msg });
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <div className="admin-profile-view">
      <div className="admin-profile-content">
        {loading ? (
          <div className="profile-loading">Loading...</div>
        ) : (
          <>
            {message && (
              <div className={`profile-message profile-message-${message.type}`}>
                {message.text}
              </div>
            )}

            <form onSubmit={handleSaveProfile} className="profile-form">
              <h3>Account Details</h3>
              <div className="profile-field">
                <label htmlFor="admin-profile-name">Name</label>
                <input
                  id="admin-profile-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  aria-label="Name"
                />
              </div>
              <div className="profile-field">
                <label htmlFor="admin-profile-email">Email</label>
                <input id="admin-profile-email" type="email" value={user?.email || ''} disabled className="profile-input-disabled" aria-label="Email" />
              </div>
              <div className="profile-field">
                <label htmlFor="admin-profile-phone">Phone</label>
                <input
                  id="admin-profile-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Phone number"
                  aria-label="Phone"
                />
              </div>
              <button type="submit" className="profile-save-btn" disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </form>

            <div className="profile-password-section">
              <button
                type="button"
                className="profile-password-toggle"
                onClick={() => setShowPasswordForm(!showPasswordForm)}
              >
                Change Password
              </button>
              {showPasswordForm && (
                <form onSubmit={handleChangePassword} className="profile-form profile-password-form">
                  <h3>Change Password</h3>
                  <div className="profile-field">
                    <label htmlFor="admin-current-password">Current Password</label>
                    <input
                      id="admin-current-password"
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                      aria-label="Current Password"
                    />
                  </div>
                  <div className="profile-field">
                    <label htmlFor="admin-new-password">New Password</label>
                    <input
                      id="admin-new-password"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      minLength={6}
                      autoComplete="new-password"
                      aria-label="New Password"
                    />
                  </div>
                  <div className="profile-field">
                    <label htmlFor="admin-confirm-password">Confirm New Password</label>
                    <input
                      id="admin-confirm-password"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      autoComplete="new-password"
                      aria-label="Confirm New Password"
                    />
                  </div>
                  <div className="profile-password-actions">
                    <button type="submit" className="profile-save-btn" disabled={changingPassword}>
                      {changingPassword ? 'Changing...' : 'Change Password'}
                    </button>
                    <button
                      type="button"
                      className="profile-cancel-btn"
                      onClick={() => { setShowPasswordForm(false); setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); }}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ProfileContent;
