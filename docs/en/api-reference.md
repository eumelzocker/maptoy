---
id: api-reference
title: API reference
language: en
---

# API reference

This is more of an introduction to the API than an actual API reference.

All API paths are relative to *maptoy*'s public entry URL and start with `api/`.
Error responses use `{ "error": { "code": "...", "message": "..." } }`.

## Tile retrieval

`GET api/map-sets/:id/tiles/:z/:x/:y` returns PNG, JPEG, or WebP bytes. The optional
`refresh` query is `auto`, `force`, or `cache-only`. Exactly one historical selector
may be supplied as `snapshot`, `asOf`, or `revision`. Successful archived responses
include `X-Maptoy-Tile-Revision` and `X-Maptoy-Cache` headers. An unavailable
`cache-only` Tile returns a generated `no_cache` PNG with `X-Maptoy-Cache: miss` and
`Cache-Control: no-store`. The image identifies the missing Tile by its `z`, `x`,
and `y` coordinates and never causes a provider request. With
`missing=transparent`, the same cache miss returns a fully transparent PNG instead;
Map Set Layers use this variant so an absent overlay Tile does not cover the base
map.

## Tile upload

`POST api/map-sets/:id/tiles/:z/:x/:y` seeds unmodified image bytes without a
provider request. Set `Content-Type` to the Map Set's configured `image/png`,
`image/jpeg`, or `image/webp`; do not use JSON or multipart encoding. The image
must be decodable, its actual format must match the configured format, and its
width and height must both equal the Map Set's configured Tile size.

Trusted clients may also send `X-Maptoy-Upstream-ETag` and
`X-Maptoy-Upstream-Last-Modified` when those values were observed on the exact
upstream representation being uploaded. The values become conditional validators
for maptoy's next provider request; they do not change the revision's `upload`
origin. Omit them unless the source URL and representation match the Map Set.

The binary request schema is bounded by `MAPTOY_TILES_MAX_BYTES`. A successful JSON
response follows this contract:

```json
{
  "revisionId": "d90e2f11-1421-48b6-b02d-09fd029bc550",
  "created": true
}
```

A newly created revision returns `201`; bytes identical to the current revision
return `200` and `created: false`. Both include the same revision ID in
`X-Maptoy-Tile-Revision`. Revision list responses expose `origin` as `provider` or
`upload`.

| Status | Error code | Meaning |
| --- | --- | --- |
| `400` | `MAP_SET_INVALID` | Coordinate or Zoom is outside the Map Set bounds. |
| `400` | `TILE_CONTENT_INVALID` | Image cannot be decoded or its actual format or dimensions do not match the Map Set. |
| `400` | `TILE_VALIDATOR_INVALID` | An optional upstream ETag or Last-Modified value is malformed or too long. |
| `404` | `MAP_SET_NOT_FOUND` | The Map Set does not exist. |
| `409` | `TILE_ARCHIVE_DISABLED` | Cache policy or Tile Archive capability is disabled. |
| `413` | `TILE_BODY_TOO_LARGE` | Raw body exceeds `MAPTOY_TILES_MAX_BYTES`. |
| `415` | `TILE_MEDIA_TYPE_INVALID` | Content-Type is missing, unsupported, or mismatched. |
| `507` | `TILE_STORAGE_LIMIT` | The Map Set storage limit would be exceeded. |

## Coverage query

`POST api/map-sets/:id/coverage/query` returns an aggregated, read-only Coverage
grid. The JSON body contains WGS84 `bounds`, one source `zoom`, a `selection`, an
optional `compareTo`, and an optional `maximumCells` between 1 and 4,096. A
selection is `{"kind":"current"}`, `{"kind":"snapshot","snapshotId":"..."}`,
or `{"kind":"asOf","timestamp":"..."}`.

The response reports the chosen `aggregationZoom`, total Tile, Revision, byte,
freshness, and comparison counts, followed by bounded geographic cells with the
same metadata. Status counts contain `fresh`, `stale`, and `missing`.
Comparison counts contain `identical`, `changed`, `added`, and `missing`. The
endpoint reads SQLite metadata only and never contacts a provider.

Invalid bounds, Zooms, or timestamps return `400 COVERAGE_QUERY_INVALID`; an
unknown Snapshot returns `404 SNAPSHOT_NOT_FOUND`.

## Batch Downloads

`POST api/map-sets/:id/tile-downloads/estimate` accepts WGS84 `bounds`,
`minimumZoom`, `maximumZoom`, and a `refreshMode` of `missing` or
`missing-or-stale`. It returns exact selected, fresh, stale, missing, and provider
request counts, an estimated transfer size when cached samples exist, daily-limit
capacity, warnings, and blocking reasons. Estimation never contacts the provider.

`POST api/map-sets/:id/tile-download-jobs` accepts the same body and reruns the
admission checks before creating a persistent Job. Only one queued, running, or
paused Tile Download per Map Set is allowed. The worker applies the Map Set's
request rate, concurrency, retry, daily request, and storage policies. HTTP 429 and
503 use `Retry-After` when supplied; other retries use bounded exponential backoff.
Individual Tile failures remain in the bounded Job error history and do not abort
the remaining batch.

## Layers and assets

`GET api/layers` lists the global overlay stack. Data and decoration Layer instances
are independent of Map Sets; the built-in Map Set Layer stores an explicit Map Set
reference and provider-access option in its validated configuration. `POST api/layers`, `GET api/layers/:id`, `PATCH api/layers/:id`, and
`DELETE api/layers/:id` provide generic CRUD using the registered plugin's
validation. `name` is required and uses non-empty `/`-separated segments as the
hierarchy below the plugin category.

`GET api/layers/:id/assets` cursor-paginates the Asset catalog. `POST` to the same
path accepts one plugin-validated `multipart/form-data` non-image file. Its maximum
size is `MAPTOY_LAYERS_ASSET_MAX_BYTES`.
`GET api/layers/:id/assets/extent` returns only the count and smallest
antimeridian-aware bounds of ready, positioned external Photos, allowing map fitting
without transferring every Asset page. `GET api/layers/:id/assets/:assetId` returns
the controlled managed file or an external photo's derived WebP preview. It never
returns an external photo original. `PATCH` updates or clears a photo's complete
point coordinate. External Photo Assets optionally include typed `photoMetadata`
with capture, camera, exposure, and IPTC caption values collected during scanning.

`GET api/photos/directory` reports whether `MAPTOY_PHOTOS_DIR` is configured and
available without returning its path. `GET api/photos/directories?parent=...` lists
the direct subdirectories of a safe relative parent for the directory browser. It
returns relative navigation paths only, skips symbolic links, and rejects traversal
outside the configured root. `POST api/layers/:id/photo-scan-jobs` accepts a relative
`relativeDirectory` and `recursive`. It creates a persistent scan Job.

## Jobs

`GET api/jobs` lists Jobs and `GET api/jobs/:id` reads one Job. A controllable Job
in a valid state uses `POST api/jobs/:id/pause`,
`POST api/jobs/:id/resume`, and `POST api/jobs/:id/cancel`. Responses include
`total`, `completed`, `skipped`, `failed`, status timestamps, and a safe last error.
Photo scans additionally persist `summary` counts for `created`, `changed`,
`unchanged`, `missing`, and `failed` files.

Failed, cancelled, or partially completed Tile Downloads can be restarted with
`POST api/jobs/:id/retry`. This creates a new Job with the same bounds and skips
Tiles that already satisfy its refresh mode.

`GET api/jobs/:id/errors` returns the newest retained per-item diagnostics. Their
bounded history is configured with `MAPTOY_JOBS_ERROR_HISTORY_LIMIT`.
`POST api/jobs/cleanup` applies `MAPTOY_JOBS_RETENTION_DAYS` immediately and reports
the cutoff and number of removed terminal Jobs. The same cleanup runs at startup
and hourly. It never removes queued, running, or paused Jobs.

## Security boundary

*maptoy* v1 does not authenticate API requests. The Tile upload is a write operation
that can replace the current map state and consume storage. Run it only in a trusted
private environment, or require authentication and authorization at a reverse
proxy before allowing access from an untrusted network.
