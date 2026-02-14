-- Migration: Add name and phone to users, enforce role constraint
-- Run: psql -U kfiot -d kenya_farm_iot -f 001_add_users_name_phone.sql

ALTER TABLE users ADD COLUMN IF NOT EXISTS name VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20);
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('farmer', 'admin'));
