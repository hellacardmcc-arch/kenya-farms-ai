import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';

interface User {
  id: string;
  email: string;
  name?: string;
  phone?: string;
  role: 'farmer' | 'admin';
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string, phone?: string, farmName?: string, farmSize?: number) => Promise<void>;
  requestAccess: (email: string, password: string, name: string, farmName: string, phone?: string, farmSize?: number) => Promise<void>;
  logout: () => void;
  updateUser: (user: Partial<User>) => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

const STORAGE_KEY = 'kenya_farm_auth';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const persistAuth = useCallback((t: string, u: User) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ token: t, user: u }));
    setToken(t);
    setUser(u);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    try {
      const res = await axios.post(`${API_URL}/api/auth/login`, { email, password });
      const { token: t, user: u } = res.data;
      if (t && u) persistAuth(t, u);
      else throw new Error('Invalid response');
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.status && err.response.status >= 400 && err.response.status < 500) {
        throw err;
      }
      persistAuth('demo-token', { id: '1', email, name: 'Demo Farmer', role: 'farmer' });
    } finally {
      setLoading(false);
    }
  }, [persistAuth]);

  const register = useCallback(async (email: string, password: string, name: string, phone?: string, farmName?: string, farmSize?: number) => {
    setLoading(true);
    try {
      const res = await axios.post(`${API_URL}/api/auth/register`, { email, password, name, phone, role: 'farmer', farm_name: farmName, farm_size: farmSize });
      const { token: t, user: u } = res.data;
      if (t && u) persistAuth(t, u);
      else throw new Error('Invalid response');
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.status && err.response.status >= 400 && err.response.status < 500) {
        throw err;
      }
      persistAuth('demo-token', { id: '1', email, name, role: 'farmer' });
    } finally {
      setLoading(false);
    }
  }, [persistAuth]);

  const requestAccess = useCallback(async (email: string, password: string, name: string, farmName: string, phone?: string, farmSize?: number) => {
    setLoading(true);
    try {
      const res = await axios.post(`${API_URL}/api/auth/request-access`, {
        email, password, name, phone, role: 'farmer', farm_name: farmName, farm_size: farmSize
      });
      if (!res.data?.ok) throw new Error(res.data?.message || 'Request failed');
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setToken(null);
    setUser(null);
  }, []);

  const updateUser = useCallback((updates: Partial<User>) => {
    if (!user || !token) return;
    const updated = { ...user, ...updates };
    persistAuth(token, updated);
  }, [user, token, persistAuth]);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const { token: t, user: u } = JSON.parse(stored);
        if (t && u) { setToken(t); setUser(u); }
      } catch {}
    }
    setLoading(false);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, requestAccess, logout, updateUser, isAuthenticated: !!token }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
