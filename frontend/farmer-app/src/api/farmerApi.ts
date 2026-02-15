import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';

export interface FarmerProfile {
  id: string;
  name: string | null;
  phone: string | null;
  region: string | null;
}

export interface Farm {
  id: string;
  farmer_id: string;
  name: string | null;
  location: string | null;
  area_hectares: number | null;
  created_at: string;
}

export interface Crop {
  id: string;
  farm_id: string;
  name: string;
  swahili_name: string | null;
  planted_date: string | null;
  harvest_date: string | null;
  area_hectares: number | null;
  status: string;
  expected_yield_kg?: number | null;
  actual_yield_kg?: number | null;
}

export interface YieldRecord {
  id: string;
  crop_id: string;
  farm_id: string;
  season_year: number;
  season_label: string | null;
  harvest_date: string | null;
  actual_yield_kg: number;
  unit: string;
  notes: string | null;
  crop_name: string;
  crop_swahili_name: string | null;
  farm_name: string | null;
}

export interface WateringTask {
  id: string;
  crop_id: string | null;
  farm_id: string;
  amount_mm: number | null;
  scheduled_time: string | null;
  completed: boolean;
}

export interface Alert {
  id: string;
  severity: string;
  message: string;
  time: string;
}

export interface DashboardData {
  farmer: FarmerProfile;
  farms: Farm[];
  crops: Crop[];
  tasks: WateringTask[];
  alerts: Alert[];
}

export async function createFarm(token: string, payload: { name: string; location?: string; area_hectares?: number }): Promise<Farm> {
  const res = await axios.post<Farm>(`${API_URL}/api/farmers/me/farms`, payload, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}

export async function getFarmerDashboard(token: string): Promise<DashboardData> {
  const res = await axios.get<DashboardData>(`${API_URL}/api/farmers/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}

export interface AddCropPayload {
  farm_id: string;
  name: string;
  swahili_name?: string;
  planted_date?: string;
  harvest_date?: string;
  area_hectares?: number;
  status?: string;
  expected_yield_kg?: number;
}

export async function addCrop(token: string, payload: AddCropPayload): Promise<Crop> {
  const res = await axios.post<Crop>(`${API_URL}/api/farmers/me/crops`, payload, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}

export async function deleteCrop(token: string, cropId: string): Promise<void> {
  await axios.delete(`${API_URL}/api/farmers/me/crops/${cropId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function updateCropExpectedYield(token: string, cropId: string, expected_yield_kg: number): Promise<void> {
  await axios.put(`${API_URL}/api/farmers/me/crops/${cropId}`, { expected_yield_kg }, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function getYieldRecords(token: string): Promise<YieldRecord[]> {
  const res = await axios.get<{ yields: YieldRecord[] }>(`${API_URL}/api/farmers/me/yields`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data.yields;
}

export interface AddYieldPayload {
  crop_id: string;
  farm_id: string;
  season_year?: number;
  season_label?: string;
  harvest_date?: string;
  actual_yield_kg: number;
  unit?: string;
  notes?: string;
}

export async function addYieldRecord(token: string, payload: AddYieldPayload): Promise<YieldRecord> {
  const res = await axios.post<YieldRecord>(`${API_URL}/api/farmers/me/yields`, payload, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}
