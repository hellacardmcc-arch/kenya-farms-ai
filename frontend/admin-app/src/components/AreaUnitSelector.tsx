import React from 'react';
import { useAreaUnit } from '../context/AreaUnitContext';

export const AreaUnitSelector: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { areaUnit, setAreaUnit } = useAreaUnit();
  return (
    <div className={`area-unit-selector ${className}`}>
      <span className="area-unit-label">Land size:</span>
      <select
        value={areaUnit}
        onChange={(e) => setAreaUnit(e.target.value as 'ha' | 'ac')}
        aria-label="Area unit"
      >
        <option value="ha">hectares</option>
        <option value="ac">acres</option>
      </select>
    </div>
  );
};
