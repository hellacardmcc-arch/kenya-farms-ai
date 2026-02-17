import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';

/** Extract user-friendly error message from API or network errors */
export function getApiErrorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data;
    if (data && typeof data === 'object') {
      const msg = (data as { error?: string; message?: string }).error
        ?? (data as { error?: string; message?: string }).message;
      if (typeof msg === 'string' && msg.trim()) return msg;
    }
    if (err.response?.status === 401) return 'Session expired. Please log in again.';
    if (err.response?.status === 404) return 'Farmer profile not found. Ask admin to run create-missing-farmer.sql for your email, then log in again.';
    if (err.response?.status === 400) return (data as { error?: string })?.error || 'Invalid request.';
    if (err.code === 'ERR_NETWORK') return 'Cannot connect to server. Check API URL and that services are running.';
  }
  return fallback;
}

export interface FarmerProfile {
  id: string;
  name: string | null;
  phone: string | null;
  location: string | null;
}

export interface Farm {
  id: string;
  farmer_id: string;
  name: string | null;
  location: string | null;
  area_hectares: number | null;
  unique_code?: string | null;
  latitude?: number | null;
  longitude?: number | null;
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

export interface CreateFarmPayload {
  name: string;
  location?: string;
  area_hectares?: number;
  latitude?: number;
  longitude?: number;
  unique_code?: string;
}

export async function createFarm(token: string, payload: CreateFarmPayload): Promise<Farm> {
  const name = payload.name != null ? String(payload.name).trim() : '';
  if (!name) throw new Error('Farm name is required');

  const areaNum = payload.area_hectares != null && !Number.isNaN(Number(payload.area_hectares))
    ? Number(payload.area_hectares) : 0.5;
  const areaVal = areaNum >= 0 ? areaNum : 0.5;

  const body: Record<string, unknown> = {
    name,
    area_hectares: areaVal,
  };
  const loc = payload.location != null ? String(payload.location).trim() : '';
  if (loc) body.location = loc;

  const lat = payload.latitude != null ? Number(payload.latitude) : NaN;
  const lng = payload.longitude != null ? Number(payload.longitude) : NaN;
  if (!Number.isNaN(lat) && lat >= -90 && lat <= 90) body.latitude = lat;
  if (!Number.isNaN(lng) && lng >= -180 && lng <= 180) body.longitude = lng;

  if (payload.unique_code?.trim()) body.unique_code = payload.unique_code.trim();

  const res = await axios.post<Farm>(`${API_URL}/api/farmers/me/farms`, body, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  return res.data;
}

export interface UpdateFarmPayload {
  name?: string;
  location?: string;
  area_hectares?: number;
  latitude?: number;
  longitude?: number;
}

export async function updateFarm(token: string, farmId: string, payload: UpdateFarmPayload): Promise<Farm> {
  const res = await axios.put<Farm>(`${API_URL}/api/farmers/me/farms/${farmId}`, payload, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}

export async function deleteFarm(token: string, farmId: string): Promise<void> {
  await axios.delete(`${API_URL}/api/farmers/me/farms/${farmId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
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
