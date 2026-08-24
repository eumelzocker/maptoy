ALTER TABLE tile_revisions
  ADD COLUMN origin TEXT NOT NULL DEFAULT 'provider'
  CHECK (origin IN ('provider', 'upload'));
