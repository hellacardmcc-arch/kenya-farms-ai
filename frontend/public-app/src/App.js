import React from 'react';
import './App.css';

function App() {
  return (
    <div className="public-app">
      <header className="hero">
        <h1>🇰🇪 Kenya Farm IoT</h1>
        <p className="tagline">Empowering Kenyan Farmers with Smart Farming Technology</p>
        <div className="stats">
          <span>7 Microservices</span>
          <span>3 Databases</span>
          <span>3 Frontends</span>
          <span>50+ APIs</span>
        </div>
        <a href="/api/docs" className="cta">View API Docs</a>
      </header>
    </div>
  );
}

export default App;
