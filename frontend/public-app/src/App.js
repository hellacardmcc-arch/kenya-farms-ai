import React, { useState } from 'react';
import './App.css';
import ApiDocsModal from './ApiDocsModal';

function App() {
  const [showApiDocs, setShowApiDocs] = useState(false);

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
        <button type="button" className="cta" onClick={() => setShowApiDocs(true)}>
          View API Docs
        </button>
      </header>
      {showApiDocs && <ApiDocsModal onClose={() => setShowApiDocs(false)} />}
    </div>
  );
}

export default App;
