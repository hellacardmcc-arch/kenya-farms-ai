import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { AreaUnitProvider } from './context/AreaUnitContext';
import { LanguageProvider } from './context/LanguageContext';
import { FarmProvider } from './context/FarmContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './components/Login';
import Register from './components/Register';
import Dashboard from './components/Dashboard';
import SensorsView from './components/SensorsView';
import RobotsView from './components/RobotsView';
import ProfileView from './components/ProfileView';
import MyCropsView from './components/MyCropsView';
import FarmsView from './components/FarmsView';
import './App.css';

function App(): JSX.Element {
  return (
    <AuthProvider>
      <AreaUnitProvider>
      <LanguageProvider>
      <BrowserRouter>
        <div className="App">
          <FarmProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/" element={<ProtectedRoute requiredRole="farmer"><Dashboard /></ProtectedRoute>} />
            <Route path="/sensors" element={<ProtectedRoute requiredRole="farmer"><SensorsView /></ProtectedRoute>} />
            <Route path="/robots" element={<ProtectedRoute requiredRole="farmer"><RobotsView /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute requiredRole="farmer"><ProfileView /></ProtectedRoute>} />
            <Route path="/crops" element={<ProtectedRoute requiredRole="farmer"><MyCropsView /></ProtectedRoute>} />
            <Route path="/farms" element={<ProtectedRoute requiredRole="farmer"><FarmsView /></ProtectedRoute>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </FarmProvider>
        </div>
      </BrowserRouter>
      </LanguageProvider>
      </AreaUnitProvider>
    </AuthProvider>
  );
}

export default App;
