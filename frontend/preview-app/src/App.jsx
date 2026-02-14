/**
 * EXACT PREVIEW
 * Code + Styling + Data + Logic → Exact Preview
 *
 * Edit src/data.js, logic.js, components/*.jsx, *.css
 * Changes reflect instantly (Vite HMR)
 */
import React, { useState } from 'react';
import FarmerPreview from './components/FarmerPreview';
import AdminPreview from './components/AdminPreview';
import './App.css';

export default function App() {
  const [view, setView] = useState('farmer');

  return (
    <div className="preview-app">
      <header className="app-header">
        <h1>🇰🇪 Exact Preview</h1>
        <p>Code + Styling + Data + Logic → Exact Preview</p>
        <nav>
          <button className={view === 'farmer' ? 'active' : ''} onClick={() => setView('farmer')}>
            Farmer
          </button>
          <button className={view === 'admin' ? 'active' : ''} onClick={() => setView('admin')}>
            Admin
          </button>
        </nav>
      </header>
      <main className="preview-main">
        {view === 'farmer' && <FarmerPreview />}
        {view === 'admin' && <AdminPreview />}
      </main>
    </div>
  );
}
