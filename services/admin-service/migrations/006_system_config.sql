-- System configuration for ports, endpoints, and maintenance settings
CREATE TABLE IF NOT EXISTS system_config (
  key VARCHAR(100) PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}',
  description VARCHAR(255),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- Add columns if system_config was created by 003 (key, value TEXT only)
ALTER TABLE system_config ADD COLUMN IF NOT EXISTS description VARCHAR(255);
ALTER TABLE system_config ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- System logs for troubleshooting (errors, warnings, maintenance events)
CREATE TABLE IF NOT EXISTS system_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  level VARCHAR(20) NOT NULL CHECK (level IN ('info', 'warn', 'error', 'debug')),
  service VARCHAR(50),
  message TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON system_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_logs_level ON system_logs(level);
CREATE INDEX IF NOT EXISTS idx_system_logs_service ON system_logs(service);

-- Seed default config
INSERT INTO system_config (key, value, description) VALUES
  ('ports', '{"api_gateway": 5001, "auth": 5002, "farmer": 4002, "device": 4003, "analytics": 4004, "notification": 4005, "admin": 4006, "system": 4007}', 'Service ports'),
  ('endpoints', '{"api_gateway": "http://localhost:5001", "auth": "http://localhost:5002", "farmer": "http://localhost:4002", "device": "http://localhost:4003", "analytics": "http://localhost:4004", "notification": "http://localhost:4005", "admin": "http://localhost:4006", "system": "http://localhost:4007"}', 'Service base URLs')
ON CONFLICT (key) DO NOTHING;
