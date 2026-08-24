CREATE TABLE map_sets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  source_type TEXT NOT NULL,
  url_template TEXT NOT NULL,
  attribution TEXT NOT NULL,
  terms_url TEXT NOT NULL,
  notes TEXT NOT NULL,
  terms_reviewed_at TEXT NOT NULL,
  min_zoom INTEGER NOT NULL,
  max_zoom INTEGER NOT NULL,
  tile_size INTEGER NOT NULL,
  tile_format TEXT NOT NULL,
  subdomains_json TEXT NOT NULL,
  headers_json TEXT NOT NULL,
  source_projection TEXT NOT NULL,
  default_longitude REAL NOT NULL,
  default_latitude REAL NOT NULL,
  default_zoom REAL NOT NULL,
  renderer_id TEXT NOT NULL,
  capabilities_json TEXT NOT NULL,
  cache_policy_json TEXT NOT NULL,
  download_policy_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE INDEX map_sets_name_index ON map_sets(name COLLATE NOCASE);

CREATE TABLE logical_tiles (
  id INTEGER PRIMARY KEY,
  map_set_id TEXT NOT NULL REFERENCES map_sets(id) ON DELETE CASCADE,
  zoom INTEGER NOT NULL,
  tile_x INTEGER NOT NULL,
  tile_y INTEGER NOT NULL,
  current_revision_id TEXT,
  UNIQUE (map_set_id, zoom, tile_x, tile_y)
) STRICT;

CREATE INDEX logical_tiles_map_set_zoom_index
  ON logical_tiles(map_set_id, zoom);

CREATE TABLE tile_revisions (
  id TEXT PRIMARY KEY,
  logical_tile_id INTEGER NOT NULL REFERENCES logical_tiles(id) ON DELETE CASCADE,
  content_hash TEXT NOT NULL,
  file_path TEXT NOT NULL,
  content_type TEXT NOT NULL,
  byte_length INTEGER NOT NULL,
  etag TEXT,
  last_modified TEXT,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  last_validated_at TEXT NOT NULL,
  selected_from TEXT NOT NULL,
  selected_until TEXT,
  validation_status TEXT NOT NULL CHECK (validation_status IN ('valid'))
) STRICT;

CREATE INDEX tile_revisions_logical_time_index
  ON tile_revisions(logical_tile_id, selected_from, selected_until);
CREATE INDEX tile_revisions_file_path_index ON tile_revisions(file_path);

CREATE TABLE cache_snapshots (
  id TEXT PRIMARY KEY,
  map_set_id TEXT NOT NULL REFERENCES map_sets(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (map_set_id, name)
) STRICT;

CREATE TABLE cache_snapshot_tiles (
  snapshot_id TEXT NOT NULL REFERENCES cache_snapshots(id) ON DELETE CASCADE,
  tile_revision_id TEXT NOT NULL REFERENCES tile_revisions(id) ON DELETE RESTRICT,
  PRIMARY KEY (snapshot_id, tile_revision_id)
) STRICT;
