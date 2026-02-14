import React from 'react';
import './LanguageSelector.css';

type Language = 'sw' | 'en';

interface LanguageSelectorProps {
  language: Language;
  onLanguageChange: (lang: Language) => void;
}

const LanguageSelector: React.FC<LanguageSelectorProps> = ({ language, onLanguageChange }) => {
  return (
    <div className="language-selector">
      <label htmlFor="lang-select" className="language-label">
        <i className="fas fa-globe"></i>
      </label>
      <select
        id="lang-select"
        className="language-select"
        value={language}
        onChange={(e) => onLanguageChange(e.target.value as Language)}
        aria-label="Select language"
      >
        <option value="sw">Kiswahili</option>
        <option value="en">English</option>
      </select>
    </div>
  );
};

export default LanguageSelector;
