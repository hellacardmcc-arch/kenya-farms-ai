import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';

export interface UserProfile {
  id: string;
  email: string;
  name?: string;
  phone?: string;
  role: string;
}

export async function getMe(token: string): Promise<UserProfile> {
  const res = await axios.get<{ user: UserProfile }>(`${API_URL}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data.user;
}

export async function updateProfile(token: string, data: { name?: string; phone?: string }): Promise<UserProfile> {
  const res = await axios.put<{ ok: boolean; user: UserProfile }>(`${API_URL}/api/auth/profile`, data, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data.user!;
}

export async function requestAccess(data: {
  email: string;
  password: string;
  name: string;
  phone?: string;
  role: 'farmer';
  farm_name: string;
  farm_size?: number;
  message?: string;
}): Promise<{ ok: boolean; message?: string }> {
  const res = await axios.post<{ ok: boolean; message?: string }>(`${API_URL}/api/auth/request-access`, data);
  return res.data;
}

export async function changePassword(
  token: string,
  currentPassword: string,
  newPassword: string
): Promise<void> {
  await axios.put(
    `${API_URL}/api/auth/password`,
    { currentPassword, newPassword },
    { headers: { Authorization: `Bearer ${token}` } }
  );
}
