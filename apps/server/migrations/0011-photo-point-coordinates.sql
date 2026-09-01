CREATE TABLE layer_assets_point_coordinates (
  id TEXT PRIMARY KEY,
  layer_id TEXT NOT NULL REFERENCES layer_instances(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('managed', 'external-photo')),
  status TEXT NOT NULL CHECK (
    status IN ('pending', 'ready', 'changed', 'missing', 'failed')
  ),
  file_name TEXT NOT NULL,
  content_type TEXT,
  byte_length INTEGER,
  content_hash TEXT,
  managed_path TEXT,
  preview_path TEXT,
  source_root_id TEXT,
  relative_path TEXT,
  source_modified_at TEXT,
  source_fingerprint TEXT,
  width INTEGER,
  height INTEGER,
  longitude REAL,
  latitude REAL,
  coordinate_source TEXT NOT NULL CHECK (
    coordinate_source IN ('exif', 'manual', 'none')
  ),
  metadata_json TEXT NOT NULL,
  error_code TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (
    (longitude IS NULL AND latitude IS NULL) OR
    (longitude IS NOT NULL AND latitude IS NOT NULL)
  ),
  CHECK (
    kind <> 'external-photo' OR
    (source_root_id IS NOT NULL AND relative_path IS NOT NULL)
  )
) STRICT;

INSERT INTO layer_assets_point_coordinates (
  id, layer_id, kind, status, file_name, content_type, byte_length,
  content_hash, managed_path, preview_path, source_root_id, relative_path,
  source_modified_at, source_fingerprint, width, height, longitude, latitude,
  coordinate_source, metadata_json, error_code, error_message, created_at,
  updated_at
)
SELECT
  id, layer_id, kind, status, file_name, content_type, byte_length,
  content_hash, managed_path, preview_path, source_root_id, relative_path,
  source_modified_at, source_fingerprint, width, height, longitude, latitude,
  coordinate_source, metadata_json, error_code, error_message, created_at,
  updated_at
FROM layer_assets;

DROP TABLE layer_assets;
ALTER TABLE layer_assets_point_coordinates RENAME TO layer_assets;

CREATE UNIQUE INDEX layer_assets_external_source_index
  ON layer_assets(layer_id, source_root_id, relative_path)
  WHERE kind = 'external-photo';
CREATE INDEX layer_assets_layer_status_index
  ON layer_assets(layer_id, status, relative_path);
