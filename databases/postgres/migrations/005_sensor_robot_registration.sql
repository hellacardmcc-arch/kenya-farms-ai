-- Sensor and Robot registration, initialization, configuration, and activation
-- Run: Get-Content migrations/005_sensor_robot_registration.sql | docker exec -i kenya-farm-iot-postgres-1 psql -U kfiot -d kenya_farm_iot

-- Sensors: device_id, registration_status, server_config for registration flow
ALTER TABLE system_sensors ADD COLUMN IF NOT EXISTS device_id VARCHAR(100) UNIQUE;
ALTER TABLE system_sensors ADD COLUMN IF NOT EXISTS registration_status VARCHAR(20) DEFAULT 'registered' CHECK (registration_status IN ('registered', 'initialized', 'configured', 'active'));
ALTER TABLE system_sensors ADD COLUMN IF NOT EXISTS server_config JSONB;
ALTER TABLE system_sensors ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_sensors_device_id ON system_sensors(device_id);
CREATE INDEX IF NOT EXISTS idx_sensors_registration_status ON system_sensors(registration_status);

-- Robots: device_id, registration_status, server_config for registration flow
ALTER TABLE system_robots ADD COLUMN IF NOT EXISTS device_id VARCHAR(100) UNIQUE;
ALTER TABLE system_robots ADD COLUMN IF NOT EXISTS registration_status VARCHAR(20) DEFAULT 'registered' CHECK (registration_status IN ('registered', 'initialized', 'configured', 'active'));
ALTER TABLE system_robots ADD COLUMN IF NOT EXISTS server_config JSONB;
ALTER TABLE system_robots ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_robots_device_id ON system_robots(device_id);
CREATE INDEX IF NOT EXISTS idx_robots_registration_status ON system_robots(registration_status);
