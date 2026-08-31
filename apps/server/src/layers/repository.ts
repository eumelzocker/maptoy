import type { DatabaseSync } from "node:sqlite";
import type {
  CoordinateSource,
  Job,
  JobError,
  Layer,
  LayerAsset,
  LayerStatus,
} from "@maptoy/contracts";

interface LayerRow {
  id: string;
  name: string;
  plugin_id: string;
  plugin_version: string;
  schema_version: number;
  configuration_json: string;
  data_json: string;
  visible: number;
  display_order: number;
  opacity: number;
  minimum_zoom: number | null;
  maximum_zoom: number | null;
  status: LayerStatus;
  diagnostic: string | null;
  created_at: string;
  updated_at: string;
}

interface AssetRow {
  id: string;
  layer_id: string;
  kind: "managed" | "external-photo";
  status: LayerAsset["status"];
  file_name: string;
  content_type: string | null;
  byte_length: number | null;
  content_hash: string | null;
  managed_path: string | null;
  preview_path: string | null;
  source_root_id: string | null;
  relative_path: string | null;
  source_modified_at: string | null;
  source_fingerprint: string | null;
  width: number | null;
  height: number | null;
  longitude: number | null;
  latitude: number | null;
  coordinate_source: CoordinateSource;
  bounds_json: string | null;
  metadata_json: string;
  error_code: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

interface JobRow {
  id: string;
  type: Job["type"];
  status: Job["status"];
  input_json: string;
  total: number;
  completed: number;
  skipped: number;
  failed: number;
  summary_json: string;
  last_error: string | null;
  created_at: string;
  started_at: string | null;
  updated_at: string;
  finished_at: string | null;
}

interface JobErrorRow {
  id: number;
  code: string;
  message: string;
  item: string | null;
  created_at: string;
}

export interface StoredLayerAsset extends LayerAsset {
  sourceRootId: string | null;
  managedPath: string | null;
  previewPath: string | null;
  sourceFingerprint: string | null;
  metadata: Readonly<Record<string, unknown>>;
}

function layerFromRow(row: LayerRow): Layer {
  return {
    id: row.id,
    name: row.name,
    pluginId: row.plugin_id,
    pluginVersion: row.plugin_version,
    schemaVersion: row.schema_version,
    configuration: JSON.parse(row.configuration_json) as Record<
      string,
      unknown
    >,
    data: JSON.parse(row.data_json) as Record<string, unknown>,
    visible: row.visible === 1,
    displayOrder: row.display_order,
    opacity: row.opacity,
    minimumZoom: row.minimum_zoom,
    maximumZoom: row.maximum_zoom,
    status: row.status,
    diagnostic: row.diagnostic,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function assetFromRow(row: AssetRow): StoredLayerAsset {
  return {
    id: row.id,
    layerId: row.layer_id,
    kind: row.kind,
    status: row.status,
    fileName: row.file_name,
    contentType: row.content_type,
    byteLength: row.byte_length,
    contentHash: row.content_hash,
    sourceRootId: row.source_root_id,
    relativePath: row.relative_path,
    sourceModifiedAt: row.source_modified_at,
    width: row.width,
    height: row.height,
    longitude: row.longitude,
    latitude: row.latitude,
    coordinateSource: row.coordinate_source,
    bounds:
      row.bounds_json === null
        ? null
        : (JSON.parse(row.bounds_json) as LayerAsset["bounds"]),
    previewAvailable: row.preview_path !== null,
    errorCode: row.error_code,
    errorMessage: row.error_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    managedPath: row.managed_path,
    previewPath: row.preview_path,
    sourceFingerprint: row.source_fingerprint,
    metadata: JSON.parse(row.metadata_json) as Record<string, unknown>,
  };
}

function jobFromRow(row: JobRow): Job {
  return {
    id: row.id,
    type: row.type,
    status: row.status,
    input: JSON.parse(row.input_json) as Record<string, unknown>,
    total: row.total,
    completed: row.completed,
    skipped: row.skipped,
    failed: row.failed,
    summary: JSON.parse(row.summary_json) as Record<string, number>,
    lastError: row.last_error,
    createdAt: row.created_at,
    startedAt: row.started_at,
    updatedAt: row.updated_at,
    finishedAt: row.finished_at,
  };
}

const layerColumns = `
  id, name, plugin_id, plugin_version, schema_version,
  configuration_json, data_json, visible, display_order, opacity,
  minimum_zoom, maximum_zoom, status, diagnostic, created_at, updated_at
`;

const assetColumns = `
  id, layer_id, kind, status, file_name, content_type, byte_length,
  content_hash, managed_path, preview_path, source_root_id, relative_path,
  source_modified_at, source_fingerprint, width, height, longitude, latitude,
  coordinate_source, bounds_json, metadata_json, error_code, error_message,
  created_at, updated_at
`;

const jobColumns = `
  id, type, status, input_json, total, completed, skipped, failed,
  summary_json, last_error, created_at, started_at, updated_at, finished_at
`;

export class LayerRepository {
  constructor(private readonly database: DatabaseSync) {}

  list(): Layer[] {
    const rows = this.database
      .prepare(
        `SELECT ${layerColumns} FROM layer_instances
         ORDER BY display_order, name COLLATE NOCASE, id`,
      )
      .all();
    return (rows as unknown as LayerRow[]).map(layerFromRow);
  }

  get(id: string): Layer | undefined {
    const row = this.database
      .prepare(`SELECT ${layerColumns} FROM layer_instances WHERE id = ?`)
      .get(id) as LayerRow | undefined;
    return row === undefined ? undefined : layerFromRow(row);
  }

  insert(layer: Layer): void {
    this.database
      .prepare(
        `INSERT INTO layer_instances (
          ${layerColumns}
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        layer.id,
        layer.name,
        layer.pluginId,
        layer.pluginVersion,
        layer.schemaVersion,
        JSON.stringify(layer.configuration),
        JSON.stringify(layer.data),
        layer.visible ? 1 : 0,
        layer.displayOrder,
        layer.opacity,
        layer.minimumZoom,
        layer.maximumZoom,
        layer.status,
        layer.diagnostic,
        layer.createdAt,
        layer.updatedAt,
      );
  }

  update(layer: Layer): void {
    const result = this.database
      .prepare(
        `UPDATE layer_instances SET
          name = ?, plugin_id = ?, plugin_version = ?,
          schema_version = ?, configuration_json = ?, data_json = ?,
          visible = ?, display_order = ?, opacity = ?, minimum_zoom = ?,
          maximum_zoom = ?, status = ?, diagnostic = ?, updated_at = ?
         WHERE id = ?`,
      )
      .run(
        layer.name,
        layer.pluginId,
        layer.pluginVersion,
        layer.schemaVersion,
        JSON.stringify(layer.configuration),
        JSON.stringify(layer.data),
        layer.visible ? 1 : 0,
        layer.displayOrder,
        layer.opacity,
        layer.minimumZoom,
        layer.maximumZoom,
        layer.status,
        layer.diagnostic,
        layer.updatedAt,
        layer.id,
      );
    if (result.changes !== 1) {
      throw new Error("Layer update did not affect exactly one row.");
    }
  }

  updateWithMigrationBackup(previous: Layer, updated: Layer): void {
    this.database.exec("BEGIN IMMEDIATE");
    try {
      this.database
        .prepare(
          `INSERT INTO layer_instance_versions (
            layer_id, plugin_version, schema_version, configuration_json,
            data_json, opacity, reason, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, 'plugin-migration', ?)`,
        )
        .run(
          previous.id,
          previous.pluginVersion,
          previous.schemaVersion,
          JSON.stringify(previous.configuration),
          JSON.stringify(previous.data),
          previous.opacity,
          new Date().toISOString(),
        );
      this.update(updated);
      this.database.exec("COMMIT");
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }

  delete(id: string): boolean {
    return (
      this.database.prepare("DELETE FROM layer_instances WHERE id = ?").run(id)
        .changes === 1
    );
  }

  listAssets(
    layerId: string,
    limit = 200,
    afterId?: string,
  ): StoredLayerAsset[] {
    const rows =
      afterId === undefined
        ? this.database
            .prepare(
              `SELECT ${assetColumns} FROM layer_assets
               WHERE layer_id = ? ORDER BY id LIMIT ?`,
            )
            .all(layerId, limit)
        : this.database
            .prepare(
              `SELECT ${assetColumns} FROM layer_assets
               WHERE layer_id = ? AND id > ? ORDER BY id LIMIT ?`,
            )
            .all(layerId, afterId, limit);
    return (rows as unknown as AssetRow[]).map(assetFromRow);
  }

  listAllAssets(layerId: string): StoredLayerAsset[] {
    return (
      this.database
        .prepare(
          `SELECT ${assetColumns} FROM layer_assets
           WHERE layer_id = ? ORDER BY id`,
        )
        .all(layerId) as unknown as AssetRow[]
    ).map(assetFromRow);
  }

  listExternalPhotos(layerId: string): StoredLayerAsset[] {
    return (
      this.database
        .prepare(
          `SELECT ${assetColumns} FROM layer_assets
           WHERE layer_id = ? AND source_root_id = ? ORDER BY relative_path`,
        )
        .all(layerId, "photos") as unknown as AssetRow[]
    ).map(assetFromRow);
  }

  getAsset(id: string): StoredLayerAsset | undefined {
    const row = this.database
      .prepare(`SELECT ${assetColumns} FROM layer_assets WHERE id = ?`)
      .get(id) as AssetRow | undefined;
    return row === undefined ? undefined : assetFromRow(row);
  }

  getExternalPhoto(
    layerId: string,
    relativePath: string,
  ): StoredLayerAsset | undefined {
    const row = this.database
      .prepare(
        `SELECT ${assetColumns} FROM layer_assets
         WHERE layer_id = ? AND source_root_id = ? AND relative_path = ?`,
      )
      .get(layerId, "photos", relativePath) as AssetRow | undefined;
    return row === undefined ? undefined : assetFromRow(row);
  }

  upsertAsset(asset: StoredLayerAsset): void {
    this.database
      .prepare(
        `INSERT INTO layer_assets (
          ${assetColumns}
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?
        )
        ON CONFLICT(id) DO UPDATE SET
          status = excluded.status,
          file_name = excluded.file_name,
          content_type = excluded.content_type,
          byte_length = excluded.byte_length,
          content_hash = excluded.content_hash,
          managed_path = excluded.managed_path,
          preview_path = excluded.preview_path,
          source_modified_at = excluded.source_modified_at,
          source_fingerprint = excluded.source_fingerprint,
          width = excluded.width,
          height = excluded.height,
          longitude = excluded.longitude,
          latitude = excluded.latitude,
          coordinate_source = excluded.coordinate_source,
          bounds_json = excluded.bounds_json,
          metadata_json = excluded.metadata_json,
          error_code = excluded.error_code,
          error_message = excluded.error_message,
          updated_at = excluded.updated_at`,
      )
      .run(
        asset.id,
        asset.layerId,
        asset.kind,
        asset.status,
        asset.fileName,
        asset.contentType,
        asset.byteLength,
        asset.contentHash,
        asset.managedPath,
        asset.previewPath,
        asset.sourceRootId,
        asset.relativePath,
        asset.sourceModifiedAt,
        asset.sourceFingerprint,
        asset.width,
        asset.height,
        asset.longitude,
        asset.latitude,
        asset.coordinateSource,
        asset.bounds === null ? null : JSON.stringify(asset.bounds),
        JSON.stringify(asset.metadata),
        asset.errorCode,
        asset.errorMessage,
        asset.createdAt,
        asset.updatedAt,
      );
  }
}

export class JobRepository {
  constructor(private readonly database: DatabaseSync) {}

  list(): Job[] {
    return (
      this.database
        .prepare(`SELECT ${jobColumns} FROM jobs ORDER BY created_at DESC`)
        .all() as unknown as JobRow[]
    ).map(jobFromRow);
  }

  get(id: string): Job | undefined {
    const row = this.database
      .prepare(`SELECT ${jobColumns} FROM jobs WHERE id = ?`)
      .get(id) as JobRow | undefined;
    return row === undefined ? undefined : jobFromRow(row);
  }

  insert(job: Job): void {
    this.database
      .prepare(
        `INSERT INTO jobs (${jobColumns})
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        job.id,
        job.type,
        job.status,
        JSON.stringify(job.input),
        job.total,
        job.completed,
        job.skipped,
        job.failed,
        JSON.stringify(job.summary),
        job.lastError,
        job.createdAt,
        job.startedAt,
        job.updatedAt,
        job.finishedAt,
      );
  }

  update(job: Job): void {
    const result = this.database
      .prepare(
        `UPDATE jobs SET status = ?, input_json = ?, total = ?, completed = ?,
          skipped = ?, failed = ?, summary_json = ?, last_error = ?,
          started_at = ?, updated_at = ?, finished_at = ? WHERE id = ?`,
      )
      .run(
        job.status,
        JSON.stringify(job.input),
        job.total,
        job.completed,
        job.skipped,
        job.failed,
        JSON.stringify(job.summary),
        job.lastError,
        job.startedAt,
        job.updatedAt,
        job.finishedAt,
        job.id,
      );
    if (result.changes !== 1) {
      throw new Error("Job update did not affect exactly one row.");
    }
  }

  progressCursor(id: string): string | null {
    const row = this.database
      .prepare("SELECT progress_cursor FROM jobs WHERE id = ?")
      .get(id) as { progress_cursor: string | null } | undefined;
    if (row === undefined) {
      throw new Error("The requested Job progress cursor does not exist.");
    }
    return row.progress_cursor;
  }

  updateProgress(job: Job, progressCursor: string): void {
    const result = this.database
      .prepare(
        `UPDATE jobs SET status = ?, input_json = ?, total = ?, completed = ?,
          skipped = ?, failed = ?, summary_json = ?, last_error = ?,
          started_at = ?, updated_at = ?, finished_at = ?, progress_cursor = ?
         WHERE id = ?`,
      )
      .run(
        job.status,
        JSON.stringify(job.input),
        job.total,
        job.completed,
        job.skipped,
        job.failed,
        JSON.stringify(job.summary),
        job.lastError,
        job.startedAt,
        job.updatedAt,
        job.finishedAt,
        progressCursor,
        job.id,
      );
    if (result.changes !== 1) {
      throw new Error("Job progress update did not affect exactly one row.");
    }
  }

  recoverInterrupted(): void {
    const timestamp = new Date().toISOString();
    this.database
      .prepare(
        `UPDATE jobs SET status = 'queued', updated_at = ?
         WHERE status = 'running' AND type = 'photo-scan'`,
      )
      .run(timestamp);
  }

  listErrors(jobId: string): JobError[] {
    const rows = this.database
      .prepare(
        `SELECT id, code, message, item, created_at
         FROM job_errors WHERE job_id = ? ORDER BY id DESC`,
      )
      .all(jobId) as unknown as JobErrorRow[];
    return rows.map((row) => ({
      id: row.id,
      code: row.code,
      message: row.message,
      item: row.item,
      createdAt: row.created_at,
    }));
  }

  addError(
    jobId: string,
    error: Omit<JobError, "id">,
    historyLimit: number,
  ): void {
    this.database.exec("BEGIN IMMEDIATE");
    try {
      this.database
        .prepare(
          `INSERT INTO job_errors (job_id, code, message, item, created_at)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .run(jobId, error.code, error.message, error.item, error.createdAt);
      this.database
        .prepare(
          `DELETE FROM job_errors
           WHERE job_id = ? AND id NOT IN (
             SELECT id FROM job_errors WHERE job_id = ?
             ORDER BY id DESC LIMIT ?
           )`,
        )
        .run(jobId, jobId, historyLimit);
      this.database.exec("COMMIT");
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }

  deleteExpired(cutoff: string): number {
    return Number(
      this.database
        .prepare(
          `DELETE FROM jobs
           WHERE status IN ('completed', 'failed', 'cancelled')
             AND finished_at IS NOT NULL AND finished_at < ?`,
        )
        .run(cutoff).changes,
    );
  }
}
