-- System config, sensors, robots for system-service
CREATE TABLE IF NOT EXISTS system_config (
  key VARCHAR(100) PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS system_sensors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  farm_id UUID REFERENCES farms(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  type VARCHAR(50),
  value DECIMAL(10,2),
  unit VARCHAR(20),
  status VARCHAR(20) DEFAULT 'online',
  last_reading_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS system_robots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  farmer_id UUID REFERENCES farmers(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  type VARCHAR(50),
  status VARCHAR(20) DEFAULT 'idle',
  battery INT,
  last_active TIMESTAMPTZ
);
