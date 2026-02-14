/** CODE - Farmer Dashboard component */
import React, { useState } from 'react';
import { farmerDevices } from '../data';
import { togglePump } from '../logic';
import './FarmerPreview.css';

export default function FarmerPreview() {
  const [devices, setDevices] = useState(farmerDevices);

  return (
    <div className="preview-panel farmer-preview">
      <header className="preview-header">
        <h1>Farm Dashboard</h1>
        <span className="subtitle">Kenya Farm IoT</span>
      </header>
      <main className="dashboard-grid">
        {devices.map((device) => (
          <div key={device.id} className="device-card">
            <h3>{device.name}</h3>
            <p className="device-value">{device.value}</p>
            {device.name === 'Irrigation Pump' ? (
              <button
                className={`toggle-btn ${device.value === 'ON' ? 'on' : 'off'}`}
                onClick={() => togglePump(devices, setDevices, device.id)}
              >
                {device.value}
              </button>
            ) : (
              <span className={`status-badge ${device.status}`}>{device.status}</span>
            )}
          </div>
        ))}
      </main>
    </div>
  );
}
