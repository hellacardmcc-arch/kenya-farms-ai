-- Migration 008: Crop yield records (past yields) and expected yield on crops
-- Add expected/projected yield to crops (this season)
ALTER TABLE crops ADD COLUMN IF NOT EXISTS expected_yield_kg DECIMAL(12,2);
ALTER TABLE crops ADD COLUMN IF NOT EXISTS actual_yield_kg DECIMAL(12,2);

-- Past yield records per farm per season
CREATE TABLE IF NOT EXISTS crop_yield_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  crop_id UUID REFERENCES crops(id) ON DELETE CASCADE,
  farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  season_year INT NOT NULL,
  season_label VARCHAR(100),
  harvest_date DATE,
  actual_yield_kg DECIMAL(12,2) NOT NULL,
  unit VARCHAR(20) DEFAULT 'kg',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crop_yield_records_farm_id ON crop_yield_records(farm_id);
CREATE INDEX IF NOT EXISTS idx_crop_yield_records_crop_id ON crop_yield_records(crop_id);
CREATE INDEX IF NOT EXISTS idx_crop_yield_records_season ON crop_yield_records(season_year, farm_id);
