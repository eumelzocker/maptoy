import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import type {
  CacheSnapshot,
  CoverageComparisonCounts,
  CoverageStatusCounts,
  TileCacheMapSetSummary,
  TileCacheOverviewStats,
  TileCacheStats,
  TileCacheUnsupportedZoomInfo,
  TileRevisionOrigin,
  TileRevisionSummary,
} from "@maptoy/contracts";

export interface StoredTileRevision extends TileRevisionSummary {
  logicalTileId: number;
  filePath: string;
  etag: string | null;
  lastModified: string | null;
  selectedFrom: string;
  selectedUntil: string | null;
}

interface TileRevisionRow {
  id: string;
  logical_tile_id: number;
  zoom: number;
  tile_x: number;
  tile_y: number;
  content_hash: string;
  file_path: string;
  content_type: string;
  byte_length: number;
  etag: string | null;
  last_modified: string | null;
  first_seen_at: string;
  last_seen_at: string;
  last_validated_at: string;
  selected_from: string;
  selected_until: string | null;
  origin: TileRevisionOrigin;
  current: number;
}

interface PagedTileRevisionRow extends TileRevisionRow {
  revision_rowid: number;
}

export type TileRevisionState = "all" | "current" | "historical";

export interface TileRevisionPage {
  items: TileRevisionSummary[];
  total: number;
  nextCursor: string | null;
}

export interface UnsupportedZoomDeletion {
  removedLogicalTileCount: number;
  removedRevisionCount: number;
  removedIndexedStorageBytes: number;
  filePaths: string[];
}

export interface CoverageAggregateRow {
  x: number;
  y: number;
  revisionCount: number;
  byteLength: number;
  newestValidatedAt: string | null;
  oldestValidatedAt: string | null;
  statuses: Omit<CoverageStatusCounts, "missing" | "inProgress">;
  primaryCount: number;
  comparison: CoverageComparisonCounts | null;
}

export interface CoverageTileRange {
  minimumX: number;
  maximumX: number;
  minimumY: number;
  maximumY: number;
}

interface SnapshotRow {
  id: string;
  map_set_id: string;
  name: string;
  created_at: string;
  tile_count: number;
}

export type TileSelection =
  | { kind: "current" }
  | { kind: "snapshot"; snapshotId: string }
  | { kind: "as-of"; timestamp: string }
  | { kind: "revision"; revisionId: string };

function tileFromRow(row: TileRevisionRow): StoredTileRevision {
  return {
    id: row.id,
    logicalTileId: row.logical_tile_id,
    zoom: row.zoom,
    x: row.tile_x,
    y: row.tile_y,
    contentHash: row.content_hash,
    filePath: row.file_path,
    contentType: row.content_type,
    byteLength: row.byte_length,
    etag: row.etag,
    lastModified: row.last_modified,
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
    lastValidatedAt: row.last_validated_at,
    selectedFrom: row.selected_from,
    selectedUntil: row.selected_until,
    origin: row.origin,
    current: row.current === 1,
  };
}

function snapshotFromRow(row: SnapshotRow): CacheSnapshot {
  return {
    id: row.id,
    mapSetId: row.map_set_id,
    name: row.name,
    createdAt: row.created_at,
    tileCount: row.tile_count,
  };
}

const tileColumns = `
  tr.id, tr.logical_tile_id, lt.zoom, lt.tile_x, lt.tile_y,
  tr.content_hash, tr.file_path, tr.content_type, tr.byte_length, tr.etag,
  tr.last_modified, tr.first_seen_at, tr.last_seen_at, tr.last_validated_at,
  tr.selected_from, tr.selected_until, tr.origin,
  CASE WHEN lt.current_revision_id = tr.id THEN 1 ELSE 0 END AS current
`;

export class TileArchiveRepository {
  constructor(private readonly database: DatabaseSync) {}

  logicalTileCounts(): ReadonlyMap<string, number> {
    const rows = this.database
      .prepare(
        `SELECT map_set_id, COUNT(*) AS logical_tile_count
           FROM logical_tiles
          GROUP BY map_set_id`,
      )
      .all() as unknown as Array<{
      map_set_id: string;
      logical_tile_count: number;
    }>;
    return new Map(
      rows.map(({ map_set_id, logical_tile_count }) => [
        map_set_id,
        logical_tile_count,
      ]),
    );
  }

  selectedRevision(
    mapSetId: string,
    tile: { zoom: number; x: number; y: number },
    selection: TileSelection,
  ): StoredTileRevision | undefined {
    let sql: string;
    let parameters: Array<string | number>;
    if (selection.kind === "revision") {
      sql = `SELECT ${tileColumns}
               FROM tile_revisions tr
               JOIN logical_tiles lt ON lt.id = tr.logical_tile_id
              WHERE lt.map_set_id = ? AND lt.zoom = ? AND lt.tile_x = ?
                AND lt.tile_y = ? AND tr.id = ?`;
      parameters = [mapSetId, tile.zoom, tile.x, tile.y, selection.revisionId];
    } else if (selection.kind === "snapshot") {
      sql = `SELECT ${tileColumns}
               FROM cache_snapshot_tiles snapshot_tile
               JOIN cache_snapshots snapshot ON snapshot.id = snapshot_tile.snapshot_id
               JOIN tile_revisions tr ON tr.id = snapshot_tile.tile_revision_id
               JOIN logical_tiles lt ON lt.id = tr.logical_tile_id
              WHERE snapshot.map_set_id = ? AND snapshot.id = ? AND lt.zoom = ?
                AND lt.tile_x = ? AND lt.tile_y = ?`;
      parameters = [mapSetId, selection.snapshotId, tile.zoom, tile.x, tile.y];
    } else if (selection.kind === "as-of") {
      sql = `SELECT ${tileColumns}
               FROM logical_tiles lt
               JOIN tile_revisions tr ON tr.logical_tile_id = lt.id
              WHERE lt.map_set_id = ? AND lt.zoom = ? AND lt.tile_x = ? AND lt.tile_y = ?
                AND tr.selected_from <= ?
                AND (tr.selected_until IS NULL OR ? < tr.selected_until)
              ORDER BY tr.selected_from DESC
              LIMIT 1`;
      parameters = [
        mapSetId,
        tile.zoom,
        tile.x,
        tile.y,
        selection.timestamp,
        selection.timestamp,
      ];
    } else {
      sql = `SELECT ${tileColumns}
               FROM logical_tiles lt
               JOIN tile_revisions tr ON tr.id = lt.current_revision_id
              WHERE lt.map_set_id = ? AND lt.zoom = ?
                AND lt.tile_x = ? AND lt.tile_y = ?`;
      parameters = [mapSetId, tile.zoom, tile.x, tile.y];
    }
    const row = this.database.prepare(sql).get(...parameters) as
      | TileRevisionRow
      | undefined;
    return row === undefined ? undefined : tileFromRow(row);
  }

  recordNotModified(
    revisionId: string,
    timestamp: string,
    validators: { etag: string | null; lastModified: string | null },
  ): StoredTileRevision {
    this.database
      .prepare(
        `UPDATE tile_revisions
            SET last_seen_at = ?, last_validated_at = ?,
                etag = COALESCE(?, etag), last_modified = COALESCE(?, last_modified)
          WHERE id = ?`,
      )
      .run(
        timestamp,
        timestamp,
        validators.etag,
        validators.lastModified,
        revisionId,
      );
    const revision = this.revisionById(revisionId);
    if (revision === undefined) {
      throw new Error("Validated Tile Revision no longer exists.");
    }
    return revision;
  }

  recordContent(input: {
    mapSetId: string;
    tile: { zoom: number; x: number; y: number };
    contentHash: string;
    filePath: string;
    contentType: string;
    byteLength: number;
    etag: string | null;
    lastModified: string | null;
    timestamp: string;
    origin: TileRevisionOrigin;
  }): { revision: StoredTileRevision; created: boolean } {
    this.database.exec("BEGIN IMMEDIATE;");
    try {
      let logical = this.database
        .prepare(
          `SELECT id, current_revision_id
             FROM logical_tiles
            WHERE map_set_id = ? AND zoom = ? AND tile_x = ? AND tile_y = ?`,
        )
        .get(input.mapSetId, input.tile.zoom, input.tile.x, input.tile.y) as
        | { id: number; current_revision_id: string | null }
        | undefined;
      if (logical === undefined) {
        const inserted = this.database
          .prepare(
            `INSERT INTO logical_tiles (
               map_set_id, zoom, tile_x, tile_y, current_revision_id
             ) VALUES (?, ?, ?, ?, NULL)`,
          )
          .run(input.mapSetId, input.tile.zoom, input.tile.x, input.tile.y);
        logical = {
          id: Number(inserted.lastInsertRowid),
          current_revision_id: null,
        };
      }

      const current =
        logical.current_revision_id === null
          ? undefined
          : this.revisionById(logical.current_revision_id);
      if (current?.contentHash === input.contentHash) {
        if (input.origin === "provider") {
          this.database
            .prepare(
              `UPDATE tile_revisions
                  SET last_seen_at = ?, last_validated_at = ?, etag = ?, last_modified = ?
                WHERE id = ?`,
            )
            .run(
              input.timestamp,
              input.timestamp,
              input.etag,
              input.lastModified,
              current.id,
            );
        } else {
          // An identical upload observes the existing revision; it must not
          // rewrite that revision's creation origin or provider validators.
          this.database
            .prepare(
              `UPDATE tile_revisions
                  SET last_seen_at = ?, last_validated_at = ?
                WHERE id = ?`,
            )
            .run(input.timestamp, input.timestamp, current.id);
        }
        this.database.exec("COMMIT;");
        const updated = this.revisionById(current.id);
        if (updated === undefined) {
          throw new Error("Updated Tile Revision no longer exists.");
        }
        return { revision: updated, created: false };
      }

      if (current !== undefined) {
        this.database
          .prepare("UPDATE tile_revisions SET selected_until = ? WHERE id = ?")
          .run(input.timestamp, current.id);
      }
      const revisionId = randomUUID();
      this.database
        .prepare(
          `INSERT INTO tile_revisions (
             id, logical_tile_id, content_hash, file_path, content_type, byte_length,
             etag, last_modified, first_seen_at, last_seen_at, last_validated_at,
             selected_from, selected_until, validation_status, origin
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'valid', ?)`,
        )
        .run(
          revisionId,
          logical.id,
          input.contentHash,
          input.filePath,
          input.contentType,
          input.byteLength,
          input.etag,
          input.lastModified,
          input.timestamp,
          input.timestamp,
          input.timestamp,
          input.timestamp,
          input.origin,
        );
      this.database
        .prepare(
          "UPDATE logical_tiles SET current_revision_id = ? WHERE id = ?",
        )
        .run(revisionId, logical.id);
      this.database.exec("COMMIT;");
      const revision = this.revisionById(revisionId);
      if (revision === undefined) {
        throw new Error("Created Tile Revision does not exist.");
      }
      return { revision, created: true };
    } catch (error) {
      this.database.exec("ROLLBACK;");
      throw error;
    }
  }

  revisionById(id: string): StoredTileRevision | undefined {
    const row = this.database
      .prepare(
        `SELECT ${tileColumns}
           FROM tile_revisions tr
           JOIN logical_tiles lt ON lt.id = tr.logical_tile_id
          WHERE tr.id = ?`,
      )
      .get(id) as TileRevisionRow | undefined;
    return row === undefined ? undefined : tileFromRow(row);
  }

  listRevisions(mapSetId: string): TileRevisionSummary[] {
    return (
      this.database
        .prepare(
          `SELECT ${tileColumns}
             FROM tile_revisions tr
             JOIN logical_tiles lt ON lt.id = tr.logical_tile_id
            WHERE lt.map_set_id = ?
            ORDER BY lt.zoom, lt.tile_x, lt.tile_y, tr.selected_from DESC`,
        )
        .all(mapSetId) as unknown as TileRevisionRow[]
    ).map(tileFromRow);
  }

  pageRevisions(
    mapSetId: string,
    options: {
      limit: number;
      cursor?: number;
      zoom?: number;
      state: TileRevisionState;
    },
  ): TileRevisionPage {
    const filters = ["lt.map_set_id = ?"];
    const parameters: Array<string | number> = [mapSetId];
    if (options.zoom !== undefined) {
      filters.push("lt.zoom = ?");
      parameters.push(options.zoom);
    }
    if (options.state === "current") {
      filters.push("lt.current_revision_id = tr.id");
    } else if (options.state === "historical") {
      filters.push("NOT (lt.current_revision_id IS tr.id)");
    }
    const total = (
      this.database
        .prepare(
          `SELECT COUNT(*) AS value
             FROM tile_revisions tr
             JOIN logical_tiles lt ON lt.id = tr.logical_tile_id
            WHERE ${filters.join(" AND ")}`,
        )
        .get(...parameters) as { value: number }
    ).value;
    if (options.cursor !== undefined) {
      filters.push("tr.rowid < ?");
      parameters.push(options.cursor);
    }
    // The cursor is an ephemeral insertion-order boundary, not a persistent Tile
    // identifier. It keeps later pages bounded without increasingly costly OFFSETs.
    const rows = this.database
      .prepare(
        `SELECT ${tileColumns}, tr.rowid AS revision_rowid
           FROM tile_revisions tr
           JOIN logical_tiles lt ON lt.id = tr.logical_tile_id
          WHERE ${filters.join(" AND ")}
          ORDER BY tr.rowid DESC
          LIMIT ?`,
      )
      .all(
        ...parameters,
        options.limit + 1,
      ) as unknown as PagedTileRevisionRow[];
    const pageRows = rows.slice(0, options.limit);
    return {
      items: pageRows.map(tileFromRow),
      total,
      nextCursor:
        rows.length > options.limit
          ? String(pageRows.at(-1)?.revision_rowid)
          : null,
    };
  }

  createSnapshot(
    mapSetId: string,
    name: string,
    timestamp: string,
  ): CacheSnapshot {
    const id = randomUUID();
    this.database.exec("BEGIN IMMEDIATE;");
    try {
      this.database
        .prepare(
          `INSERT INTO cache_snapshots (
             id, map_set_id, name, created_at
           ) VALUES (?, ?, ?, ?)`,
        )
        .run(id, mapSetId, name, timestamp);
      this.database
        .prepare(
          `INSERT INTO cache_snapshot_tiles (snapshot_id, tile_revision_id)
           SELECT ?, current_revision_id
             FROM logical_tiles
            WHERE map_set_id = ? AND current_revision_id IS NOT NULL`,
        )
        .run(id, mapSetId);
      this.database.exec("COMMIT;");
    } catch (error) {
      this.database.exec("ROLLBACK;");
      throw error;
    }
    const snapshot = this.snapshotById(id);
    if (snapshot === undefined) {
      throw new Error("Created Cache Snapshot does not exist.");
    }
    return snapshot;
  }

  snapshotById(id: string): CacheSnapshot | undefined {
    const row = this.database
      .prepare(
        `SELECT snapshot.id, snapshot.map_set_id, snapshot.name,
                snapshot.created_at, COUNT(item.tile_revision_id) AS tile_count
           FROM cache_snapshots snapshot
           LEFT JOIN cache_snapshot_tiles item ON item.snapshot_id = snapshot.id
          WHERE snapshot.id = ?
          GROUP BY snapshot.id`,
      )
      .get(id) as SnapshotRow | undefined;
    return row === undefined ? undefined : snapshotFromRow(row);
  }

  listSnapshots(mapSetId: string): CacheSnapshot[] {
    return (
      this.database
        .prepare(
          `SELECT snapshot.id, snapshot.map_set_id, snapshot.name, snapshot.created_at,
                  COUNT(item.tile_revision_id) AS tile_count
             FROM cache_snapshots snapshot
             LEFT JOIN cache_snapshot_tiles item ON item.snapshot_id = snapshot.id
            WHERE snapshot.map_set_id = ?
            GROUP BY snapshot.id
            ORDER BY snapshot.created_at DESC, snapshot.name`,
        )
        .all(mapSetId) as unknown as SnapshotRow[]
    ).map(snapshotFromRow);
  }

  deleteSnapshot(mapSetId: string, snapshotId: string): boolean {
    return (
      this.database
        .prepare("DELETE FROM cache_snapshots WHERE id = ? AND map_set_id = ?")
        .run(snapshotId, mapSetId).changes === 1
    );
  }

  metadataStats(mapSetId: string): TileCacheStats {
    const scalar = (sql: string): number => {
      const row = this.database.prepare(sql).get(mapSetId) as { value: number };
      return row.value;
    };
    const storage = this.database
      .prepare(
        `SELECT COUNT(*) AS content_count, COALESCE(SUM(byte_length), 0) AS bytes
           FROM (
             SELECT tr.file_path, MAX(tr.byte_length) AS byte_length
               FROM tile_revisions tr
               JOIN logical_tiles lt ON lt.id = tr.logical_tile_id
              WHERE lt.map_set_id = ?
              GROUP BY tr.file_path
           )`,
      )
      .get(mapSetId) as { content_count: number; bytes: number };
    const totalRevisionCount = scalar(
      `SELECT COUNT(*) AS value FROM tile_revisions tr
       JOIN logical_tiles lt ON lt.id = tr.logical_tile_id WHERE lt.map_set_id = ?`,
    );
    const currentRevisionCount = scalar(
      `SELECT COUNT(*) AS value FROM logical_tiles
      WHERE map_set_id = ? AND current_revision_id IS NOT NULL`,
    );
    const logicalByZoom = this.database
      .prepare(
        `SELECT zoom, COUNT(*) AS logical_count,
                SUM(CASE WHEN current_revision_id IS NULL THEN 0 ELSE 1 END) AS current_count
           FROM logical_tiles
          WHERE map_set_id = ?
          GROUP BY zoom
          ORDER BY zoom`,
      )
      .all(mapSetId) as unknown as Array<{
      zoom: number;
      logical_count: number;
      current_count: number;
    }>;
    const revisionsByZoom = new Map(
      (
        this.database
          .prepare(
            `SELECT lt.zoom, COUNT(*) AS revision_count
               FROM tile_revisions tr
               JOIN logical_tiles lt ON lt.id = tr.logical_tile_id
              WHERE lt.map_set_id = ?
              GROUP BY lt.zoom`,
          )
          .all(mapSetId) as unknown as Array<{
          zoom: number;
          revision_count: number;
        }>
      ).map((row) => [row.zoom, row.revision_count]),
    );
    const storageByZoom = new Map(
      (
        this.database
          .prepare(
            `SELECT zoom, COALESCE(SUM(byte_length), 0) AS bytes
               FROM (
                 SELECT lt.zoom, tr.file_path, MAX(tr.byte_length) AS byte_length
                   FROM tile_revisions tr
                   JOIN logical_tiles lt ON lt.id = tr.logical_tile_id
                  WHERE lt.map_set_id = ?
                  GROUP BY lt.zoom, tr.file_path
               )
              GROUP BY zoom`,
          )
          .all(mapSetId) as unknown as Array<{ zoom: number; bytes: number }>
      ).map((row) => [row.zoom, row.bytes]),
    );
    return {
      logicalTileCount: scalar(
        "SELECT COUNT(*) AS value FROM logical_tiles WHERE map_set_id = ?",
      ),
      currentRevisionCount,
      historicalRevisionCount: totalRevisionCount - currentRevisionCount,
      totalRevisionCount,
      snapshotCount: scalar(
        "SELECT COUNT(*) AS value FROM cache_snapshots WHERE map_set_id = ?",
      ),
      uniqueContentCount: storage.content_count,
      totalStorageBytes: storage.bytes,
      zoomLevels: logicalByZoom.map((row) => {
        const total = revisionsByZoom.get(row.zoom) ?? 0;
        return {
          zoom: row.zoom,
          logicalTileCount: row.logical_count,
          currentRevisionCount: row.current_count,
          historicalRevisionCount: total - row.current_count,
          totalRevisionCount: total,
          indexedStorageBytes: storageByZoom.get(row.zoom) ?? 0,
        };
      }),
    };
  }

  metadataOverview(): TileCacheOverviewStats {
    const tileRows = this.database
      .prepare(
        `SELECT ms.id AS map_set_id,
                COUNT(lt.id) AS logical_count,
                COALESCE(SUM(CASE WHEN lt.current_revision_id IS NULL THEN 0 ELSE 1 END), 0)
                  AS current_count
           FROM map_sets ms
           LEFT JOIN logical_tiles lt ON lt.map_set_id = ms.id
          GROUP BY ms.id
          ORDER BY ms.name COLLATE NOCASE, ms.id`,
      )
      .all() as unknown as Array<{
      map_set_id: string;
      logical_count: number;
      current_count: number;
    }>;
    const revisionCounts = new Map(
      (
        this.database
          .prepare(
            `SELECT lt.map_set_id, COUNT(*) AS revision_count
               FROM tile_revisions tr
               JOIN logical_tiles lt ON lt.id = tr.logical_tile_id
              GROUP BY lt.map_set_id`,
          )
          .all() as unknown as Array<{
          map_set_id: string;
          revision_count: number;
        }>
      ).map((row) => [row.map_set_id, row.revision_count]),
    );
    const snapshotCounts = new Map(
      (
        this.database
          .prepare(
            `SELECT map_set_id, COUNT(*) AS snapshot_count
               FROM cache_snapshots
              GROUP BY map_set_id`,
          )
          .all() as unknown as Array<{
          map_set_id: string;
          snapshot_count: number;
        }>
      ).map((row) => [row.map_set_id, row.snapshot_count]),
    );
    const storageByMapSet = new Map(
      (
        this.database
          .prepare(
            `SELECT map_set_id, COUNT(*) AS content_count,
                    COALESCE(SUM(byte_length), 0) AS bytes
               FROM (
                 SELECT lt.map_set_id, tr.file_path,
                        MAX(tr.byte_length) AS byte_length
                   FROM tile_revisions tr
                   JOIN logical_tiles lt ON lt.id = tr.logical_tile_id
                  GROUP BY lt.map_set_id, tr.file_path
               )
              GROUP BY map_set_id`,
          )
          .all() as unknown as Array<{
          map_set_id: string;
          content_count: number;
          bytes: number;
        }>
      ).map((row) => [row.map_set_id, row]),
    );
    const oldestCurrentValidatedAtByMapSet = new Map(
      (
        this.database
          .prepare(
            `SELECT lt.map_set_id, MIN(tr.last_validated_at) AS oldest_validated_at
               FROM tile_revisions tr
               JOIN logical_tiles lt ON lt.current_revision_id = tr.id
              GROUP BY lt.map_set_id`,
          )
          .all() as unknown as Array<{
          map_set_id: string;
          oldest_validated_at: string;
        }>
      ).map((row) => [row.map_set_id, row.oldest_validated_at]),
    );
    const logicalByZoom = this.database
      .prepare(
        `SELECT zoom, COUNT(*) AS logical_count,
                SUM(CASE WHEN current_revision_id IS NULL THEN 0 ELSE 1 END) AS current_count
           FROM logical_tiles
          GROUP BY zoom
          ORDER BY zoom`,
      )
      .all() as unknown as Array<{
      zoom: number;
      logical_count: number;
      current_count: number;
    }>;
    const revisionsByZoom = new Map(
      (
        this.database
          .prepare(
            `SELECT lt.zoom, COUNT(*) AS revision_count
               FROM tile_revisions tr
               JOIN logical_tiles lt ON lt.id = tr.logical_tile_id
              GROUP BY lt.zoom`,
          )
          .all() as unknown as Array<{
          zoom: number;
          revision_count: number;
        }>
      ).map((row) => [row.zoom, row.revision_count]),
    );
    const storageByZoom = new Map(
      (
        this.database
          .prepare(
            `SELECT zoom, COALESCE(SUM(byte_length), 0) AS bytes
               FROM (
                 SELECT lt.zoom, tr.file_path,
                        MAX(tr.byte_length) AS byte_length
                   FROM tile_revisions tr
                   JOIN logical_tiles lt ON lt.id = tr.logical_tile_id
                  GROUP BY lt.zoom, tr.file_path
               )
              GROUP BY zoom`,
          )
          .all() as unknown as Array<{ zoom: number; bytes: number }>
      ).map((row) => [row.zoom, row.bytes]),
    );

    const mapSets: TileCacheMapSetSummary[] = tileRows.map((row) => {
      const totalRevisionCount = revisionCounts.get(row.map_set_id) ?? 0;
      const storage = storageByMapSet.get(row.map_set_id);
      return {
        mapSetId: row.map_set_id,
        logicalTileCount: row.logical_count,
        currentRevisionCount: row.current_count,
        historicalRevisionCount: totalRevisionCount - row.current_count,
        totalRevisionCount,
        snapshotCount: snapshotCounts.get(row.map_set_id) ?? 0,
        uniqueContentCount: storage?.content_count ?? 0,
        totalStorageBytes: storage?.bytes ?? 0,
        oldestCurrentValidatedAt:
          oldestCurrentValidatedAtByMapSet.get(row.map_set_id) ?? null,
      };
    });
    const totals = mapSets.reduce(
      (result, mapSet) => ({
        logicalTileCount: result.logicalTileCount + mapSet.logicalTileCount,
        currentRevisionCount:
          result.currentRevisionCount + mapSet.currentRevisionCount,
        historicalRevisionCount:
          result.historicalRevisionCount + mapSet.historicalRevisionCount,
        totalRevisionCount:
          result.totalRevisionCount + mapSet.totalRevisionCount,
        snapshotCount: result.snapshotCount + mapSet.snapshotCount,
        uniqueContentCount:
          result.uniqueContentCount + mapSet.uniqueContentCount,
        totalStorageBytes: result.totalStorageBytes + mapSet.totalStorageBytes,
      }),
      {
        logicalTileCount: 0,
        currentRevisionCount: 0,
        historicalRevisionCount: 0,
        totalRevisionCount: 0,
        snapshotCount: 0,
        uniqueContentCount: 0,
        totalStorageBytes: 0,
      },
    );

    return {
      mapSetCount: mapSets.length,
      populatedMapSetCount: mapSets.filter(
        ({ logicalTileCount }) => logicalTileCount > 0,
      ).length,
      stats: {
        ...totals,
        zoomLevels: logicalByZoom.map((row) => {
          const totalRevisionCount = revisionsByZoom.get(row.zoom) ?? 0;
          return {
            zoom: row.zoom,
            logicalTileCount: row.logical_count,
            currentRevisionCount: row.current_count,
            historicalRevisionCount: totalRevisionCount - row.current_count,
            totalRevisionCount,
            indexedStorageBytes: storageByZoom.get(row.zoom) ?? 0,
          };
        }),
      },
      mapSets,
    };
  }

  unsupportedZoomInfo(
    mapSetId: string,
    minimumZoom: number,
    maximumZoom: number,
  ): TileCacheUnsupportedZoomInfo {
    const parameters = [mapSetId, minimumZoom, maximumZoom] as const;
    const totals = this.database
      .prepare(
        `SELECT COUNT(*) AS logical_count,
                COALESCE(SUM((
                  SELECT COUNT(*) FROM tile_revisions tr
                   WHERE tr.logical_tile_id = lt.id
                )), 0) AS revision_count,
                COALESCE(SUM(CASE WHEN EXISTS (
                  SELECT 1
                    FROM tile_revisions tr
                    JOIN cache_snapshot_tiles item ON item.tile_revision_id = tr.id
                   WHERE tr.logical_tile_id = lt.id
                ) THEN 1 ELSE 0 END), 0) AS protected_count
           FROM logical_tiles lt
          WHERE lt.map_set_id = ? AND (lt.zoom < ? OR lt.zoom > ?)`,
      )
      .get(...parameters) as {
      logical_count: number;
      revision_count: number;
      protected_count: number;
    };
    const storage = this.database
      .prepare(
        `SELECT COALESCE(SUM(byte_length), 0) AS bytes
           FROM (
             SELECT tr.file_path, MAX(tr.byte_length) AS byte_length
               FROM tile_revisions tr
               JOIN logical_tiles lt ON lt.id = tr.logical_tile_id
              WHERE lt.map_set_id = ? AND (lt.zoom < ? OR lt.zoom > ?)
              GROUP BY tr.file_path
           )`,
      )
      .get(...parameters) as { bytes: number };
    const zoomLevels = (
      this.database
        .prepare(
          `SELECT DISTINCT zoom
             FROM logical_tiles
            WHERE map_set_id = ? AND (zoom < ? OR zoom > ?)
            ORDER BY zoom`,
        )
        .all(...parameters) as unknown as Array<{ zoom: number }>
    ).map(({ zoom }) => zoom);

    return {
      zoomLevels,
      logicalTileCount: totals.logical_count,
      revisionCount: totals.revision_count,
      deletableLogicalTileCount: totals.logical_count - totals.protected_count,
      snapshotProtectedLogicalTileCount: totals.protected_count,
      indexedStorageBytes: storage.bytes,
    };
  }

  deleteUnsupportedZoomTiles(
    mapSetId: string,
    minimumZoom: number,
    maximumZoom: number,
  ): UnsupportedZoomDeletion {
    const parameters = [mapSetId, minimumZoom, maximumZoom] as const;
    const deletablePredicate = `
      map_set_id = ? AND (zoom < ? OR zoom > ?)
      AND NOT EXISTS (
        SELECT 1
          FROM tile_revisions protected_revision
          JOIN cache_snapshot_tiles item
            ON item.tile_revision_id = protected_revision.id
         WHERE protected_revision.logical_tile_id = logical_tiles.id
      )`;
    const files = this.database
      .prepare(
        `SELECT tr.file_path, MAX(tr.byte_length) AS byte_length
           FROM tile_revisions tr
           JOIN logical_tiles lt ON lt.id = tr.logical_tile_id
          WHERE lt.map_set_id = ? AND (lt.zoom < ? OR lt.zoom > ?)
            AND NOT EXISTS (
              SELECT 1
                FROM tile_revisions protected_revision
                JOIN cache_snapshot_tiles item
                  ON item.tile_revision_id = protected_revision.id
               WHERE protected_revision.logical_tile_id = lt.id
            )
          GROUP BY tr.file_path`,
      )
      .all(...parameters) as unknown as Array<{
      file_path: string;
      byte_length: number;
    }>;
    const removedRevisionCount = (
      this.database
        .prepare(
          `SELECT COUNT(*) AS value
             FROM tile_revisions tr
             JOIN logical_tiles lt ON lt.id = tr.logical_tile_id
            WHERE lt.map_set_id = ? AND (lt.zoom < ? OR lt.zoom > ?)
              AND NOT EXISTS (
                SELECT 1
                  FROM tile_revisions protected_revision
                  JOIN cache_snapshot_tiles item
                    ON item.tile_revision_id = protected_revision.id
                 WHERE protected_revision.logical_tile_id = lt.id
              )`,
        )
        .get(...parameters) as { value: number }
    ).value;

    this.database.exec("BEGIN IMMEDIATE;");
    try {
      const removedLogicalTileCount = Number(
        this.database
          .prepare(`DELETE FROM logical_tiles WHERE ${deletablePredicate}`)
          .run(...parameters).changes,
      );
      this.database.exec("COMMIT;");
      return {
        removedLogicalTileCount,
        removedRevisionCount,
        removedIndexedStorageBytes: files.reduce(
          (total, file) => total + file.byte_length,
          0,
        ),
        filePaths: files.map(({ file_path }) => file_path),
      };
    } catch (error) {
      this.database.exec("ROLLBACK;");
      throw error;
    }
  }

  referencedFiles(
    mapSetId: string,
  ): Array<{ filePath: string; byteLength: number }> {
    return this.database
      .prepare(
        `SELECT tr.file_path AS filePath, MAX(tr.byte_length) AS byteLength
           FROM tile_revisions tr
           JOIN logical_tiles lt ON lt.id = tr.logical_tile_id
          WHERE lt.map_set_id = ?
          GROUP BY tr.file_path`,
      )
      .all(mapSetId) as unknown as Array<{
      filePath: string;
      byteLength: number;
    }>;
  }

  removeMissingFileReferences(
    mapSetId: string,
    filePaths: readonly string[],
  ): {
    removedMissingRevisionCount: number;
    removedLogicalTileCount: number;
    removedSnapshotReferenceCount: number;
  } {
    if (filePaths.length === 0) {
      return {
        removedMissingRevisionCount: 0,
        removedLogicalTileCount: 0,
        removedSnapshotReferenceCount: 0,
      };
    }

    const revisionsForPath = this.database.prepare(
      `SELECT tr.id
         FROM tile_revisions tr
         JOIN logical_tiles lt ON lt.id = tr.logical_tile_id
        WHERE lt.map_set_id = ? AND tr.file_path = ?`,
    );
    const deleteSnapshotReferences = this.database.prepare(
      "DELETE FROM cache_snapshot_tiles WHERE tile_revision_id = ?",
    );
    const clearCurrentRevision = this.database.prepare(
      `UPDATE logical_tiles
          SET current_revision_id = NULL
        WHERE map_set_id = ? AND current_revision_id = ?`,
    );
    const deleteRevision = this.database.prepare(
      "DELETE FROM tile_revisions WHERE id = ?",
    );
    let removedMissingRevisionCount = 0;
    let removedSnapshotReferenceCount = 0;

    this.database.exec("BEGIN IMMEDIATE;");
    try {
      for (const filePath of new Set(filePaths)) {
        const revisions = revisionsForPath.all(
          mapSetId,
          filePath,
        ) as unknown as Array<{ id: string }>;
        for (const revision of revisions) {
          // Snapshot and current pointers must be detached before the immutable
          // revision row can be removed without leaving broken references.
          removedSnapshotReferenceCount += Number(
            deleteSnapshotReferences.run(revision.id).changes,
          );
          clearCurrentRevision.run(mapSetId, revision.id);
          removedMissingRevisionCount += Number(
            deleteRevision.run(revision.id).changes,
          );
        }
      }
      const removedLogicalTileCount = Number(
        this.database
          .prepare(
            `DELETE FROM logical_tiles
              WHERE map_set_id = ?
                AND NOT EXISTS (
                  SELECT 1 FROM tile_revisions tr
                   WHERE tr.logical_tile_id = logical_tiles.id
                )`,
          )
          .run(mapSetId).changes,
      );
      this.database.exec("COMMIT;");
      return {
        removedMissingRevisionCount,
        removedLogicalTileCount,
        removedSnapshotReferenceCount,
      };
    } catch (error) {
      this.database.exec("ROLLBACK;");
      throw error;
    }
  }

  compareStates(
    mapSetId: string,
    left: "current" | { snapshotId: string },
    right: "current" | { snapshotId: string },
  ): { identical: number; changed: number; added: number; missing: number } {
    const state = (selector: "current" | { snapshotId: string }) =>
      selector === "current"
        ? {
            sql: `SELECT lt.zoom, lt.tile_x, lt.tile_y, tr.content_hash
                    FROM logical_tiles lt
                    JOIN tile_revisions tr ON tr.id = lt.current_revision_id
                   WHERE lt.map_set_id = ?`,
            parameters: [mapSetId],
          }
        : {
            sql: `SELECT lt.zoom, lt.tile_x, lt.tile_y, tr.content_hash
                    FROM cache_snapshots snapshot
                    JOIN cache_snapshot_tiles item ON item.snapshot_id = snapshot.id
                    JOIN tile_revisions tr ON tr.id = item.tile_revision_id
                    JOIN logical_tiles lt ON lt.id = tr.logical_tile_id
                   WHERE snapshot.map_set_id = ? AND snapshot.id = ?`,
            parameters: [mapSetId, selector.snapshotId],
          };
    const leftState = state(left);
    const rightState = state(right);
    // Aggregate inside SQLite so a comparison never materializes every Tile hash
    // in the Node.js heap merely to return four counters.
    return this.database
      .prepare(
        `WITH left_state AS (${leftState.sql}),
              right_state AS (${rightState.sql}),
              coordinates AS (
                SELECT zoom, tile_x, tile_y FROM left_state
                UNION
                SELECT zoom, tile_x, tile_y FROM right_state
              )
         SELECT
           COALESCE(SUM(CASE WHEN l.content_hash = r.content_hash THEN 1 ELSE 0 END), 0) AS identical,
           COALESCE(SUM(CASE WHEN l.content_hash IS NOT NULL AND r.content_hash IS NOT NULL
                                  AND l.content_hash <> r.content_hash THEN 1 ELSE 0 END), 0) AS changed,
           COALESCE(SUM(CASE WHEN l.content_hash IS NULL AND r.content_hash IS NOT NULL
                             THEN 1 ELSE 0 END), 0) AS added,
           COALESCE(SUM(CASE WHEN l.content_hash IS NOT NULL AND r.content_hash IS NULL
                             THEN 1 ELSE 0 END), 0) AS missing
           FROM coordinates coordinate
           LEFT JOIN left_state l
             ON l.zoom = coordinate.zoom AND l.tile_x = coordinate.tile_x
            AND l.tile_y = coordinate.tile_y
           LEFT JOIN right_state r
             ON r.zoom = coordinate.zoom AND r.tile_x = coordinate.tile_x
            AND r.tile_y = coordinate.tile_y`,
      )
      .get(...leftState.parameters, ...rightState.parameters) as {
      identical: number;
      changed: number;
      added: number;
      missing: number;
    };
  }

  coverageAggregates(input: {
    mapSetId: string;
    zoom: number;
    aggregationZoom: number;
    ranges: readonly CoverageTileRange[];
    selection: Exclude<TileSelection, { kind: "revision" }>;
    compareTo: Exclude<TileSelection, { kind: "revision" }> | null;
    staleBefore: string;
  }): CoverageAggregateRow[] {
    const rangeFilter = input.ranges
      .map(() => "(lt.tile_x BETWEEN ? AND ? AND lt.tile_y BETWEEN ? AND ?)")
      .join(" OR ");
    const rangeParameters = input.ranges.flatMap((range) => [
      range.minimumX,
      range.maximumX,
      range.minimumY,
      range.maximumY,
    ]);
    const state = (
      selection: Exclude<TileSelection, { kind: "revision" }>,
    ): { sql: string; parameters: Array<string | number> } => {
      const columns = `lt.id AS logical_tile_id, lt.tile_x, lt.tile_y,
                       tr.content_hash, tr.byte_length, tr.last_validated_at`;
      if (selection.kind === "snapshot") {
        return {
          sql: `SELECT ${columns}
                  FROM cache_snapshots snapshot
                  JOIN cache_snapshot_tiles item ON item.snapshot_id = snapshot.id
                  JOIN tile_revisions tr ON tr.id = item.tile_revision_id
                  JOIN logical_tiles lt ON lt.id = tr.logical_tile_id
                 WHERE snapshot.map_set_id = ? AND snapshot.id = ? AND lt.zoom = ?
                   AND (${rangeFilter})`,
          parameters: [
            input.mapSetId,
            selection.snapshotId,
            input.zoom,
            ...rangeParameters,
          ],
        };
      }
      if (selection.kind === "as-of") {
        return {
          sql: `SELECT ${columns}
                  FROM logical_tiles lt
                  JOIN tile_revisions tr ON tr.logical_tile_id = lt.id
                 WHERE lt.map_set_id = ? AND lt.zoom = ? AND (${rangeFilter})
                   AND tr.selected_from <= ?
                   AND (tr.selected_until IS NULL OR ? < tr.selected_until)`,
          parameters: [
            input.mapSetId,
            input.zoom,
            ...rangeParameters,
            selection.timestamp,
            selection.timestamp,
          ],
        };
      }
      return {
        sql: `SELECT ${columns}
                FROM logical_tiles lt
                JOIN tile_revisions tr ON tr.id = lt.current_revision_id
               WHERE lt.map_set_id = ? AND lt.zoom = ? AND (${rangeFilter})`,
        parameters: [input.mapSetId, input.zoom, ...rangeParameters],
      };
    };
    const selected = state(input.selection);
    const compared = input.compareTo === null ? null : state(input.compareTo);
    const factor = 2 ** (input.zoom - input.aggregationZoom);
    const comparisonCtes =
      compared === null
        ? `compare_state AS MATERIALIZED (
             SELECT NULL AS logical_tile_id, NULL AS tile_x, NULL AS tile_y,
                    NULL AS content_hash, NULL AS byte_length,
                    NULL AS last_validated_at WHERE FALSE
           )`
        : `compare_state AS MATERIALIZED (${compared.sql})`;
    const rows = this.database
      .prepare(
        // These states are referenced by several joins. Explicit materialization
        // prevents SQLite from re-running the bounded Tile lookup per aggregate
        // row (8.3 s versus 72 ms for 10,000 Tiles in the Phase 4 benchmark).
        `WITH selected_state AS MATERIALIZED (${selected.sql}),
              ${comparisonCtes},
              coordinates AS MATERIALIZED (
                SELECT tile_x, tile_y FROM selected_state
                UNION
                SELECT tile_x, tile_y FROM compare_state
              ),
              revision_counts AS MATERIALIZED (
                SELECT tr.logical_tile_id, COUNT(*) AS revision_count
                  FROM tile_revisions tr
                  JOIN selected_state selected
                    ON selected.logical_tile_id = tr.logical_tile_id
                 GROUP BY tr.logical_tile_id
              )
         SELECT CAST(coordinate.tile_x / ? AS INTEGER) AS cell_x,
                CAST(coordinate.tile_y / ? AS INTEGER) AS cell_y,
                COALESCE(SUM(revision.revision_count), 0) AS revision_count,
                COALESCE(SUM(selected.byte_length), 0) AS byte_length,
                MAX(selected.last_validated_at) AS newest_validated_at,
                MIN(selected.last_validated_at) AS oldest_validated_at,
                COALESCE(SUM(CASE WHEN selected.content_hash IS NOT NULL
                                       AND selected.last_validated_at >= ? THEN 1 ELSE 0 END), 0)
                  AS available_count,
                COALESCE(SUM(CASE WHEN selected.content_hash IS NOT NULL
                                       AND selected.last_validated_at < ? THEN 1 ELSE 0 END), 0)
                  AS stale_count,
                COALESCE(SUM(CASE WHEN selected.content_hash IS NOT NULL THEN 1 ELSE 0 END), 0)
                  AS primary_count,
                COALESCE(SUM(CASE WHEN selected.content_hash = compared.content_hash
                                  THEN 1 ELSE 0 END), 0) AS identical_count,
                COALESCE(SUM(CASE WHEN selected.content_hash IS NOT NULL
                                       AND compared.content_hash IS NOT NULL
                                       AND selected.content_hash <> compared.content_hash
                                  THEN 1 ELSE 0 END), 0) AS changed_count,
                COALESCE(SUM(CASE WHEN selected.content_hash IS NULL
                                       AND compared.content_hash IS NOT NULL
                                  THEN 1 ELSE 0 END), 0) AS added_count,
                COALESCE(SUM(CASE WHEN selected.content_hash IS NOT NULL
                                       AND compared.content_hash IS NULL
                                  THEN 1 ELSE 0 END), 0) AS missing_count
           FROM coordinates coordinate
           LEFT JOIN selected_state selected
             ON selected.tile_x = coordinate.tile_x
            AND selected.tile_y = coordinate.tile_y
           LEFT JOIN compare_state compared
             ON compared.tile_x = coordinate.tile_x
            AND compared.tile_y = coordinate.tile_y
           LEFT JOIN revision_counts revision
             ON revision.logical_tile_id = selected.logical_tile_id
          GROUP BY cell_x, cell_y`,
      )
      .all(
        ...selected.parameters,
        ...(compared?.parameters ?? []),
        factor,
        factor,
        input.staleBefore,
        input.staleBefore,
      ) as unknown as Array<{
      cell_x: number;
      cell_y: number;
      revision_count: number;
      byte_length: number;
      newest_validated_at: string | null;
      oldest_validated_at: string | null;
      available_count: number;
      stale_count: number;
      primary_count: number;
      identical_count: number;
      changed_count: number;
      added_count: number;
      missing_count: number;
    }>;
    return rows.map((row) => ({
      x: row.cell_x,
      y: row.cell_y,
      revisionCount: row.revision_count,
      byteLength: row.byte_length,
      newestValidatedAt: row.newest_validated_at,
      oldestValidatedAt: row.oldest_validated_at,
      statuses: {
        available: row.available_count,
        stale: row.stale_count,
      },
      primaryCount: row.primary_count,
      comparison:
        compared === null
          ? null
          : {
              identical: row.identical_count,
              changed: row.changed_count,
              added: row.added_count,
              missing: row.missing_count,
            },
    }));
  }

  hasTileRevisions(mapSetId: string): boolean {
    const row = this.database
      .prepare(
        `SELECT EXISTS (
           SELECT 1
             FROM tile_revisions revision
             JOIN logical_tiles tile ON tile.id = revision.logical_tile_id
            WHERE tile.map_set_id = ?
         ) AS value`,
      )
      .get(mapSetId) as { value: number };
    return row.value === 1;
  }

  revisionProtection(
    mapSetId: string,
    revisionId: string,
  ):
    | {
        current: boolean;
        snapshotReferences: number;
        filePath: string;
      }
    | undefined {
    const row = this.database
      .prepare(
        `SELECT tr.file_path,
                CASE WHEN lt.current_revision_id = tr.id THEN 1 ELSE 0 END AS current,
                COUNT(item.snapshot_id) AS snapshot_references
           FROM tile_revisions tr
           JOIN logical_tiles lt ON lt.id = tr.logical_tile_id
           LEFT JOIN cache_snapshot_tiles item ON item.tile_revision_id = tr.id
          WHERE lt.map_set_id = ? AND tr.id = ?
          GROUP BY tr.id`,
      )
      .get(mapSetId, revisionId) as
      | { file_path: string; current: number; snapshot_references: number }
      | undefined;
    return row === undefined
      ? undefined
      : {
          current: row.current === 1,
          snapshotReferences: row.snapshot_references,
          filePath: row.file_path,
        };
  }

  deleteRevision(
    mapSetId: string,
    revisionId: string,
  ): {
    filePath: string;
    remainingFileReferences: number;
  } {
    const protection = this.revisionProtection(mapSetId, revisionId);
    if (protection === undefined) {
      throw new Error("Tile Revision not found.");
    }
    this.database
      .prepare("DELETE FROM tile_revisions WHERE id = ?")
      .run(revisionId);
    const remaining = this.database
      .prepare(
        "SELECT COUNT(*) AS value FROM tile_revisions WHERE file_path = ?",
      )
      .get(protection.filePath) as { value: number };
    return {
      filePath: protection.filePath,
      remainingFileReferences: remaining.value,
    };
  }
}
