import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';

function headers(token: string) {
  return { headers: { Authorization: `Bearer ${token}` } };
}

// Farmers - farmer_id binds to farms.farmer_id (one farmer, many farms)
export interface FarmerFarm {
  id: string;
  name?: string;
  location?: string;
  area_hectares?: number;
  unique_code?: string;
  latitude?: number;
  longitude?: number;
  created_at?: string;
}

export interface Farmer {
  id: string;
  name?: string;
  phone?: string;
  location?: string;
  email?: string;
  user_id?: string;
  role?: string;
  created_at?: string;
  deleted_at?: string;
  farms_count?: number;
  farms?: FarmerFarm[];
}

export async function getFarmers(token: string, includeDeleted = false, withFarms = false): Promise<Farmer[]> {
  const params = new URLSearchParams();
  if (includeDeleted) params.set('deleted', 'true');
  if (withFarms) params.set('farms', 'true');
  const qs = params.toString();
  const res = await axios.get<{ farmers: Farmer[] }>(
    `${API_URL}/api/admin/farmers${qs ? '?' + qs : ''}`,
    headers(token)
  );
  return res.data.farmers;
}

export async function getFarmer(token: string, id: string): Promise<Farmer> {
  const res = await axios.get<Farmer>(`${API_URL}/api/admin/farmers/${id}`, headers(token));
  return res.data;
}

export async function registerFarmer(
  token: string,
  data: { email: string; password: string; name?: string; phone?: string; location?: string; farm_name: string; farm_size?: number | string; farm_location?: string; farm_latitude?: number; farm_longitude?: number }
): Promise<{ user: unknown; farmer: Farmer }> {
  const res = await axios.post(`${API_URL}/api/admin/farmers/register`, data, headers(token));
  return res.data;
}

export async function updateFarmer(
  token: string,
  id: string,
  data: { name?: string; phone?: string; location?: string }
): Promise<void> {
  await axios.put(`${API_URL}/api/admin/farmers/${id}`, data, headers(token));
}

export async function deleteFarmer(token: string, id: string): Promise<void> {
  await axios.delete(`${API_URL}/api/admin/farmers/${id}`, headers(token));
}

export async function restoreFarmer(token: string, id: string): Promise<void> {
  await axios.post(`${API_URL}/api/admin/farmers/${id}/restore`, {}, headers(token));
}

// Crops
export interface Crop {
  id: string;
  farm_id: string;
  name: string;
  swahili_name?: string;
  planted_date?: string;
  harvest_date?: string;
  area_hectares?: number;
  status?: string;
  created_at?: string;
  deleted_at?: string;
  farm_name?: string;
  farmer_name?: string;
}

export async function getCrops(token: string, includeDeleted = false): Promise<Crop[]> {
  const res = await axios.get<{ crops: Crop[] }>(
    `${API_URL}/api/admin/crops${includeDeleted ? '?deleted=true' : ''}`,
    headers(token)
  );
  return res.data.crops;
}

export async function createCrop(
  token: string,
  data: Partial<Crop> & { farm_id: string; name: string }
): Promise<Crop> {
  const res = await axios.post(`${API_URL}/api/admin/crops`, data, headers(token));
  return res.data;
}

export async function updateCrop(token: string, id: string, data: Partial<Crop>): Promise<void> {
  await axios.put(`${API_URL}/api/admin/crops/${id}`, data, headers(token));
}

export async function deleteCrop(token: string, id: string): Promise<void> {
  await axios.delete(`${API_URL}/api/admin/crops/${id}`, headers(token));
}

export async function restoreCrop(token: string, id: string): Promise<void> {
  await axios.post(`${API_URL}/api/admin/crops/${id}/restore`, {}, headers(token));
}

// Farms (for dropdowns and Farms page)
export interface FarmCrop {
  id: string;
  name: string;
  swahili_name?: string;
  status?: string;
  planted_date?: string;
  harvest_date?: string;
  area_hectares?: number;
}

export interface Farm {
  id: string;
  name?: string;
  location?: string;
  area_hectares?: number;
  farmer_id?: string;
  farmer_name?: string;
  farmer_phone?: string;
  unique_code?: string;
  latitude?: number;
  longitude?: number;
  created_at?: string;
  sensor_count?: number;
  robot_count?: number;
  crops_count?: number;
  crops?: FarmCrop[];
}

export async function getFarms(token: string, detailed = false): Promise<Farm[]> {
  const res = await axios.get<{ farms: Farm[] }>(
    `${API_URL}/api/admin/farms${detailed ? '?detailed=true' : ''}`,
    headers(token)
  );
  return res.data.farms;
}

export async function createFarm(
  token: string,
  data: { farmer_id: string; name: string; location?: string; area_hectares?: number; latitude?: number; longitude?: number }
): Promise<{ id: string; unique_code?: string; latitude?: number; longitude?: number }> {
  const res = await axios.post(`${API_URL}/api/admin/farms`, data, headers(token));
  return res.data;
}

// Analytics
export interface Analytics {
  farmers: number;
  crops: number;
  farms: number;
  alerts: number;
  topCrops: { name: string; farmers: number }[];
}

export async function getAnalytics(token: string): Promise<Analytics> {
  const res = await axios.get<Analytics>(`${API_URL}/api/admin/analytics`, headers(token));
  return res.data;
}

// Sensors (register, initialize, configure)
export interface Sensor {
  id: string;
  farm_id?: string;
  device_id?: string;
  name: string;
  type?: string;
  value?: number;
  unit?: string;
  status?: string;
  last_reading_at?: string;
  farm_name?: string;
  registration_status?: 'registered' | 'initialized' | 'configured' | 'active';
  server_config?: { api_key?: string; endpoint?: string; poll_interval_sec?: number };
}

export async function getSensors(token: string): Promise<Sensor[]> {
  const res = await axios.get<{ sensors: Sensor[] }>(`${API_URL}/api/admin/sensors`, headers(token));
  return res.data.sensors;
}

export async function registerSensor(
  token: string,
  data: { device_id: string; name: string; type?: string; unit?: string }
): Promise<Sensor> {
  const res = await axios.post(`${API_URL}/api/admin/sensors/register`, data, headers(token));
  return res.data;
}

export async function initializeSensor(token: string, id: string): Promise<void> {
  await axios.post(`${API_URL}/api/admin/sensors/${id}/initialize`, {}, headers(token));
}

export async function configureSensor(
  token: string,
  id: string,
  data: { api_key: string; endpoint?: string; poll_interval_sec?: number }
): Promise<void> {
  await axios.post(`${API_URL}/api/admin/sensors/${id}/configure`, data, headers(token));
}

export async function updateSensor(token: string, id: string, data: Partial<Sensor>): Promise<void> {
  await axios.put(`${API_URL}/api/admin/sensors/${id}`, data, headers(token));
}

export async function deleteSensor(token: string, id: string): Promise<void> {
  await axios.delete(`${API_URL}/api/admin/sensors/${id}`, headers(token));
}

// Robots (register, initialize, configure)
export interface Robot {
  id: string;
  farmer_id?: string;
  device_id?: string;
  name: string;
  type?: string;
  status?: string;
  battery?: number;
  last_active?: string;
  farmer_name?: string;
  registration_status?: 'registered' | 'initialized' | 'configured' | 'active';
  server_config?: { api_key?: string; endpoint?: string; heartbeat_interval_sec?: number };
}

export async function getRobots(token: string): Promise<Robot[]> {
  const res = await axios.get<{ robots: Robot[] }>(`${API_URL}/api/admin/robots`, headers(token));
  return res.data.robots;
}

export async function registerRobot(
  token: string,
  data: { device_id: string; name: string; type?: string; battery?: number }
): Promise<Robot> {
  const res = await axios.post(`${API_URL}/api/admin/robots/register`, data, headers(token));
  return res.data;
}

export async function initializeRobot(token: string, id: string): Promise<void> {
  await axios.post(`${API_URL}/api/admin/robots/${id}/initialize`, {}, headers(token));
}

export async function configureRobot(
  token: string,
  id: string,
  data: { api_key: string; endpoint?: string; heartbeat_interval_sec?: number }
): Promise<void> {
  await axios.post(`${API_URL}/api/admin/robots/${id}/configure`, data, headers(token));
}

export async function updateRobot(token: string, id: string, data: Partial<Robot>): Promise<void> {
  await axios.put(`${API_URL}/api/admin/robots/${id}`, data, headers(token));
}

export async function deleteRobot(token: string, id: string): Promise<void> {
  await axios.delete(`${API_URL}/api/admin/robots/${id}`, headers(token));
}

// Settings: system config, logs, admin users
export interface SystemConfig {
  ports?: Record<string, number>;
  endpoints?: Record<string, string>;
}

export async function getSettingsConfig(token: string): Promise<SystemConfig> {
  const res = await axios.get<{ config: SystemConfig }>(`${API_URL}/api/admin/settings/config`, headers(token));
  return res.data.config;
}

export async function seedSettingsConfig(token: string): Promise<{ ok: boolean; message?: string }> {
  const res = await axios.post<{ ok: boolean; message?: string }>(`${API_URL}/api/admin/settings/seed-config`, {}, headers(token));
  return res.data;
}

export async function updateSettingsConfig(
  token: string,
  key: string,
  value: Record<string, unknown>
): Promise<void> {
  await axios.put(`${API_URL}/api/admin/settings/config`, { key, value }, headers(token));
}

export interface SystemLog {
  id: string;
  level: string;
  service?: string;
  message: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export async function getSettingsLogs(
  token: string,
  opts?: { limit?: number; level?: string; service?: string }
): Promise<SystemLog[]> {
  const params = new URLSearchParams();
  if (opts?.limit) params.set('limit', String(opts.limit));
  if (opts?.level) params.set('level', opts.level);
  if (opts?.service) params.set('service', opts.service);
  const res = await axios.get<{ logs: SystemLog[] }>(
    `${API_URL}/api/admin/settings/logs?${params}`,
    headers(token)
  );
  return res.data.logs;
}

export async function addSettingsLog(
  token: string,
  data: { level: 'info' | 'warn' | 'error' | 'debug'; service?: string; message: string; metadata?: Record<string, unknown> }
): Promise<SystemLog> {
  const res = await axios.post<SystemLog>(`${API_URL}/api/admin/settings/logs`, data, headers(token));
  return res.data;
}

export interface AdminUser {
  id: string;
  email: string;
  name?: string;
  phone?: string;
  role: string;
  created_at?: string;
}

export async function getAdminUsers(token: string): Promise<AdminUser[]> {
  const res = await axios.get<{ users: AdminUser[] }>(`${API_URL}/api/admin/users`, headers(token));
  return res.data.users;
}

export async function createAdminUser(
  token: string,
  data: { email: string; password: string; name?: string; phone?: string }
): Promise<AdminUser> {
  const res = await axios.post<AdminUser>(`${API_URL}/api/admin/settings/users`, data, headers(token));
  return res.data;
}

export async function updateUserRole(token: string, id: string, role: 'admin' | 'farmer'): Promise<void> {
  await axios.put(`${API_URL}/api/admin/users/${id}/role`, { role }, headers(token));
}

export async function deleteAdminUser(token: string, id: string): Promise<void> {
  await axios.delete(`${API_URL}/api/admin/settings/users/${id}`, headers(token));
}

export async function getAuditLogs(token: string, limit?: number): Promise<{ id: string; action: string; user_id?: string; created_at: string; metadata?: unknown; email?: string }[]> {
  const res = await axios.get<{ logs: unknown[] }>(
    `${API_URL}/api/admin/audit${limit ? `?limit=${limit}` : ''}`,
    headers(token)
  );
  return res.data.logs as { id: string; action: string; user_id?: string; created_at: string; metadata?: unknown; email?: string }[];
}

export async function getAdminHealth(token: string): Promise<{ status: string; db?: string }> {
  const res = await axios.get<{ status: string; db?: string }>(`${API_URL}/api/admin/health`, headers(token));
  return res.data;
}

export async function requestReconnectDb(token: string): Promise<{ ok: boolean; message?: string; error?: string; status?: string; db?: string }> {
  const res = await axios.post<{ ok: boolean; message?: string; error?: string; status?: string; db?: string }>(
    `${API_URL}/api/admin/settings/reconnect-db`,
    {},
    { ...headers(token), timeout: 120000 }
  );
  return res.data;
}

export interface AlternativeDbReconnectResult {
  ok: boolean;
  message?: string;
  error?: string;
  steps?: { step: string; ok: boolean; output?: string }[];
  dbConnected?: boolean;
}

export async function requestAlternativeDbReconnect(token: string): Promise<AlternativeDbReconnectResult> {
  const res = await axios.post<AlternativeDbReconnectResult>(`${API_URL}/api/admin/settings/alternative-db-reconnect`, {}, headers(token));
  return res.data;
}

export async function requestStartDevServices(token: string): Promise<{ ok: boolean; message?: string; error?: string }> {
  const res = await axios.post<{ ok: boolean; message?: string; error?: string }>(`${API_URL}/api/admin/settings/start-dev-services`, {}, headers(token));
  return res.data;
}

export interface RunCommandResult {
  ok: boolean;
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  error?: string;
}

export async function requestRunCommand(token: string, command: string): Promise<RunCommandResult> {
  const res = await axios.post<RunCommandResult>(`${API_URL}/api/admin/settings/run-command`, { command }, headers(token));
  return res.data;
}

export async function requestFixOrphanFarmers(token: string): Promise<{ ok: boolean; message?: string; created?: number; farmers?: { id: string; user_id: string; name?: string }[]; error?: string }> {
  const res = await axios.post(`${API_URL}/api/admin/settings/fix-orphan-farmers`, {}, headers(token));
  return res.data;
}

export interface SystemHealthDetails {
  cpu: { percent: number; loadAvg: number[]; cores: number };
  ram: { percent: number; totalMb: number; usedMb: number; freeMb: number };
  disk: { percent: number; freeGb: string; totalGb: string } | null;
  uptime: string;
  services: { list: { name: string; status: string; statusCode?: number; error?: string }[]; online: number; total: number };
  db: string;
}

export async function getSystemHealthDetails(token: string): Promise<SystemHealthDetails> {
  const res = await axios.get<SystemHealthDetails>(`${API_URL}/api/admin/system/health-details`, headers(token));
  return res.data;
}

export async function requestSystemRestart(token: string): Promise<{ ok: boolean; message?: string }> {
  const res = await axios.post<{ ok: boolean; message?: string }>(`${API_URL}/api/admin/settings/restart`, {}, headers(token));
  return res.data;
}

export interface RebuildServiceResult {
  ok: boolean;
  message?: string;
  command?: string;
  output?: string;
  error?: string;
}

export interface RebuildConfigResult {
  projectDir: string;
  configured: boolean;
  hint?: string;
}

export async function getRebuildConfig(token: string): Promise<RebuildConfigResult> {
  const res = await axios.get<RebuildConfigResult>(`${API_URL}/api/admin/settings/rebuild-config`, headers(token));
  return res.data;
}

export async function requestRebuildService(token: string, service: string): Promise<RebuildServiceResult> {
  const res = await axios.post<RebuildServiceResult>(`${API_URL}/api/admin/settings/rebuild-service`, { service }, headers(token));
  return res.data;
}

export async function requestRunManualRebuild(token: string): Promise<RebuildServiceResult> {
  const res = await axios.post<RebuildServiceResult>(`${API_URL}/api/admin/settings/run-manual-rebuild`, {}, headers(token));
  return res.data;
}

export interface MigrationReadyResult {
  ready: boolean;
  dbOk: boolean;
  migrationsDirOk: boolean;
  error?: string;
}

export async function checkMigrationReady(token: string): Promise<MigrationReadyResult> {
  const res = await axios.get<MigrationReadyResult>(`${API_URL}/api/admin/settings/migration-ready`, headers(token));
  return res.data;
}

export interface MigrationListResult {
  ok: boolean;
  migrations?: string[];
}

export async function getMigrationList(token: string): Promise<MigrationListResult> {
  const res = await axios.get<MigrationListResult>(`${API_URL}/api/admin/settings/migration-list`, headers(token));
  return res.data;
}

export interface RunMigrationsResult {
  ok: boolean;
  message?: string;
  results?: { file: string; status: string; message?: string }[];
  error?: string;
  reconnectTip?: string;
}

export async function requestRunMigrations(token: string): Promise<RunMigrationsResult> {
  const res = await axios.post<RunMigrationsResult>(`${API_URL}/api/admin/settings/run-migrations`, {}, {
    ...headers(token),
    timeout: 10 * 60 * 1000
  });
  return res.data;
}

export async function requestRunSingleMigration(token: string, file: string): Promise<RunMigrationsResult> {
  const res = await axios.post<RunMigrationsResult>(`${API_URL}/api/admin/settings/run-single-migration`, { file }, {
    ...headers(token),
    timeout: 2 * 60 * 1000
  });
  return res.data;
}

export interface SingleMigrationJobStart {
  ok: boolean;
  jobId: string;
  message?: string;
}

export interface SingleMigrationJobStatus {
  status: 'running' | 'completed' | 'failed';
  ok?: boolean;
  file?: string;
  message?: string;
  error?: string;
  results?: { file: string; status: string; message?: string }[];
  reconnectTip?: string;
}

export async function startSingleMigration(token: string, file: string): Promise<SingleMigrationJobStart> {
  const res = await axios.post<SingleMigrationJobStart>(`${API_URL}/api/admin/settings/run-single-migration`, { file }, {
    ...headers(token),
    timeout: 10000
  });
  return res.data;
}

export async function getSingleMigrationJob(token: string, jobId: string): Promise<SingleMigrationJobStatus> {
  const res = await axios.get<SingleMigrationJobStatus>(`${API_URL}/api/admin/settings/migration-job/${jobId}`, {
    ...headers(token),
    timeout: 10000
  });
  return res.data;
}

export interface MigrationStatusResult {
  ok: boolean;
  migrations?: { id: string; name: string; applied: boolean }[];
  error?: string;
}

export async function getMigrationStatus(token: string): Promise<MigrationStatusResult> {
  const res = await axios.get<MigrationStatusResult>(`${API_URL}/api/admin/settings/migration-status`, headers(token));
  return res.data;
}

// Service list and check individual service
export interface ServiceItem {
  key: string;
  name: string;
}

export async function getServiceList(token: string): Promise<ServiceItem[]> {
  const res = await axios.get<{ services: ServiceItem[] }>(`${API_URL}/api/admin/settings/service-list`, headers(token));
  return res.data.services;
}

export interface CheckServiceResult {
  service: string;
  name: string;
  status: 'online' | 'offline' | 'error';
  statusCode?: number;
  error?: string;
}

export async function checkService(token: string, serviceKey: string): Promise<CheckServiceResult> {
  const res = await axios.get<CheckServiceResult>(
    `${API_URL}/api/admin/settings/check-service?service=${encodeURIComponent(serviceKey)}`,
    headers(token)
  );
  return res.data;
}

// Access requests (admin/farmer approval)
export interface AccessRequest {
  id: string;
  email: string;
  name?: string;
  phone?: string;
  requested_role: string;
  farm_name?: string;
  farm_size?: number;
  farm_location?: string;
  farm_latitude?: number;
  farm_longitude?: number;
  message?: string;
  status: string;
  feedback_message?: string;
  created_at: string;
}

export async function getAccessRequests(token: string, status = 'pending', role?: 'farmer' | 'admin'): Promise<AccessRequest[]> {
  const params = new URLSearchParams({ status });
  if (role) params.set('role', role);
  const res = await axios.get<{ requests: AccessRequest[] }>(
    `${API_URL}/api/admin/requests?${params}`,
    headers(token)
  );
  return res.data.requests;
}

export async function approveAccessRequest(token: string, id: string, feedbackMessage?: string): Promise<void> {
  await axios.post(`${API_URL}/api/admin/requests/${id}/approve`, { feedback_message: feedbackMessage }, headers(token));
}

export async function rejectAccessRequest(token: string, id: string, feedbackMessage: string): Promise<void> {
  await axios.post(`${API_URL}/api/admin/requests/${id}/reject`, { feedback_message: feedbackMessage }, headers(token));
}
