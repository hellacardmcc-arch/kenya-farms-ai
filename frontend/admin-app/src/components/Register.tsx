import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Auth.css';

const Register: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const { requestAccess, loading } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email || !password || !name) {
      setError('Please fill in all fields');
      return;
    }
    try {
      await requestAccess(email, password, name);
      setSuccess(true);
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err) && err.response?.data?.error ? err.response.data.error : 'Request failed. Please try again.';
      setError(msg);
    }
  };

  return (
    <div className="auth-page auth-page-admin">
      <div className="auth-card">
        <div className="auth-header">
          <h1>🇰🇪 Kenya Farms AI Admin</h1>
          <p>Admin Registration</p>
        </div>
        <form onSubmit={handleSubmit} className="auth-form">
          {success && (
            <div className="auth-success">
              Request submitted! You will receive an email once an admin approves it.
            </div>
          )}
          {error && <div className="auth-error">{error}</div>}
          <input
            type="text"
            placeholder="Full Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="auth-input"
            autoComplete="name"
          />
          <input
            type="email"
            placeholder="Email (use admin@... for admin role)"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="auth-input"
            autoComplete="email"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="auth-input"
            autoComplete="new-password"
          />
          <button type="submit" className="auth-button" disabled={loading || success}>
            {loading ? 'Submitting...' : success ? 'Submitted' : 'Request Admin Access'}
          </button>
        </form>
        <p className="auth-switch">
          Already have an account? <Link to="/login">Sign In</Link>
        </p>
      </div>
    </div>
  );
};

export default Register;
