-- Migration: Add crops, watering_tasks, alerts tables
-- Run: Get-Content migrations/002_add_crops_tasks_alerts.sql | docker exec -i kenya-farm-iot-postgres-1 psql -U kfiot -d kenya_farm_iot

CREATE TABLE IF NOT EXISTS crops (
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
CREATE INDEX IF NOT EXISTS idx_crops_farm_id ON crops(farm_id);

CREATE TABLE IF NOT EXISTS watering_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  crop_id UUID REFERENCES crops(id) ON DELETE CASCADE,
  farm_id UUID REFERENCES farms(id) ON DELETE CASCADE,
  amount_mm INT,
  scheduled_time TIME,
  completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  farmer_id UUID REFERENCES farmers(id) ON DELETE CASCADE,
  severity VARCHAR(20) CHECK (severity IN ('high', 'medium', 'low', 'info')),
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_alerts_farmer_id ON alerts(farmer_id);
