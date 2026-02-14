-- Add soft delete support for farmers and crops
ALTER TABLE farmers ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE crops ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_farmers_deleted_at ON farmers(deleted_at);
CREATE INDEX IF NOT EXISTS idx_crops_deleted_at ON crops(deleted_at);
