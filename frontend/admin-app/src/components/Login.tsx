import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Auth.css';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login, loading } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }
    try {
      await login(email, password);
      navigate('/');
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err) && err.response?.data?.error ? err.response.data.error : 'Login failed. Use admin@... for admin access.';
      setError(msg);
    }
  };

  return (
    <div className="auth-page auth-page-admin">
      <div className="auth-card">
        <div className="auth-header">
          <h1>🇰🇪 Kenya Farms AI Admin</h1>
          <p>Admin Login</p>
        </div>
        <form onSubmit={handleSubmit} className="auth-form">
          {error && <div className="auth-error">{error}</div>}
          <input
            type="email"
            placeholder="Email (use admin@... for admin)"
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
            autoComplete="current-password"
          />
          <button type="submit" className="auth-button" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
        <p className="auth-switch">
          Need admin access? <Link to="/register">Register as Admin</Link>
        </p>
      </div>
    </div>
  );
};

export default Login;
