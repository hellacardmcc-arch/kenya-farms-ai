import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useFarm } from '../context/FarmContext';
import { useLanguage } from '../context/LanguageContext';
import { useAreaUnit } from '../context/AreaUnitContext';
import { AreaDisplay } from './AreaDisplay';
import { toDisplayValue } from '../utils/areaUtils';
import './FarmSelectorBar.css';

const FarmSelectorBar: React.FC = () => {
  const navigate = useNavigate();
  const { farms, selectedFarm, setSelectedFarm, loading } = useFarm();
  const { language } = useLanguage();
  const { areaUnit } = useAreaUnit();

  const farmLabel = language === 'sw' ? 'Shamba' : 'Farm';
  const selectFarmLabel = language === 'sw' ? 'Chagua shamba' : 'Select farm';
  const noFarmsLabel = language === 'sw' ? 'Hakuna mashamba. Ongeza shamba kwanza.' : 'No farms. Add a farm first.';

  if (loading) {
    return (
      <div className="farm-selector-bar">
        <span className="farm-selector-loading">{language === 'sw' ? 'Inapakia...' : 'Loading...'}</span>
      </div>
    );
  }

  if (farms.length === 0) {
    return (
      <div className="farm-selector-bar farm-selector-empty">
        <span>{noFarmsLabel}</span>
      </div>
    );
  }

  if (farms.length === 1) {
    const farm = farms[0];
    return (
      <div className="farm-selector-bar">
        <span className="farm-selector-label">🌾 {farmLabel}:</span>
        <span className="farm-selector-value farm-selector-clickable" onClick={() => navigate('/farms')} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && navigate('/farms')}>
          {farm.name || farm.unique_code || farm.id}
          {farm.area_hectares != null && (
            <span className="farm-selector-size">
              {' '}(<AreaDisplay hectares={farm.area_hectares} />)
            </span>
          )}
        </span>
        <button type="button" className="farm-selector-manage" onClick={() => navigate('/farms')} aria-label={language === 'sw' ? 'Dhibiti mashamba' : 'Manage farms'}>
          ⚙️
        </button>
      </div>
    );
  }

  return (
    <div className="farm-selector-bar">
      <label htmlFor="farm-select-dropdown" className="farm-selector-label">🌾 {farmLabel}:</label>
      <select
        id="farm-select-dropdown"
        className="farm-selector-dropdown"
        value={selectedFarm?.id ?? ''}
        onChange={(e) => {
          const farm = farms.find((f) => f.id === e.target.value);
          setSelectedFarm(farm ?? null);
        }}
        aria-label={selectFarmLabel}
      >
        <option value="">{selectFarmLabel}</option>
        {farms.map((f) => {
          const areaVal = f.area_hectares != null ? toDisplayValue(f.area_hectares, areaUnit) : '';
          const areaSuffix = areaVal !== '' ? (areaUnit === 'ac' ? ' ac' : ' ha') : '';
          return (
            <option key={f.id} value={f.id}>
              {f.name || f.unique_code || f.id}
              {areaVal !== '' ? ` (${areaVal}${areaSuffix})` : ''}
            </option>
          );
        })}
      </select>
      {selectedFarm && (
        <span className="farm-selector-size-display">
          <AreaDisplay hectares={selectedFarm.area_hectares ?? 0} />
        </span>
      )}
      <button type="button" className="farm-selector-manage" onClick={() => navigate('/farms')} aria-label={language === 'sw' ? 'Dhibiti mashamba' : 'Manage farms'}>
        ⚙️
      </button>
    </div>
  );
};

export default FarmSelectorBar;
