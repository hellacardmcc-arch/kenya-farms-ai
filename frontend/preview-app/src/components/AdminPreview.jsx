/** CODE - Admin Dashboard component */
import React from 'react';
import { adminFarms } from '../data';
import './AdminPreview.css';

export default function AdminPreview() {
  return (
    <div className="preview-panel admin-preview">
      <header className="preview-header">
        <h1>Admin Dashboard</h1>
        <span className="subtitle">Kenya Farm IoT - System Overview</span>
      </header>
      <main className="admin-content">
        <h2>Farms</h2>
        <div className="farms-grid">
          {adminFarms.map((farm) => (
            <div key={farm.id} className="farm-card">
              <h3>{farm.name}</h3>
              <p className="device-count">{farm.devices} devices</p>
              <span className={`status-badge ${farm.status}`}>{farm.status}</span>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
