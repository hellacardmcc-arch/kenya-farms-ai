import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { AreaUnitProvider } from './context/AreaUnitContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './components/Login';
import Register from './components/Register';
import AdminDashboard from './components/AdminDashboard';
import FarmersView from './components/FarmersView';
import FarmsView from './components/FarmsView';
import CropsView from './components/CropsView';
import AnalyticsView from './components/AnalyticsView';
import SensorsView from './components/SensorsView';
import RobotsView from './components/RobotsView';
import SettingsView from './components/SettingsView';
import AdminUsersView from './components/AdminUsersView';
import './App.css';

function App(): JSX.Element {
  return (
    <AuthProvider>
      <AreaUnitProvider>
      <BrowserRouter>
        <div className="App">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/" element={<ProtectedRoute requiredRole="admin"><AdminDashboard /></ProtectedRoute>} />
            <Route path="/profile" element={<Navigate to="/settings?tab=profile" replace />} />
            <Route path="/farmers" element={<ProtectedRoute requiredRole="admin"><FarmersView /></ProtectedRoute>} />
            <Route path="/farms" element={<ProtectedRoute requiredRole="admin"><FarmsView /></ProtectedRoute>} />
            <Route path="/crops" element={<ProtectedRoute requiredRole="admin"><CropsView /></ProtectedRoute>} />
            <Route path="/analytics" element={<ProtectedRoute requiredRole="admin"><AnalyticsView /></ProtectedRoute>} />
            <Route path="/sensors" element={<ProtectedRoute requiredRole="admin"><SensorsView /></ProtectedRoute>} />
            <Route path="/robots" element={<ProtectedRoute requiredRole="admin"><RobotsView /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute requiredRole="admin"><SettingsView /></ProtectedRoute>} />
            <Route path="/users" element={<ProtectedRoute requiredRole="admin"><AdminUsersView /></ProtectedRoute>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </BrowserRouter>
      </AreaUnitProvider>
    </AuthProvider>
  );
}

export default App;
