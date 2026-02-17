import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { getFarmerDashboard, type Farm } from '../api/farmerApi';

export interface FarmContextType {
  farms: Farm[];
  selectedFarm: Farm | null;
  setSelectedFarm: (farm: Farm | null) => void;
  refreshFarms: (tokenOverride?: string) => Promise<void>;
  loading: boolean;
}

const FarmContext = createContext<FarmContextType | null>(null);

export function FarmProvider({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  const [farms, setFarms] = useState<Farm[]>([]);
  const [selectedFarm, setSelectedFarmState] = useState<Farm | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshFarms = useCallback(async (tokenOverride?: string) => {
    const t = tokenOverride ?? token;
    if (!t) {
      setFarms([]);
      setSelectedFarmState(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await getFarmerDashboard(t);
      const farmList = data.farms || [];
      setFarms(farmList);
      setSelectedFarmState((prev) => {
        if (farmList.length === 0) return null;
        if (prev && farmList.some((f) => f.id === prev.id)) return prev;
        return farmList[0];
      });
    } catch {
      setFarms([]);
      setSelectedFarmState(null);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    refreshFarms();
  }, [refreshFarms]);

  const setSelectedFarm = useCallback((farm: Farm | null) => {
    setSelectedFarmState(farm);
  }, []);

  return (
    <FarmContext.Provider value={{ farms, selectedFarm, setSelectedFarm, refreshFarms, loading }}>
      {children}
    </FarmContext.Provider>
  );
}

export function useFarm() {
  const ctx = useContext(FarmContext);
  if (!ctx) throw new Error('useFarm must be used within FarmProvider');
  return ctx;
}
