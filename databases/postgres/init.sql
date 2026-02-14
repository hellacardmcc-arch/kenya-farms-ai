-- Kenya Farm IoT - PostgreSQL Schema
-- Used by: auth-service, farmer-service, admin-service

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  phone VARCHAR(20),
  role VARCHAR(50) NOT NULL DEFAULT 'farmer' CHECK (role IN ('farmer', 'admin')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

CREATE TABLE farmers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255),
  phone VARCHAR(20),
  region VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_farmers_user_id ON farmers(user_id);

CREATE TABLE farms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  farmer_id UUID NOT NULL REFERENCES farmers(id) ON DELETE CASCADE,
  name VARCHAR(255),
  location VARCHAR(255),
  area_hectares DECIMAL(10,2) CHECK (area_hectares >= 0),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_farms_farmer_id ON farms(farmer_id);

CREATE TABLE crops (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  swahili_name VARCHAR(100),
  planted_date DATE,
  harvest_date DATE,
  area_hectares DECIMAL(10,2) CHECK (area_hectares >= 0),
  status VARCHAR(50) DEFAULT 'growing',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_crops_farm_id ON crops(farm_id);

CREATE TABLE watering_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  crop_id UUID REFERENCES crops(id) ON DELETE CASCADE,
  farm_id UUID REFERENCES farms(id) ON DELETE CASCADE,
  amount_mm INT,
  scheduled_time TIME,
  completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  farmer_id UUID REFERENCES farmers(id) ON DELETE CASCADE,
  severity VARCHAR(20) CHECK (severity IN ('high', 'medium', 'low', 'info')),
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_alerts_farmer_id ON alerts(farmer_id);

-- Partitioned audit logs (by date for scaling)
CREATE TABLE audit_logs (
  id UUID DEFAULT uuid_generate_v4(),
  action VARCHAR(50) NOT NULL,
  user_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB,
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Create monthly partitions (extend as needed)
CREATE TABLE audit_logs_y2025m01 PARTITION OF audit_logs
  FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
CREATE TABLE audit_logs_y2025m02 PARTITION OF audit_logs
  FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');
CREATE TABLE audit_logs_default PARTITION OF audit_logs DEFAULT;
