import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './components/Login';
import Register from './components/Register';
import Dashboard from './components/Dashboard';
import SensorsView from './components/SensorsView';
import RobotsView from './components/RobotsView';
import ProfileView from './components/ProfileView';
import MyCropsView from './components/MyCropsView';
import './App.css';

function App(): JSX.Element {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="App">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/" element={<ProtectedRoute requiredRole="farmer"><Dashboard /></ProtectedRoute>} />
            <Route path="/sensors" element={<ProtectedRoute requiredRole="farmer"><SensorsView /></ProtectedRoute>} />
            <Route path="/robots" element={<ProtectedRoute requiredRole="farmer"><RobotsView /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute requiredRole="farmer"><ProfileView /></ProtectedRoute>} />
            <Route path="/crops" element={<ProtectedRoute requiredRole="farmer"><MyCropsView /></ProtectedRoute>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
