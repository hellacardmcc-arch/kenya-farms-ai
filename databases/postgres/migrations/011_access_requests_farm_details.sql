-- Migration 011: Add farm location and coordinates to access_requests
ALTER TABLE access_requests ADD COLUMN IF NOT EXISTS farm_location VARCHAR(255);
ALTER TABLE access_requests ADD COLUMN IF NOT EXISTS farm_latitude DECIMAL(10, 7);
ALTER TABLE access_requests ADD COLUMN IF NOT EXISTS farm_longitude DECIMAL(10, 7);
