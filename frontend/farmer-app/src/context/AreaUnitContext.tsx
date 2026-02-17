import React, { createContext, useContext, useState, useCallback } from 'react';
import type { AreaUnit } from '../utils/areaUtils';

const STORAGE_KEY = 'kenya_farm_area_unit';

interface AreaUnitContextType {
  areaUnit: AreaUnit;
  setAreaUnit: (u: AreaUnit) => void;
}

const AreaUnitContext = createContext<AreaUnitContextType | null>(null);

export const AreaUnitProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [areaUnit, setAreaUnitState] = useState<AreaUnit>(() => {
    try {
      const s = localStorage.getItem(STORAGE_KEY);
      return (s === 'ac' || s === 'ha') ? s : 'ha';
    } catch { return 'ha'; }
  });

  const setAreaUnit = useCallback((u: AreaUnit) => {
    setAreaUnitState(u);
    try { localStorage.setItem(STORAGE_KEY, u); } catch {}
  }, []);

  return (
    <AreaUnitContext.Provider value={{ areaUnit, setAreaUnit }}>
      {children}
    </AreaUnitContext.Provider>
  );
};

export const useAreaUnit = (): AreaUnitContextType => {
  const ctx = useContext(AreaUnitContext);
  if (!ctx) throw new Error('useAreaUnit must be used within AreaUnitProvider');
  return ctx;
};
