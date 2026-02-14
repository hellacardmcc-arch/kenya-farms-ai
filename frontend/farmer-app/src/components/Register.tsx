import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Auth.css';

const Register: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [farmName, setFarmName] = useState('');
  const [farmSize, setFarmSize] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const { requestAccess, loading } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email || !password || !name || !farmName?.trim()) {
      setError('Please fill in required fields (name, email, password, farm name)');
      return;
    }
    try {
      await requestAccess(email, password, name, farmName.trim(), phone || undefined, farmSize ? parseFloat(farmSize) : undefined);
      setSuccess(true);
    } catch (err: unknown) {
      let msg = 'Request failed. Please try again.';
      if (err instanceof Error && err.message && err.message !== 'Request failed') {
        msg = err.message;
      } else if (axios.isAxiosError(err)) {
        const d = err.response?.data;
        const backendMsg = d && typeof d === 'object' ? ((d as { error?: string; message?: string }).error || (d as { error?: string; message?: string }).message) : null;
        if (backendMsg) msg = backendMsg;
        else if (err.code === 'ERR_NETWORK') msg = 'Cannot reach server. Start API Gateway (5001) and Auth service (5002), or check REACT_APP_API_URL.';
        else if (err.response?.status === 502 || err.response?.status === 503) msg = 'Backend unavailable. Ensure Auth service and PostgreSQL are running.';
        else if (err.response?.status === 400) msg = backendMsg || 'Invalid request. Check your input.';
        else if (err.response?.status === 409) msg = backendMsg || 'Email already registered or pending.';
      }
      setError(msg);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <h1>🇰🇪 Kenya Farms AI</h1>
          <p>Farmer Registration</p>
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
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="auth-input"
            autoComplete="email"
          />
          <input
            type="tel"
            placeholder="Phone (optional)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="auth-input"
          />
          <input
            type="text"
            placeholder="Farm Name *"
            value={farmName}
            onChange={(e) => setFarmName(e.target.value)}
            className="auth-input"
          />
          <input
            type="number"
            step="0.01"
            min="0"
            placeholder="Farm Size (hectares, optional)"
            value={farmSize}
            onChange={(e) => setFarmSize(e.target.value)}
            className="auth-input"
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
            {loading ? 'Submitting...' : success ? 'Submitted' : 'Request Farmer Access'}
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
