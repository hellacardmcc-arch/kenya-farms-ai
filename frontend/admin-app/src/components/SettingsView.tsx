import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ProfileContent from './ProfileContent';
import {
  getSettingsConfig,
  updateSettingsConfig,
  seedSettingsConfig,
  getSettingsLogs,
  addSettingsLog,
  getAuditLogs,
  getAdminHealth,
  requestReconnectDb,
  requestAlternativeDbReconnect,
  requestStartDevServices,
  requestRunCommand,
  requestFixOrphanFarmers,
  requestSystemRestart,
  requestRebuildService,
  requestRunManualRebuild,
  getRebuildConfig,
  requestRunMigrations,
  getMigrationStatus,
  getMigrationList,
  startSingleMigration,
  getSingleMigrationJob,
  checkMigrationReady,
  getServiceList,
  checkService,
  type SystemConfig,
  type SystemLog,
  type RunMigrationsResult,
  type ServiceItem,
  type CheckServiceResult
} from '../api/adminApi';
import './AdminPage.css';
import './SettingsView.css';

type TabId = 'profile' | 'ports' | 'endpoints' | 'logs' | 'audit' | 'maintenance' | 'terminal';

const SettingsView: React.FC = () => {
  const { token, logout } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab') as TabId | null;
  const [activeTab, setActiveTab] = useState<TabId>(tabParam && ['profile', 'ports', 'endpoints', 'logs', 'audit', 'maintenance', 'terminal'].includes(tabParam) ? tabParam : 'ports');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Config
  const [config, setConfig] = useState<SystemConfig>({});
  const [configLoading, setConfigLoading] = useState(true);
  const [editingPort, setEditingPort] = useState<{ key: string; value: number } | null>(null);
  const [editingEndpoint, setEditingEndpoint] = useState<{ key: string; value: string } | null>(null);

  // Logs
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [auditLogs, setAuditLogs] = useState<{ id: string; action: string; email?: string; created_at: string; metadata?: unknown }[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [logLevel, setLogLevel] = useState('');
  const [newLog, setNewLog] = useState<{ level: 'info' | 'warn' | 'error' | 'debug'; message: string }>({ level: 'info', message: '' });
  const [addingLog, setAddingLog] = useState(false);

  // Maintenance / Health
  const [health, setHealth] = useState<{ status: string; db?: string } | null>(null);
  const [maintenanceAction, setMaintenanceAction] = useState<string | null>(null);

  // Restart modal: 0=closed, 1=first warning, 2=second warning, 3=final confirm
  const [restartStep, setRestartStep] = useState(0);
  const [restartConfirmText, setRestartConfirmText] = useState('');
  const [restarting, setRestarting] = useState(false);

  // Rebuild service
  const [rebuildService, setRebuildService] = useState<string>('');
  const [rebuilding, setRebuilding] = useState(false);
  const [rebuildConfig, setRebuildConfig] = useState<{ projectDir: string; configured: boolean; hint?: string } | null>(null);

  // Run migrations
  const [migrating, setMigrating] = useState(false);
  const [migrationProgress, setMigrationProgress] = useState(0);
  const [migrationResults, setMigrationResults] = useState<{ file: string; status: string; message?: string }[] | null>(null);
  const [migrationConfirmOpen, setMigrationConfirmOpen] = useState(false);
  const [migrationOverlayOpen, setMigrationOverlayOpen] = useState(false);
  const [migrationList, setMigrationList] = useState<string[]>([]);
  const migrationListScrollRef = useRef<HTMLDivElement>(null);

  // Force reconnect DB
  const [reconnecting, setReconnecting] = useState(false);
  // Alternative DB Reconnect (full procedure)
  const [alternativeDbReconnecting, setAlternativeDbReconnecting] = useState(false);
  // Start Dev Services (npm run dev:services)
  const [startingDevServices, setStartingDevServices] = useState(false);
  // Fix orphan farmers
  const [fixingOrphans, setFixingOrphans] = useState(false);
  // Terminal
  const [terminalCommand, setTerminalCommand] = useState('');
  const [terminalOutput, setTerminalOutput] = useState<string[]>([]);
  const [terminalRunning, setTerminalRunning] = useState(false);
  const terminalOutputRef = useRef<HTMLDivElement>(null);

  // Migration status
  const [migrationStatus, setMigrationStatus] = useState<{ id: string; name: string; applied: boolean }[] | null>(null);
  const [migrationStatusLoading, setMigrationStatusLoading] = useState(false);

  // Seed config
  const [seeding, setSeeding] = useState(false);

  // Single migration
  const [migrationListForSingle, setMigrationListForSingle] = useState<string[]>([]);
  const [singleMigrationFile, setSingleMigrationFile] = useState<string>('');
  const [singleMigrating, setSingleMigrating] = useState(false);
  const [singleMigrationResult, setSingleMigrationResult] = useState<{ ok: boolean; file?: string; message?: string; reconnectTip?: string; results?: { file: string; status: string; message?: string }[] } | null>(null);

  // Check individual service
  const [serviceList, setServiceList] = useState<ServiceItem[]>([]);
  const [checkServiceKey, setCheckServiceKey] = useState<string>('');
  const [checkServiceResult, setCheckServiceResult] = useState<CheckServiceResult | null>(null);
  const [checkServiceLoading, setCheckServiceLoading] = useState(false);

  const loadConfig = () => {
    if (!token) return;
    getSettingsConfig(token)
      .then(setConfig)
      .catch(() => setConfig({}))
      .finally(() => setConfigLoading(false));
  };

  const loadLogs = () => {
    if (!token) return;
    getSettingsLogs(token, { limit: 100, level: logLevel || undefined })
      .then(setLogs)
      .catch(() => setLogs([]))
      .finally(() => setLogsLoading(false));
  };

  const loadAuditLogs = () => {
    if (!token) return;
    getAuditLogs(token, 100)
      .then(setAuditLogs)
      .catch(() => setAuditLogs([]));
  };

  const loadHealth = () => {
    if (!token) return;
    getAdminHealth(token)
      .then(setHealth)
      .catch(() => setHealth({ status: 'error' }));
  };

  useEffect(() => {
    loadConfig();
  }, [token]);

  useEffect(() => {
    if (tabParam && ['profile', 'ports', 'endpoints', 'logs', 'audit', 'maintenance', 'terminal'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  const loadRebuildConfig = () => {
    if (!token) return;
    getRebuildConfig(token)
      .then(setRebuildConfig)
      .catch(() => setRebuildConfig(null));
  };

  useEffect(() => {
    if (activeTab === 'logs') loadLogs();
    if (activeTab === 'audit') loadAuditLogs();
    if (activeTab === 'maintenance') {
      loadHealth();
      loadRebuildConfig();
      if (token) {
        getServiceList(token).then(setServiceList).catch(() => setServiceList([]));
        getMigrationList(token).then((r) => setMigrationListForSingle(r?.migrations || [])).catch(() => setMigrationListForSingle([]));
      }
    }
  }, [token, activeTab, logLevel]);

  const handleSavePort = async () => {
    if (!token || !editingPort) return;
    setMessage(null);
    try {
      const ports = { ...(config.ports || {}), [editingPort.key]: editingPort.value };
      await updateSettingsConfig(token, 'ports', ports);
      setConfig({ ...config, ports });
      setMessage({ type: 'success', text: 'Port updated. Restart services for changes to take effect.' });
      setEditingPort(null);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed';
      setMessage({ type: 'error', text: msg });
    }
  };

  const handleSaveEndpoint = async () => {
    if (!token || !editingEndpoint) return;
    setMessage(null);
    try {
      const endpoints = { ...(config.endpoints || {}), [editingEndpoint.key]: editingEndpoint.value };
      await updateSettingsConfig(token, 'endpoints', endpoints);
      setConfig({ ...config, endpoints });
      setMessage({ type: 'success', text: 'Endpoint updated.' });
      setEditingEndpoint(null);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed';
      setMessage({ type: 'error', text: msg });
    }
  };

  const handleAddLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !newLog.message.trim()) return;
    setAddingLog(true);
    setMessage(null);
    try {
      await addSettingsLog(token, { level: newLog.level, message: newLog.message.trim() });
      setMessage({ type: 'success', text: 'Log entry added' });
      setNewLog({ level: 'info', message: '' });
      loadLogs();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed';
      setMessage({ type: 'error', text: msg });
    } finally {
      setAddingLog(false);
    }
  };

  const handleForceReconnectDb = async () => {
    if (!token) return;
    setReconnecting(true);
    setMessage(null);
    try {
      const result = await requestReconnectDb(token);
      if (result.ok) {
        await loadHealth();
        setHealth({ status: 'ok', db: 'connected' });
        setMessage({ type: 'success', text: result.message || '✓ Database reconnected successfully. Connection pool refreshed.' });
      } else {
        setMessage({ type: 'error', text: result.message || result.error || 'Reconnect failed' });
      }
    } catch (err: unknown) {
      const res = (err as { response?: { data?: { message?: string; error?: string } } })?.response?.data;
      setMessage({ type: 'error', text: res?.message || res?.error || 'Force reconnect failed' });
    } finally {
      setReconnecting(false);
    }
  };

  const handleAlternativeDbReconnect = async () => {
    if (!token) return;
    setAlternativeDbReconnecting(true);
    setMessage(null);
    try {
      const result = await requestAlternativeDbReconnect(token);
      if (result.ok) {
        await loadHealth();
        setHealth({ status: 'ok', db: 'connected' });
        setMessage({ type: 'success', text: result.message || '✓ Alternative DB Reconnect completed successfully. Databases (Postgres, MongoDB, Redis) are running.' });
      } else {
        const errMsg = result.message || result.error || 'Alternative DB Reconnect encountered errors';
        setMessage({ type: 'error', text: errMsg });
      }
    } catch (err: unknown) {
      const res = (err as { response?: { data?: { message?: string; error?: string } } })?.response?.data;
      setMessage({ type: 'error', text: res?.message || res?.error || 'Alternative DB Reconnect failed' });
    } finally {
      setAlternativeDbReconnecting(false);
    }
  };

  const handleStartDevServices = async () => {
    if (!token) return;
    setStartingDevServices(true);
    setMessage(null);
    try {
      const result = await requestStartDevServices(token);
      if (result.ok) {
        setMessage({ type: 'success', text: result.message || '✓ Dev services started in background. Check your terminal.' });
      } else {
        setMessage({ type: 'error', text: result.message || result.error || 'Failed to start dev services' });
      }
    } catch (err: unknown) {
      const res = (err as { response?: { data?: { message?: string; error?: string } } })?.response?.data;
      setMessage({ type: 'error', text: res?.message || res?.error || 'Start dev services failed' });
    } finally {
      setStartingDevServices(false);
    }
  };

  const handleFixOrphanFarmers = async () => {
    if (!token) return;
    setFixingOrphans(true);
    setMessage(null);
    try {
      const result = await requestFixOrphanFarmers(token);
      if (result.ok) {
        setMessage({ type: 'success', text: result.message || 'Orphan farmers fixed.' });
      } else {
        setMessage({ type: 'error', text: result.message || result.error || 'Fix failed' });
      }
    } catch (err: unknown) {
      const res = (err as { response?: { data?: { message?: string; error?: string } } })?.response?.data;
      setMessage({ type: 'error', text: res?.message || res?.error || 'Fix orphan farmers failed' });
    } finally {
      setFixingOrphans(false);
    }
  };

  const handleRunTerminalCommand = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!token || !terminalCommand.trim() || terminalRunning) return;
    setTerminalRunning(true);
    // Strip leading $ or $  (prompt char) so "npm run check-db" works even if user typed "$ npm run check-db"
    const cmd = terminalCommand.trim().replace(/^\$\s*/, '');
    if (!cmd) {
      setTerminalRunning(false);
      return;
    }
    setTerminalOutput((prev) => [...prev, `$ ${cmd}`]);
    setTerminalCommand('');
    try {
      const result = await requestRunCommand(token, cmd);
      const lines: string[] = [];
      if (result.stdout) lines.push(...result.stdout.split('\n'));
      if (result.stderr) lines.push(...result.stderr.split('\n').map((l) => `[stderr] ${l}`));
      if (result.error && !result.stdout && !result.stderr) lines.push(result.error);
      if (lines.length === 0) lines.push(result.ok ? '(no output)' : `Exit code: ${result.exitCode ?? 1}`);
      setTerminalOutput((prev) => [...prev, ...lines]);
    } catch (err: unknown) {
      const res = (err as { response?: { data?: { message?: string; error?: string } } })?.response?.data;
      setTerminalOutput((prev) => [...prev, `Error: ${(res as { message?: string })?.message || (res as { error?: string })?.error || 'Request failed'}`]);
    } finally {
      setTerminalRunning(false);
    }
  };

  useEffect(() => {
    terminalOutputRef.current?.scrollTo(0, terminalOutputRef.current.scrollHeight);
  }, [terminalOutput]);

  const runMaintenance = async (action: string) => {
    if (!token) return;
    setMaintenanceAction(action);
    setMessage(null);
    try {
      if (action === 'health') {
        await loadHealth();
        setMessage({ type: 'success', text: 'Health check completed' });
      } else if (action === 'clear-cache') {
        setMessage({ type: 'success', text: 'Cache clear requested. Backend may need to implement this.' });
      } else if (action === 'db-backup') {
        setMessage({ type: 'success', text: 'Backup requested. Configure backup job in your deployment.' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Maintenance action failed' });
    } finally {
      setMaintenanceAction(null);
    }
  };

  const handleCheckService = async () => {
    if (!token || !checkServiceKey) return;
    setCheckServiceLoading(true);
    setCheckServiceResult(null);
    setMessage(null);
    try {
      const result = await checkService(token, checkServiceKey);
      setCheckServiceResult(result);
      const ok = result.status === 'online';
      setMessage({ type: ok ? 'success' : 'error', text: ok ? `${result.name} is online` : `${result.name}: ${result.error || result.status} (${result.statusCode || '—'})` });
    } catch (err: unknown) {
      const res = (err as { response?: { data?: { error?: string } } })?.response?.data;
      setMessage({ type: 'error', text: (res as { error?: string })?.error || 'Check failed' });
    } finally {
      setCheckServiceLoading(false);
    }
  };

  const openRestartModal = () => {
    setRestartStep(1);
    setRestartConfirmText('');
    setMessage(null);
  };

  const closeRestartModal = () => {
    setRestartStep(0);
    setRestartConfirmText('');
  };

  const handleRestartStep = () => {
    if (restartStep === 1) setRestartStep(2);
    else if (restartStep === 2) setRestartStep(3);
  };

  const handleRestartConfirm = async () => {
    if (restartStep !== 3 || restartConfirmText.toUpperCase() !== 'RESTART') return;
    if (!token) return;
    setRestarting(true);
    setMessage(null);
    try {
      const result = await requestSystemRestart(token);
      setMessage({ type: 'success', text: result.message || 'System restart requested. Services will restart shortly.' });
      closeRestartModal();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Restart request failed';
      setMessage({ type: 'error', text: msg });
    } finally {
      setRestarting(false);
    }
  };

  const handleSeedConfig = async () => {
    if (!token) return;
    setSeeding(true);
    setMessage(null);
    try {
      await seedSettingsConfig(token);
      setMessage({ type: 'success', text: 'Default ports and endpoints saved to database.' });
      loadConfig();
    } catch (err: unknown) {
      const res = (err as { response?: { data?: { error?: string } } })?.response?.data;
      setMessage({ type: 'error', text: res?.error || 'Failed to seed config' });
    } finally {
      setSeeding(false);
    }
  };

  // Auto-scroll migration list when populated and overlay is open
  const autoScrollMigrationList = useCallback(() => {
    const el = migrationListScrollRef.current;
    if (!el || migrationList.length === 0) return;
    const maxScroll = el.scrollHeight - el.clientHeight;
    if (maxScroll <= 0) return;
    const duration = 4000;
    const startTime = performance.now();
    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      el.scrollTop = maxScroll * progress;
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [migrationList.length]);

  useEffect(() => {
    if (migrationList.length > 0 && migrationOverlayOpen && migrationListScrollRef.current) {
      // Small delay so DOM is ready
      const t = setTimeout(() => autoScrollMigrationList(), 100);
      return () => clearTimeout(t);
    }
  }, [migrationList, migrationOverlayOpen, autoScrollMigrationList]);

  const handleCheckMigrationStatus = async () => {
    if (!token) return;
    setMigrationStatusLoading(true);
    setMessage(null);
    try {
      const result = await getMigrationStatus(token);
      if (result.ok && result.migrations) {
        setMigrationStatus(result.migrations);
        setMessage({ type: 'success', text: `Found ${result.migrations.filter(m => m.applied).length}/${result.migrations.length} migrations applied.` });
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to check migration status' });
      }
    } catch (err: unknown) {
      const res = (err as { response?: { data?: { error?: string } } })?.response?.data;
      setMessage({ type: 'error', text: res?.error || 'Failed to check migration status' });
    } finally {
      setMigrationStatusLoading(false);
    }
  };

  const runMigrationFlow = async () => {
    if (!token) return;
    setMigrationConfirmOpen(false);
    setMigrationOverlayOpen(true);
    setMigrating(true);
    setMigrationProgress(0);
    setMessage(null);
    setMigrationResults(null);
    setMigrationList([]);

    const setProgress = (p: number) => {
      setMigrationProgress((prev) => Math.max(prev, p));
    };

    // Phase 1: Fetch migration list and auto-scroll to populate changes before migration
    try {
      const listRes = await getMigrationList(token);
      const list = listRes?.migrations || [];
      setMigrationList(list);
      setProgress(5);
      // Wait for auto-scroll to complete (~4s) so user sees all migrations
      await new Promise((r) => setTimeout(r, 4500));
      setProgress(10);
    } catch {
      // Fallback: use empty list, proceed without preview
      setProgress(10);
    }

    let lastError: string | null = null;
    let attempts = 0;
    const maxAttempts = 2;

    const attemptMigration = async (): Promise<RunMigrationsResult | null> => {
      try {
        const result = await requestRunMigrations(token);
        return result;
      } catch (err: unknown) {
        const e = err as { message?: string; code?: string; response?: { data?: RunMigrationsResult | string; status?: number } };
        const data = e?.response?.data;
        const status = e?.response?.status;
        const msg = (e?.message || '').toLowerCase();
        if (typeof data === 'string' && data.includes('Cannot POST')) {
          lastError = 'Migration route not available. Rebuild admin-service and try again.';
        } else if (data && typeof data === 'object' && 'error' in data) {
          lastError = (data as RunMigrationsResult).error || (data as RunMigrationsResult).message || 'Migration failed';
        } else if (status === 502 || status === 503 || status === 504) {
          lastError = status === 504
            ? `Gateway timeout (504). Migration took too long. Restart API Gateway after config changes, ensure admin-service is running, then retry.`
            : `Gateway error (${status}). Admin-service may be down. Ensure API Gateway (port 5001) and admin-service (port 4006) are running.`;
        } else if (msg.includes('network') || msg.includes('econnrefused') || msg.includes('econnreset') || msg.includes('failed to fetch')) {
          lastError = 'Cannot reach API. Ensure API Gateway (port 5001) and admin-service (port 4006) are running.';
        } else if (msg.includes('timeout')) {
          lastError = 'Migration timed out. Try again or run migrations manually via psql.';
        } else {
          lastError = e?.message || 'Run migrations request failed. Check admin-service is running.';
        }
        return null;
      }
    };

    try {
      setProgress(5);
      let ready = false;
      try {
        const preflight = await checkMigrationReady(token);
        ready = preflight.ready;
        if (!ready && preflight.error) lastError = preflight.error;
      } catch {
        lastError = 'Preflight check failed. Admin-service may need rebuild.';
      }
      setProgress(15);

      if (!ready && lastError?.includes('not connected')) {
        setProgress(20);
        try {
          await requestReconnectDb(token);
          await new Promise((r) => setTimeout(r, 500));
          const retryPreflight = await checkMigrationReady(token);
          ready = retryPreflight.ready;
        } catch (_) {}
        setProgress(25);
      }

      if (!ready && (lastError?.includes('route') || lastError?.includes('Rebuild') || lastError?.includes('Preflight'))) {
        setProgress(25);
        try {
          await requestRebuildService(token, 'admin-service');
          await new Promise((r) => setTimeout(r, 15000));
          const retryPreflight = await checkMigrationReady(token);
          ready = retryPreflight.ready;
          if (ready) lastError = null;
        } catch (_) {}
        setProgress(35);
      }

      if (!ready) {
        setProgress(100);
        setMessage({ type: 'error', text: lastError || 'Preflight failed. Check database and admin-service.' });
        return;
      }

      setProgress(40);
      try {
        await requestReconnectDb(token);
      } catch (_) {}
      await new Promise((r) => setTimeout(r, 300));
      setProgress(45);

      let result: RunMigrationsResult | null = null;
      while (attempts < maxAttempts) {
        attempts++;
        result = await attemptMigration();
        setProgress(45 + attempts * 25);
        if (result?.ok) break;
        if (result && !result.ok && result.reconnectTip) {
          try {
            await requestReconnectDb(token);
            await new Promise((r) => setTimeout(r, 800));
          } catch (_) {}
        } else if (lastError?.includes('route') || lastError?.includes('Rebuild')) {
          break;
        }
      }

      setProgress(95);
      if (result?.ok) {
        setProgress(100);
        setMigrationResults(result.results || []);
        setHealth({ status: 'ok', db: 'connected' });
        setMessage({ type: 'success', text: result.message || 'All database migrations completed successfully.' });
        handleCheckMigrationStatus();
      } else {
        setProgress(100);
        setMigrationResults(result?.results || null);
        const tip = result?.reconnectTip ? ' Try Force Reconnect, then run again.' : '';
        setMessage({ type: 'error', text: (result?.error || result?.message || lastError || 'Migrations failed') + tip });
      }
    } catch (err: unknown) {
      setProgress(100);
      const res = (err as { response?: { data?: RunMigrationsResult } })?.response?.data;
      setMigrationResults(res?.results || null);
      setMessage({ type: 'error', text: (res?.error || res?.message || 'Unexpected error') });
    } finally {
      setMigrating(false);
      setTimeout(() => {
        setMigrationOverlayOpen(false);
        setMigrationProgress(0);
        setMigrationList([]);
      }, 600);
    }
  };

  const handleRunMigrations = () => runMigrationFlow();

  const handleRunSingleMigration = async () => {
    if (!token || !singleMigrationFile) return;
    setSingleMigrating(true);
    setSingleMigrationResult(null);
    setMessage(null);
    try {
      const { jobId } = await startSingleMigration(token, singleMigrationFile);
      const pollInterval = 1500;
      const maxPolls = 120;
      let polls = 0;
      const poll = async (): Promise<void> => {
        const job = await getSingleMigrationJob(token, jobId);
        if (job.status === 'running') {
          polls++;
          if (polls >= maxPolls) {
            setSingleMigrationResult({ ok: false, file: singleMigrationFile, message: 'Migration timed out. Check admin-service logs.' });
            setMessage({ type: 'error', text: 'Migration timed out.' });
            return;
          }
          await new Promise((r) => setTimeout(r, pollInterval));
          return poll();
        }
        setSingleMigrationResult({
          ok: job.ok ?? false,
          file: singleMigrationFile,
          message: job.message || job.error,
          reconnectTip: job.reconnectTip,
          results: job.results
        });
        if (job.ok) {
          setMessage({ type: 'success', text: job.message || `${singleMigrationFile} completed successfully.` });
          handleCheckMigrationStatus();
        } else {
          const tip = job.reconnectTip ? ' Try Force Reconnect, then run again.' : '';
          setMessage({ type: 'error', text: (job.error || job.message || 'Single migration failed') + tip });
        }
      };
      await poll();
    } catch (err: unknown) {
      const res = (err as { response?: { data?: RunMigrationsResult } })?.response?.data;
      const errMsg = res?.message || res?.error || (err as Error)?.message || 'Single migration request failed';
      setSingleMigrationResult({
        ok: false,
        file: singleMigrationFile,
        message: errMsg,
        reconnectTip: res?.reconnectTip,
        results: res?.results || undefined
      });
      setMessage({ type: 'error', text: errMsg });
    } finally {
      setSingleMigrating(false);
    }
  };

  const handleRebuildService = async (serviceOverride?: string) => {
    const svc = serviceOverride || rebuildService;
    if (!token || !svc) return;
    setRebuilding(true);
    setMessage(null);
    try {
      const result = await requestRebuildService(token, svc);
      if (result.ok) {
        setMessage({ type: 'success', text: result.message || `${svc} rebuilt and restarted.` });
        loadRebuildConfig();
      } else {
        const cmd = result.command ? ` Run manually: ${result.command}` : '';
        setMessage({ type: 'error', text: (result.error || result.message || 'Rebuild failed') + cmd });
      }
    } catch (err: unknown) {
      const res = (err as { response?: { data?: { error?: string; message?: string; command?: string } } })?.response?.data;
      const msg = res?.error || res?.message || 'Rebuild request failed';
      const cmd = res?.command ? ` Run manually: ${res.command}` : '';
      setMessage({ type: 'error', text: msg + cmd });
    } finally {
      setRebuilding(false);
    }
  };

  const handleRebuildAdminService = () => handleRebuildService('admin-service');

  const handleRunManualRebuild = async () => {
    if (!token) return;
    setRebuilding(true);
    setMessage(null);
    try {
      const result = await requestRunManualRebuild(token);
      if (result.ok) {
        setMessage({ type: 'success', text: result.message || 'Admin service rebuilt and restarted.' });
        loadRebuildConfig();
      } else {
        setMessage({ type: 'error', text: result.error || result.message || 'Run manual rebuild failed' });
      }
    } catch (err: unknown) {
      const res = (err as { response?: { data?: { error?: string; message?: string } } })?.response?.data;
      setMessage({ type: 'error', text: res?.error || res?.message || 'Run manual rebuild failed' });
    } finally {
      setRebuilding(false);
    }
  };

  const tabs: { id: TabId; label: string; icon: string }[] = [
    { id: 'profile', label: 'Profile', icon: '👤' },
    { id: 'ports', label: 'Ports', icon: '🔌' },
    { id: 'endpoints', label: 'Endpoints', icon: '🌐' },
    { id: 'logs', label: 'System Logs', icon: '📋' },
    { id: 'audit', label: 'Audit Logs', icon: '📜' },
    { id: 'maintenance', label: 'Maintenance', icon: '🔧' },
    { id: 'terminal', label: 'Terminal', icon: '⌨️' }
  ];

  const handleTabClick = (id: TabId) => {
    setActiveTab(id);
    setSearchParams(id === 'ports' ? {} : { tab: id });
  };

  const handleMaintenanceTerminalLink = () => {
    setActiveTab('terminal');
    setSearchParams({ tab: 'terminal' });
  };

  return (
    <div className="admin-page settings-page">
      <header className="admin-header">
        <div className="admin-header-row">
          <div>
            <h1>🇰🇪 Kenya Farms AI Admin</h1>
            <p>System Settings &amp; Maintenance</p>
          </div>
          <div className="admin-header-actions">
            <button onClick={() => navigate('/')}>Dashboard</button>
            <button onClick={() => navigate('/users')}>👥 Admin Users</button>
            <button onClick={() => { logout(); navigate('/login'); }}>Logout</button>
          </div>
        </div>
      </header>

      <div className="admin-page-content">
        <div className="settings-tabs">
          {tabs.map((t) => (
            <button
              key={t.id}
              className={`settings-tab ${activeTab === t.id ? 'active' : ''}`}
              onClick={() => handleTabClick(t.id)}
            >
              <span>{t.icon}</span> {t.label}
            </button>
          ))}
        </div>

        {message && (
          <div className={`admin-message admin-message-${message.type}`}>{message.text}</div>
        )}

        {/* Profile */}
        {activeTab === 'profile' && (
          <div className="settings-panel">
            <h2>Profile</h2>
            <p className="settings-desc">Update your account details and password.</p>
            <ProfileContent />
          </div>
        )}

        {/* Ports */}
        {activeTab === 'ports' && (
          <div className="settings-panel">
            <h2>Service Ports</h2>
            <p className="settings-desc">Configure ports for each microservice. Changes require service restart.</p>
            <button className="btn-secondary btn-seed-config" onClick={handleSeedConfig} disabled={seeding}>
              {seeding ? 'Saving...' : 'Seed default ports & endpoints'}
            </button>
            {configLoading ? (
              <div className="admin-loading">Loading...</div>
            ) : (
              <div className="settings-config-grid">
                {Object.entries(config.ports || {}).map(([key, val]) => (
                  <div key={key} className="settings-config-item">
                    <span className="config-key">{key.replace(/_/g, ' ')}</span>
                    {editingPort?.key === key ? (
                      <div className="config-edit">
                        <input
                          type="number"
                          value={editingPort.value}
                          onChange={(e) => setEditingPort({ ...editingPort, value: parseInt(e.target.value, 10) || 0 })}
                          min={1024}
                          max={65535}
                          aria-label="Port value"
                        />
                        <button className="btn-sm btn-primary" onClick={handleSavePort}>Save</button>
                        <button className="btn-sm btn-secondary" onClick={() => setEditingPort(null)}>Cancel</button>
                      </div>
                    ) : (
                      <div className="config-value">
                        <span>{val}</span>
                        <button className="btn-sm btn-primary" onClick={() => setEditingPort({ key, value: val })}>Edit</button>
                      </div>
                    )}
                  </div>
                ))}
                {(!config.ports || Object.keys(config.ports).length === 0) && (
                  <p className="admin-empty">No port config in database. Click &quot;Seed default ports &amp; endpoints&quot; above to save defaults.</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Endpoints */}
        {activeTab === 'endpoints' && (
          <div className="settings-panel">
            <h2>Service Endpoints</h2>
            <p className="settings-desc">Base URLs for each microservice. Used for internal service-to-service calls.</p>
            <button className="btn-secondary btn-seed-config" onClick={handleSeedConfig} disabled={seeding}>
              {seeding ? 'Saving...' : 'Seed default ports & endpoints'}
            </button>
            {configLoading ? (
              <div className="admin-loading">Loading...</div>
            ) : (
              <div className="settings-config-grid">
                {Object.entries(config.endpoints || {}).map(([key, val]) => (
                  <div key={key} className="settings-config-item endpoint-item">
                    <span className="config-key">{key.replace(/_/g, ' ')}</span>
                    {editingEndpoint?.key === key ? (
                      <div className="config-edit">
                        <input
                          type="text"
                          value={editingEndpoint.value}
                          onChange={(e) => setEditingEndpoint({ ...editingEndpoint, value: e.target.value })}
                          placeholder="http://localhost:4000"
                          className="config-endpoint-input"
                        />
                        <button className="btn-sm btn-primary" onClick={handleSaveEndpoint}>Save</button>
                        <button className="btn-sm btn-secondary" onClick={() => setEditingEndpoint(null)}>Cancel</button>
                      </div>
                    ) : (
                      <div className="config-value">
                        <span className="endpoint-url">{val}</span>
                        <button className="btn-sm btn-primary" onClick={() => setEditingEndpoint({ key, value: val })}>Edit</button>
                      </div>
                    )}
                  </div>
                ))}
                {(!config.endpoints || Object.keys(config.endpoints).length === 0) && (
                  <p className="admin-empty">No endpoint config in database. Click &quot;Seed default ports &amp; endpoints&quot; above to save defaults.</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* System Logs */}
        {activeTab === 'logs' && (
          <div className="settings-panel">
            <h2>System Logs</h2>
            <p className="settings-desc">Application logs for troubleshooting. Filter by level.</p>
            <div className="settings-toolbar">
              <select value={logLevel} onChange={(e) => setLogLevel(e.target.value)} aria-label="Filter by log level">
                <option value="">All levels</option>
                <option value="error">Error</option>
                <option value="warn">Warn</option>
                <option value="info">Info</option>
                <option value="debug">Debug</option>
              </select>
              <button className="btn-secondary" onClick={loadLogs}>Refresh</button>
            </div>
            <form onSubmit={handleAddLog} className="settings-log-add">
              <input
                type="text"
                value={newLog.message}
                onChange={(e) => setNewLog({ ...newLog, message: e.target.value })}
                placeholder="Add test log message..."
                aria-label="Log message"
              />
              <select value={newLog.level} onChange={(e) => setNewLog({ ...newLog, level: e.target.value as 'info' | 'warn' | 'error' | 'debug' })} aria-label="Log level">
                <option value="info">Info</option>
                <option value="warn">Warn</option>
                <option value="error">Error</option>
                <option value="debug">Debug</option>
              </select>
              <button type="submit" className="btn-primary" disabled={addingLog || !newLog.message.trim()}>Add Log</button>
            </form>
            {logsLoading ? (
              <div className="admin-loading">Loading...</div>
            ) : (
              <div className="settings-logs">
                {logs.map((log) => (
                  <div key={log.id} className={`settings-log-item log-${log.level}`}>
                    <span className="log-time">{new Date(log.created_at).toLocaleString()}</span>
                    <span className="log-level">{log.level}</span>
                    {log.service && <span className="log-service">{log.service}</span>}
                    <span className="log-message">{log.message}</span>
                  </div>
                ))}
                {logs.length === 0 && <p className="admin-empty">No system logs</p>}
              </div>
            )}
          </div>
        )}

        {/* Audit Logs */}
        {activeTab === 'audit' && (
          <div className="settings-panel">
            <h2>Audit Logs</h2>
            <p className="settings-desc">User action history for compliance and troubleshooting.</p>
            <button className="btn-secondary" onClick={loadAuditLogs}>Refresh</button>
            <div className="settings-logs">
              {auditLogs.map((log) => (
                <div key={log.id} className="settings-log-item log-info">
                  <span className="log-time">{new Date(log.created_at).toLocaleString()}</span>
                  <span className="log-message">{log.action}</span>
                  {log.email && <span className="log-service">{log.email}</span>}
                </div>
              ))}
              {auditLogs.length === 0 && <p className="admin-empty">No audit logs</p>}
            </div>
          </div>
        )}

        {/* Maintenance */}
        {activeTab === 'maintenance' && (
          <div className="settings-panel">
            <h2>Maintenance &amp; Troubleshooting</h2>
            <p className="settings-desc">Run health checks and maintenance tasks to resolve system issues.</p>
            <div className="maintenance-health">
              <h3>Database Health</h3>
              <p className="maintenance-health-desc">Use <strong>Force Reconnect DB</strong> to refresh the connection pool after migrations or when the database shows disconnected.</p>
              {health ? (
                <div className={`health-status ${health.status === 'ok' ? 'ok' : 'error'}`}>
                  <span>{health.status === 'ok' ? '🟢' : '🔴'}</span>
                  <span>{health.status === 'ok' ? 'Connected' : 'Disconnected'}</span>
                  {health.db && <span>({health.db})</span>}
                </div>
              ) : (
                <span>—</span>
              )}
              <div className="maintenance-health-actions">
                <button className="btn-primary" onClick={() => runMaintenance('health')} disabled={maintenanceAction !== null || reconnecting}>
                  {maintenanceAction === 'health' ? 'Checking...' : 'Run Health Check'}
                </button>
                <button className="btn-reconnect" onClick={handleForceReconnectDb} disabled={reconnecting} title="Refresh database connection pool. Use after migrations or when DB shows disconnected.">
                  {reconnecting ? 'Reconnecting...' : 'Force Reconnect DB'}
                </button>
                <button
                  className="btn-alternative-db-reconnect"
                  onClick={handleAlternativeDbReconnect}
                  disabled={alternativeDbReconnecting || reconnecting}
                  title="Full procedure: check-db, docker stop postgres, docker-compose up -d. For Docker/self-hosted only. On Render/Railway use Force Reconnect DB."
                >
                  {alternativeDbReconnecting ? 'Running...' : 'Alternative DB Reconnect'}
                </button>
                <button
                  className="btn-start-dev-services"
                  onClick={handleStartDevServices}
                  disabled={startingDevServices}
                  title="Run npm run dev:services in background. Use after Alternative DB Reconnect when microservices had port conflicts."
                >
                  {startingDevServices ? 'Starting...' : 'Start Dev Services'}
                </button>
              </div>
              <p className="maintenance-health-hint">Alternative DB Reconnect: Docker/self-hosted only. Start Dev Services runs <code>npm run dev:services</code> in background (local dev only).</p>
            </div>
            <div className="maintenance-check-service">
              <h3>Check Individual Service</h3>
              <p className="settings-desc">Select a service and click Check to verify it is running.</p>
              <div className="check-service-controls">
                <select
                  value={checkServiceKey}
                  onChange={(e) => { setCheckServiceKey(e.target.value); setCheckServiceResult(null); }}
                  disabled={checkServiceLoading}
                  className="check-service-select"
                  aria-label="Select service to check"
                >
                  <option value="">— Select service —</option>
                  {serviceList.map((s) => (
                    <option key={s.key} value={s.key}>{s.name}</option>
                  ))}
                </select>
                <button
                  className="btn-primary"
                  onClick={handleCheckService}
                  disabled={!checkServiceKey || checkServiceLoading}
                >
                  {checkServiceLoading ? 'Checking...' : 'Check'}
                </button>
              </div>
              {checkServiceResult && (
                <div className={`check-service-result ${checkServiceResult.status === 'online' ? 'online' : 'offline'}`}>
                  <span>{checkServiceResult.status === 'online' ? '🟢' : '🔴'}</span>
                  <span>{checkServiceResult.name}: {checkServiceResult.status}</span>
                  {checkServiceResult.statusCode != null && <span> (HTTP {checkServiceResult.statusCode})</span>}
                  {checkServiceResult.error && <span> — {checkServiceResult.error}</span>}
                </div>
              )}
            </div>
            <div className="maintenance-actions">
              <h3>Quick Actions</h3>
              <div className="maintenance-buttons">
                <button className="btn-secondary" onClick={() => runMaintenance('clear-cache')} disabled={maintenanceAction !== null}>
                  Clear Cache
                </button>
                <button className="btn-secondary" onClick={() => runMaintenance('db-backup')} disabled={maintenanceAction !== null}>
                  Request DB Backup
                </button>
                <button className="btn-restart" onClick={openRestartModal} disabled={restarting}>
                  🔄 Restart System
                </button>
              </div>
            </div>
            <div className="maintenance-migrations">
              <h3>Database Migrations &amp; Fixes</h3>
              <p className="settings-desc">Check which migrations are applied, or run all migrations chronologically (001–013) to update the database to the latest. Safe to run multiple times (uses IF NOT EXISTS).</p>
              <div className="migration-actions migration-fix-orphans-row">
                <button
                  className="btn-fix-orphans"
                  onClick={handleFixOrphanFarmers}
                  disabled={fixingOrphans || migrating}
                  title="Create farmers rows for users with role farmer that don't have one. Use when farmers can't login."
                >
                  {fixingOrphans ? 'Fixing...' : 'Fix Orphan Farmers'}
                </button>
              </div>
              <p className="maintenance-health-hint">If farmers can&apos;t login, click <strong>Fix Orphan Farmers</strong> to create missing farmers rows.</p>
              <div className="migration-actions">
                <button
                  className="btn-secondary"
                  onClick={handleCheckMigrationStatus}
                  disabled={migrationStatusLoading || migrating}
                >
                  {migrationStatusLoading ? 'Checking...' : 'Check Migration Status'}
                </button>
                <button
                  className="btn-primary"
                  onClick={() => setMigrationConfirmOpen(true)}
                  disabled={migrating || singleMigrating}
                  title="Run migrations 001–013 in chronological order to migrate database to latest"
                >
                  {migrating ? 'Migrating...' : 'Migrate Database to Latest'}
                </button>
                <div className="single-migration-controls">
                  <select
                    value={singleMigrationFile}
                    onChange={(e) => { setSingleMigrationFile(e.target.value); setSingleMigrationResult(null); }}
                    disabled={singleMigrating || migrating}
                    className="single-migration-select"
                    aria-label="Select migration to run"
                  >
                    <option value="">— Select migration —</option>
                    {migrationListForSingle.map((f) => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                  <button
                    className="btn-primary btn-single-migrate"
                    onClick={handleRunSingleMigration}
                    disabled={!singleMigrationFile || singleMigrating || migrating}
                    title="Run a single migration file. Does not affect other migrations."
                  >
                    {singleMigrating ? 'Migrating...' : 'Single DB Migrate'}
                  </button>
                </div>
              </div>
              {singleMigrating && (
                <div className="single-migration-progress">
                  <p className="single-migration-progress-text">Running <strong>{singleMigrationFile}</strong>... Please wait.</p>
                  <div className="single-migration-progress-bar">
                    <div className="single-migration-progress-fill" />
                  </div>
                </div>
              )}
              {singleMigrationResult && !singleMigrating && (
                <div className={`single-migration-result ${singleMigrationResult.ok ? 'success' : 'error'}`}>
                  <h4>{singleMigrationResult.ok ? '✓ Single migration completed' : '✗ Single migration failed'}</h4>
                  <p className="single-migration-result-message">{singleMigrationResult.message}</p>
                  {singleMigrationResult.reconnectTip && !singleMigrationResult.ok && (
                    <p className="single-migration-result-tip">{singleMigrationResult.reconnectTip}</p>
                  )}
                  {singleMigrationResult.results && singleMigrationResult.results.length > 0 && (
                    <ul className="single-migration-results-list" aria-label="Migration result details">
                      {singleMigrationResult.results.map((r, i) => (
                        <li key={i} className={`single-migration-result-item ${r.status}`}>
                          <span>{r.status === 'ok' ? '✓' : '✗'}</span>
                          <span className="single-migration-result-file">{r.file}</span>
                          <span className="single-migration-result-detail">
                            {r.status === 'ok' ? 'OK' : (r.message || 'Failed')}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              {migrating && (
                <div className="migration-progress">
                  <p className="migration-progress-text">Migrating database chronologically to latest... Please wait.</p>
                </div>
              )}
              {migrationOverlayOpen && (
                <div className="migration-overlay">
                  <div className="migration-overlay-content">
                    {migrationList.length > 0 && (
                      <div className="migration-preview-section">
                        <h4 className="migration-preview-title">Migrations to apply (chronological)</h4>
                        <div
                          ref={migrationListScrollRef}
                          className="migration-preview-list"
                          role="list"
                          aria-label="Migration files to apply"
                        >
                          {migrationList.map((file, i) => (
                            <div key={i} className="migration-preview-item" role="listitem">
                              <span className="migration-preview-num">{String(i + 1).padStart(2, '0')}</span>
                              <span className="migration-preview-file">{file}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="migration-loading-bar">
                      <div className="migration-loading-fill" data-progress={migrationProgress} style={{ width: `${migrationProgress}%` }} />
                    </div>
                  </div>
                </div>
              )}
              {migrationResults && migrationResults.length > 0 && !migrating && (
                <div className="migration-results">
                  <h4>{migrationResults.every((r) => r.status === 'ok' || r.status === 'skipped') ? '✓ Migration results (success)' : '✗ Migration results'}</h4>
                  <ul className="migration-results-list">
                    {migrationResults.map((r, i) => (
                      <li key={i} className={`migration-result-item ${r.status}`}>
                        <span>{r.status === 'ok' ? '✓' : r.status === 'skipped' ? '○' : '✗'}</span>
                        <span>{r.file}</span>
                        <span>{r.status === 'ok' ? 'OK' : r.status === 'skipped' ? r.message || 'Skipped' : r.message || 'Failed'}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {migrationStatus && (
                <div className="migration-status-list">
                  <h4>Migration status</h4>
                  {migrationStatus.map((m) => (
                    <div key={m.id} className={`migration-status-item ${m.applied ? 'applied' : 'pending'}`}>
                      <span>{m.applied ? '✓' : '○'}</span>
                      <span>{m.name}</span>
                      <span>{m.applied ? 'Applied' : 'Pending'}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {migrationConfirmOpen && (
              <div className="admin-modal-overlay" onClick={() => setMigrationConfirmOpen(false)}>
                <div className="admin-modal migration-confirm-modal" onClick={(e) => e.stopPropagation()}>
                  <h3>Migrate Database to Latest</h3>
                  <p>This will run all migrations chronologically (001–012) to update your database to the latest schema. Safe to run multiple times. Continue?</p>
                  <div className="modal-actions">
                    <button className="btn-secondary" onClick={() => setMigrationConfirmOpen(false)}>Cancel</button>
                    <button className="btn-primary" onClick={handleRunMigrations}>Migrate to Latest</button>
                  </div>
                </div>
              </div>
            )}
            <div className="maintenance-rebuild">
              <h3>Rebuild Admin Service</h3>
              <p className="settings-desc">Rebuild the admin-service Docker image with <code>--no-cache</code> and restart. Use when migrations or settings routes return &quot;Cannot POST&quot; or &quot;Preflight check failed&quot;.</p>
              {rebuildConfig && (
                <p className="rebuild-project-dir" title={rebuildConfig.projectDir}>
                  Project dir: <code>{rebuildConfig.projectDir}</code>
                </p>
              )}
              <div className="rebuild-admin-buttons">
                <button
                  className="btn-rebuild-admin"
                  onClick={handleRebuildAdminService}
                  disabled={rebuilding}
                  title="Runs: docker compose build --no-cache admin-service && docker compose up -d admin-service"
                >
                  {rebuilding ? 'Rebuilding...' : 'Rebuild Admin Service'}
                </button>
                <button
                  className="btn-manual-rebuild"
                  onClick={handleRunManualRebuild}
                  disabled={rebuilding}
                  title="Runs procedurally: cd to project dir, docker compose build --no-cache admin-service, docker compose up -d admin-service. Use when rebuild is not configured."
                >
                  {rebuilding ? 'Rebuilding...' : 'Run Manual Rebuild'}
                </button>
              </div>
            </div>
            <div className="maintenance-rebuild maintenance-rebuild-other">
              <h3>Rebuild Other Service</h3>
              <p className="settings-desc">Rebuild any service with <code>--no-cache</code>. Use when a service has outdated code.</p>
              <div className="rebuild-controls">
                <select
                  value={rebuildService}
                  onChange={(e) => setRebuildService(e.target.value)}
                  aria-label="Select service to rebuild"
                  className="rebuild-select"
                >
                  <option value="">Select service...</option>
                  <option value="auth-service">auth-service</option>
                  <option value="api-gateway">api-gateway</option>
                  <option value="farmer-service">farmer-service</option>
                  <option value="admin-service">admin-service</option>
                  <option value="device-service">device-service</option>
                  <option value="system-service">system-service</option>
                </select>
                <button
                  className="btn-primary"
                  onClick={() => handleRebuildService()}
                  disabled={rebuilding || !rebuildService}
                >
                  {rebuilding ? 'Rebuilding...' : 'Rebuild & Restart'}
                </button>
                <button
                  className="btn-manual-rebuild"
                  onClick={handleRunManualRebuild}
                  disabled={rebuilding}
                  title="Runs procedurally: cd to project dir, docker compose build --no-cache admin-service, docker compose up -d admin-service"
                >
                  {rebuilding ? 'Rebuilding...' : 'Run Manual Rebuild'}
                </button>
              </div>
            </div>
            <div className="maintenance-tips">
              <h3>Troubleshooting Tips</h3>
              <ul>
                <li><strong>Run commands without external terminal:</strong> Use the <button type="button" className="link-btn" onClick={handleMaintenanceTerminalLink}>Terminal</button> tab to run bash/PowerShell commands from the UI.</li>
                <li><strong>Farmer can&apos;t login / farmer table missing data:</strong> Click <strong>Fix Orphan Farmers</strong> to create farmers rows for users with role farmer that don&apos;t have one.</li>
                <li><strong>Database connection failed:</strong> Click <strong>Alternative DB Reconnect</strong> to run the full procedure (check-db, docker stop postgres, docker-compose up -d). If port conflicts occur, it will stop containers and retry. For local dev, run <code>npm run dev:services</code> after.</li>
                <li><strong>API Gateway timeout:</strong> Ensure all microservices (auth, farmer, admin, system) are running.</li>
                <li><strong>Sensor/Robot not responding:</strong> Verify device is initialized and configured in admin Sensors/Robots pages.</li>
                <li><strong>Farmer app cannot connect:</strong> Confirm REACT_APP_API_URL points to API Gateway (e.g. http://localhost:5001).</li>
                <li><strong>Request Farmer Access fails / 404:</strong> Rebuild auth-service (above) or run: <code>docker compose build --no-cache auth-service &amp;&amp; docker compose up -d auth-service</code></li>
                <li><strong>Missing tables / Run migration X first:</strong> Click &quot;Run Full Database Migrations&quot; above, or run migrations manually via psql.</li>
                <li><strong>Run migrations failed / DB disconnected after migration:</strong> Click &quot;Force Reconnect&quot; to refresh the connection, then run migrations again.</li>
              </ul>
            </div>
          </div>
        )}

        {/* Terminal - run bash/powershell commands for troubleshooting */}
        {activeTab === 'terminal' && (
          <div className="settings-panel terminal-panel">
            <h2>Terminal</h2>
            <p className="settings-desc">Run shell commands for troubleshooting and maintenance. Commands run from project root. Windows: PowerShell. Linux/Mac: bash. Disabled on Render/Railway.</p>
            <div className="terminal-container">
              <div className="terminal-output" ref={terminalOutputRef}>
                {terminalOutput.length === 0 ? (
                  <div className="terminal-placeholder">Enter a command below and press Run or Enter. Do not type the $ prompt. Example: npm run check-db</div>
                ) : (
                  terminalOutput.map((line, i) => (
                    <div key={i} className={`terminal-line ${line.startsWith('$ ') ? 'terminal-prompt' : line.startsWith('[stderr]') ? 'terminal-stderr' : ''}`}>
                      {line}
                    </div>
                  ))
                )}
              </div>
              <form className="terminal-input-row" onSubmit={handleRunTerminalCommand}>
                <span className="terminal-prompt-char">$</span>
                <input
                  type="text"
                  value={terminalCommand}
                  onChange={(e) => setTerminalCommand(e.target.value)}
                  placeholder="Enter command..."
                  className="terminal-input"
                  disabled={terminalRunning}
                  aria-label="Terminal command"
                  autoComplete="off"
                />
                <button type="submit" className="btn-primary terminal-run-btn" disabled={terminalRunning || !terminalCommand.trim()}>
                  {terminalRunning ? 'Running...' : 'Run'}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setTerminalOutput([])}
                  title="Clear output"
                >
                  Clear
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Restart confirmation modal - 3 steps */}
        {restartStep > 0 && (
          <div className="admin-modal-overlay restart-modal-overlay" onClick={() => restartStep < 3 && closeRestartModal()}>
            <div className="admin-modal restart-modal" onClick={(e) => e.stopPropagation()}>
              <h3>⚠️ System Restart</h3>
              {restartStep === 1 && (
                <>
                  <p className="restart-warning-text">
                    <strong>Step 1 of 3:</strong> Are you sure you want to restart the entire system?
                  </p>
                  <p className="restart-detail">This will restart all microservices (API Gateway, Auth, Farmer, Admin, System, etc.). Active user sessions will be disconnected.</p>
                  <div className="admin-form-actions">
                    <button type="button" className="btn-primary" onClick={handleRestartStep}>I understand, continue</button>
                    <button type="button" className="btn-secondary" onClick={closeRestartModal}>Cancel</button>
                  </div>
                </>
              )}
              {restartStep === 2 && (
                <>
                  <p className="restart-warning-text">
                    <strong>Step 2 of 3:</strong> Final warning
                  </p>
                  <p className="restart-detail">This action cannot be undone. All services will be stopped and restarted. Estimated downtime: 30–60 seconds. Farmers and admins will need to log in again.</p>
                  <div className="admin-form-actions">
                    <button type="button" className="btn-primary" onClick={handleRestartStep}>I accept the risk, proceed</button>
                    <button type="button" className="btn-secondary" onClick={closeRestartModal}>Cancel</button>
                  </div>
                </>
              )}
              {restartStep === 3 && (
                <>
                  <p className="restart-warning-text">
                    <strong>Step 3 of 3:</strong> Type RESTART to confirm
                  </p>
                  <p className="restart-detail">To prevent accidental restarts, type <strong>RESTART</strong> (all caps) in the box below.</p>
                  <div className="admin-form-field">
                    <input
                      type="text"
                      value={restartConfirmText}
                      onChange={(e) => setRestartConfirmText(e.target.value)}
                      placeholder="Type RESTART here"
                      aria-label="Type RESTART to confirm"
                      className="restart-confirm-input"
                      autoComplete="off"
                    />
                  </div>
                  <div className="admin-form-actions">
                    <button
                      type="button"
                      className="btn-restart-confirm"
                      onClick={handleRestartConfirm}
                      disabled={restarting || restartConfirmText.toUpperCase() !== 'RESTART'}
                    >
                      {restarting ? 'Restarting...' : 'Confirm & Restart System'}
                    </button>
                    <button type="button" className="btn-secondary" onClick={closeRestartModal}>Cancel</button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="admin-footer">
        <span onClick={() => navigate('/')}>🏠 Dashboard</span>
        <span onClick={() => navigate('/farmers')}>👥 Farmers</span>
        <span onClick={() => navigate('/farms')}>🌾 Farms</span>
        <span onClick={() => navigate('/crops')}>🌱 Crops</span>
        <span onClick={() => navigate('/analytics')}>📊 Analytics</span>
        <span onClick={() => navigate('/sensors')}>📡 Sensors</span>
        <span onClick={() => navigate('/robots')}>🤖 Robots</span>
        <span className="active">⚙️ Settings</span>
        <span onClick={() => navigate('/users')}>👤 Admin Users</span>
      </div>
    </div>
  );
};

export default SettingsView;
