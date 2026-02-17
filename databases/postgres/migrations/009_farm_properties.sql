-- Migration 009: Farm properties - unique code, coordinates
-- Adds unique_code (global identifier), latitude, longitude to farms

ALTER TABLE farms ADD COLUMN IF NOT EXISTS unique_code VARCHAR(50) UNIQUE;
ALTER TABLE farms ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 7);
ALTER TABLE farms ADD COLUMN IF NOT EXISTS longitude DECIMAL(10, 7);

-- Backfill unique_code for existing farms (use id to ensure uniqueness)
UPDATE farms SET unique_code = 'FARM-' || UPPER(SUBSTRING(REPLACE(id::text, '-', '') FROM 1 FOR 12)) WHERE unique_code IS NULL;

-- Trigger for new rows (single line to avoid migration split on ;)
CREATE OR REPLACE FUNCTION generate_farm_unique_code() RETURNS TRIGGER AS $trg$ BEGIN IF NEW.unique_code IS NULL OR NEW.unique_code = '' THEN NEW.unique_code := 'FARM-' || UPPER(SUBSTRING(REPLACE(uuid_generate_v4()::text, '-', '') FROM 1 FOR 12)); END IF; RETURN NEW; END; $trg$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_farm_unique_code ON farms;
CREATE TRIGGER trg_farm_unique_code BEFORE INSERT ON farms FOR EACH ROW EXECUTE FUNCTION generate_farm_unique_code();
