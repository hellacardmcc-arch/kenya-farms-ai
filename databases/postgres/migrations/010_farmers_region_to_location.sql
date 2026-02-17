-- Migration 010: Ensure farmers has location column
-- init.sql uses location; older schemas may have region. Add location if missing.
ALTER TABLE farmers ADD COLUMN IF NOT EXISTS location VARCHAR(100);
