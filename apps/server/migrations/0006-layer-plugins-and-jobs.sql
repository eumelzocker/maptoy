CREATE TABLE layer_instances (
  id TEXT PRIMARY KEY,
  map_set_id TEXT REFERENCES map_sets(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  plugin_id TEXT NOT NULL,
  plugin_version TEXT NOT NULL,
  schema_version INTEGER NOT NULL,
  configuration_json TEXT NOT NULL,
  data_json TEXT NOT NULL,
  visible INTEGER NOT NULL CHECK (visible IN (0, 1)),
  display_order INTEGER NOT NULL,
  opacity REAL NOT NULL CHECK (opacity >= 0 AND opacity <= 1),
  minimum_zoom REAL,
  maximum_zoom REAL,
  status TEXT NOT NULL CHECK (
    status IN ('ready', 'plugin-missing', 'incompatible', 'migration-failed')
  ),
  diagnostic TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (
    minimum_zoom IS NULL OR maximum_zoom IS NULL OR minimum_zoom <= maximum_zoom
  )
) STRICT;

CREATE INDEX layer_instances_map_set_order_index
  ON layer_instances(map_set_id, display_order, created_at);
CREATE INDEX layer_instances_plugin_index
  ON layer_instances(plugin_id);

CREATE TABLE layer_instance_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  layer_id TEXT NOT NULL REFERENCES layer_instances(id) ON DELETE CASCADE,
  plugin_version TEXT NOT NULL,
  schema_version INTEGER NOT NULL,
  configuration_json TEXT NOT NULL,
  data_json TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL
) STRICT;

CREATE INDEX layer_instance_versions_layer_index
  ON layer_instance_versions(layer_id, id DESC);

CREATE TABLE layer_assets (
  id TEXT PRIMARY KEY,
  layer_id TEXT NOT NULL REFERENCES layer_instances(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('managed', 'external-image')),
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
  bounds_json TEXT,
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
    kind <> 'external-image' OR
    (source_root_id IS NOT NULL AND relative_path IS NOT NULL)
  )
) STRICT;

CREATE UNIQUE INDEX layer_assets_external_source_index
  ON layer_assets(layer_id, source_root_id, relative_path)
  WHERE kind = 'external-image';
CREATE INDEX layer_assets_layer_status_index
  ON layer_assets(layer_id, status, relative_path);

CREATE TABLE jobs (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (
    type IN ('image-scan', 'tile-download', 'map-export')
  ),
  status TEXT NOT NULL CHECK (
    status IN ('queued', 'running', 'paused', 'completed', 'failed', 'cancelled')
  ),
  input_json TEXT NOT NULL,
  total INTEGER NOT NULL DEFAULT 0,
  completed INTEGER NOT NULL DEFAULT 0,
  skipped INTEGER NOT NULL DEFAULT 0,
  failed INTEGER NOT NULL DEFAULT 0,
  summary_json TEXT NOT NULL DEFAULT '{}',
  last_error TEXT,
  created_at TEXT NOT NULL,
  started_at TEXT,
  updated_at TEXT NOT NULL,
  finished_at TEXT
) STRICT;

CREATE INDEX jobs_status_created_index ON jobs(status, created_at);
