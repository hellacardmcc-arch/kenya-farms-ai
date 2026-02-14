import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';

export interface Sensor {
  id: string;
  name: string;
  type: string;
  value: number;
  unit: string;
  status: string;
  last_reading_at: string;
}

export interface Robot {
  id: string;
  name: string;
  type: string;
  status: string;
  battery: number;
  last_active: string;
}

export async function getSensors(token: string): Promise<Sensor[]> {
  const res = await axios.get<{ sensors: Sensor[] }>(`${API_URL}/api/system/sensors`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data.sensors;
}

export async function getRobots(token: string): Promise<Robot[]> {
  const res = await axios.get<{ robots: Robot[] }>(`${API_URL}/api/system/robots`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data.robots;
}

export async function controlIrrigation(token: string, action: 'start' | 'stop', farmId?: string): Promise<void> {
  await axios.post(`${API_URL}/api/system/control/irrigation`, { action, farm_id: farmId }, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function controlRobot(token: string, robotId: string, action: 'start' | 'stop' | 'pause'): Promise<void> {
  await axios.post(`${API_URL}/api/system/robots/${robotId}/command`, { action }, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export interface AvailableSensor {
  id: string;
  device_id?: string;
  name: string;
  type?: string;
  unit?: string;
  registration_status?: string;
}

export interface AvailableRobot {
  id: string;
  device_id?: string;
  name: string;
  type?: string;
  registration_status?: string;
}

export async function getAvailableSensors(token: string): Promise<AvailableSensor[]> {
  const res = await axios.get<{ sensors: AvailableSensor[] }>(`${API_URL}/api/system/available-sensors`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data.sensors;
}

export async function getAvailableRobots(token: string): Promise<AvailableRobot[]> {
  const res = await axios.get<{ robots: AvailableRobot[] }>(`${API_URL}/api/system/available-robots`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data.robots;
}

export async function activateSensor(token: string, sensorId: string, farmId: string): Promise<void> {
  await axios.post(`${API_URL}/api/system/sensors/${sensorId}/activate`, { farm_id: farmId }, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function activateRobot(token: string, robotId: string): Promise<void> {
  await axios.post(`${API_URL}/api/system/robots/${robotId}/activate`, {}, {
    headers: { Authorization: `Bearer ${token}` },
  });
}
