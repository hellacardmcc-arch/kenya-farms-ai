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

export async function getFarmerDashboard(token: string): Promise<DashboardData> {
  const res = await axios.get<DashboardData>(`${API_URL}/api/farmers/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}
