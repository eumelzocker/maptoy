import type { DatabaseSync } from "node:sqlite";
import type { MapSet } from "@maptoy/contracts";

interface MapSetRow {
  id: string;
  name: string;
  source_type: "xyz-raster";
  url_template: string;
  attribution: string;
  terms_url: string;
  notes: string;
  terms_reviewed_at: string;
  min_zoom: number;
  max_zoom: number;
  tile_size: 256 | 512;
  tile_format: "png" | "jpeg" | "webp";
  subdomains_json: string;
  headers_json: string;
  source_projection: "EPSG:3857";
  default_longitude: number;
  default_latitude: number;
  default_zoom: number;
  renderer_id: string;
  capabilities_json: string;
  cache_policy_json: string;
  download_policy_json: string;
  created_at: string;
  updated_at: string;
}

function parseJson<Value>(value: string): Value {
  return JSON.parse(value) as Value;
}

function fromRow(row: MapSetRow): MapSet {
  return {
    id: row.id,
    name: row.name,
    sourceType: row.source_type,
    urlTemplate: row.url_template,
    attribution: row.attribution,
    termsUrl: row.terms_url,
    notes: row.notes,
    termsReviewedAt: row.terms_reviewed_at,
    minZoom: row.min_zoom,
    maxZoom: row.max_zoom,
    tileSize: row.tile_size,
    tileFormat: row.tile_format,
    subdomains: parseJson(row.subdomains_json),
    headers: parseJson(row.headers_json),
    sourceProjection: row.source_projection,
    defaultCenter: {
      longitude: row.default_longitude,
      latitude: row.default_latitude,
    },
    defaultZoom: row.default_zoom,
    rendererId: row.renderer_id,
    capabilities: parseJson(row.capabilities_json),
    cachePolicy: parseJson(row.cache_policy_json),
    downloadPolicy: parseJson(row.download_policy_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const columns = `
  id, name, source_type, url_template, attribution, terms_url, notes,
  terms_reviewed_at, min_zoom, max_zoom, tile_size, tile_format,
  subdomains_json, headers_json, source_projection, default_longitude,
  default_latitude, default_zoom, renderer_id, capabilities_json,
  cache_policy_json, download_policy_json, created_at, updated_at
`;

function values(mapSet: MapSet): Array<string | number> {
  return [
    mapSet.id,
    mapSet.name,
    mapSet.sourceType,
    mapSet.urlTemplate,
    mapSet.attribution,
    mapSet.termsUrl,
    mapSet.notes,
    mapSet.termsReviewedAt,
    mapSet.minZoom,
    mapSet.maxZoom,
    mapSet.tileSize,
    mapSet.tileFormat,
    JSON.stringify(mapSet.subdomains),
    JSON.stringify(mapSet.headers),
    mapSet.sourceProjection,
    mapSet.defaultCenter.longitude,
    mapSet.defaultCenter.latitude,
    mapSet.defaultZoom,
    mapSet.rendererId,
    JSON.stringify(mapSet.capabilities),
    JSON.stringify(mapSet.cachePolicy),
    JSON.stringify(mapSet.downloadPolicy),
    mapSet.createdAt,
    mapSet.updatedAt,
  ];
}

export class MapSetRepository {
  constructor(private readonly database: DatabaseSync) {}

  list(): MapSet[] {
    return (
      this.database
        .prepare(
          `SELECT ${columns} FROM map_sets ORDER BY name COLLATE NOCASE, id`,
        )
        .all() as unknown as MapSetRow[]
    ).map(fromRow);
  }

  get(id: string): MapSet | undefined {
    const row = this.database
      .prepare(`SELECT ${columns} FROM map_sets WHERE id = ?`)
      .get(id) as MapSetRow | undefined;
    return row === undefined ? undefined : fromRow(row);
  }

  insert(mapSet: MapSet): void {
    const placeholders = Array.from({ length: 24 }, () => "?").join(", ");
    this.database
      .prepare(`INSERT INTO map_sets (${columns}) VALUES (${placeholders})`)
      .run(...values(mapSet));
  }

  update(mapSet: MapSet): void {
    const assignments = [
      "name",
      "source_type",
      "url_template",
      "attribution",
      "terms_url",
      "notes",
      "terms_reviewed_at",
      "min_zoom",
      "max_zoom",
      "tile_size",
      "tile_format",
      "subdomains_json",
      "headers_json",
      "source_projection",
      "default_longitude",
      "default_latitude",
      "default_zoom",
      "renderer_id",
      "capabilities_json",
      "cache_policy_json",
      "download_policy_json",
      "created_at",
      "updated_at",
    ]
      .map((column) => `${column} = ?`)
      .join(", ");
    const result = this.database
      .prepare(`UPDATE map_sets SET ${assignments} WHERE id = ?`)
      .run(...values(mapSet).slice(1), mapSet.id);
    if (result.changes !== 1) {
      throw new Error("Map Set update did not affect exactly one row.");
    }
  }

  delete(id: string): boolean {
    return (
      this.database.prepare("DELETE FROM map_sets WHERE id = ?").run(id)
        .changes === 1
    );
  }
}
