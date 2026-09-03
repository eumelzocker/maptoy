---
id: tile-cache
title: Tile Cache
language: en
---

# Tile Cache

*maptoy* stores successfully validated raster tiles as immutable revisions below
`MAPTOY_STORAGE_DATA_DIR/tiles`. SQLite contains the revision history and current pointers;
the image bytes remain directly accessible in the host data directory.

## Refresh modes

Normal map requests use `auto`: a current revision is returned until its configured
maximum age expires. A stale or missing tile is requested from the provider. Where
available, *maptoy* sends `If-None-Match` or `If-Modified-Since`; a `304` response only
updates validation timestamps.

- `auto` uses a fresh cached revision and validates stale content.
- `force` contacts the provider regardless of the configured maximum age.
- `cache-only` never contacts the provider. When the selected tile is unavailable,
  *maptoy* returns a diagonally striped `no_cache` PNG in the configured Tile size
  with its `z`, `x`, and `y` coordinates and `X-Maptoy-Cache: miss`.

The API accepts the mode as `?refresh=auto`, `?refresh=force`, or
`?refresh=cache-only`. Concurrent requests for the same uncached logical tile share
one provider request. The Map view's **Cached Tiles Only** display option uses
`cache-only`; missing Tiles are therefore visible as hatched areas instead of
triggering provider traffic. Generated error Tile bytes are cached in server memory,
while their HTTP responses use `Cache-Control: no-store` so a newly archived Tile
can replace the placeholder immediately.

## External Tile seeding

Trusted API clients can seed one logical Tile without contacting its configured
provider:

```sh
curl --request POST \
  --header 'Content-Type: image/png' \
  --header 'X-Maptoy-Upstream-ETag: "tile-v1"' \
  --header 'X-Maptoy-Upstream-Last-Modified: Wed, 02 Sep 2026 08:00:00 GMT' \
  --data-binary '@tile.png' \
  "$MAPTOY_SERVER_URL/api/map-sets/$MAP_SET_ID/tiles/10/550/335"
```

The request body is the unmodified PNG, JPEG, or WebP file; this endpoint does not
use multipart encoding. The file must decode successfully; its media type and
actual image format must match the Map Set's configured Tile format, and its width
and height must equal the configured Tile size. Coordinates must be inside the Map Set's zoom and XYZ
bounds, its Tile Archive capability and cache policy must be enabled, and both
`MAPTOY_TILES_MAX_BYTES` and the Map Set storage limit apply.

Trusted clients may supply an `ETag` and `Last-Modified` value observed on the
exact upstream representation as `X-Maptoy-Upstream-ETag` and
`X-Maptoy-Upstream-Last-Modified`. maptoy stores these optional validators and can
use them for its next conditional provider request. Do not forward validators from
a different URL, request-header variant, or representation: a misleading validator
can cause the provider's `304` response to validate the wrong uploaded bytes.

A new immutable revision returns `201` and
`{ "revisionId": "...", "created": true }`. Uploading bytes equal to the current
revision returns `200` with `created: false`, updates only its observation times,
and consumes no additional storage. Uploaded revisions have origin `upload`; later
normal and `cache-only` reads return those exact bytes without contacting the
provider while the revision is fresh.

Upload errors use these contracts:

- `415 TILE_MEDIA_TYPE_INVALID` for a missing, unsupported, or Map-Set-mismatched
  Content-Type.
- `400 TILE_CONTENT_INVALID` when the image cannot be decoded or its actual format
  or dimensions do not match the Map Set.
- `400 TILE_VALIDATOR_INVALID` when an optional upstream ETag or Last-Modified
  value is malformed or exceeds its limit.
- `409 TILE_ARCHIVE_DISABLED` when archival capability or cache policy is disabled.
- `413 TILE_BODY_TOO_LARGE` when the route-specific `MAPTOY_TILES_MAX_BYTES` limit is
  exceeded.
- `507 TILE_STORAGE_LIMIT` when the Map Set's storage limit would be exceeded.

*maptoy* v1 has no application authentication. This write endpoint is intended only
for trusted private clients. If *maptoy* is reachable over an untrusted network, the
reverse proxy must authenticate and authorize access; do not publish the upload
route without such protection. The operator remains responsible for ensuring that
seeded bytes and validators belong to the configured source and representation and
may lawfully be stored.

## Immutable revisions

New bytes create a revision addressed by their SHA-256 hash. Earlier revisions are
not overwritten. If provider content changes from A to B and later back to A,
*maptoy* records three temporal revisions while reusing the original A file.
Each revision also records whether its creating bytes came from the `provider` or
an API `upload`.

Files use this layout:

```text
tiles/<map-set-id>/<z>/<x>/<y>.<content-hash>.<ext>
```

Temporary files are written below the managed data directory and atomically moved
only after content type, actual image format, dimensions, decodability, size, and
hash have been checked.

## Selecting a cache state

The default tile URL returns the current revision. Read-only historical selections
are available with exactly one of these query parameters:

- `snapshot=<snapshot-id>` selects the revision captured by an immutable snapshot.
- `asOf=<ISO-8601 timestamp>` selects the revision known at that time.
- `revision=<tile-revision-id>` selects one explicit revision.

Historical selection never causes a provider request.

## Snapshots and comparison

Open **Tile Cache** to create a named snapshot of all current revisions for the
Map Set. A snapshot does not copy image files. It stores explicit protected
references, making later reads reproducible.

The same view compares a snapshot with the current state by content hash and reports
identical, changed, added, and missing tiles. Deleting a snapshot removes only those
references, not Tile Revisions. Comparison counters are aggregated in SQLite rather
than loading every Tile hash into server memory.

## Coverage map

Open **Coverage** to inspect a bounded part of the Tile Archive on a map. Choose a
Map Set, source Zoom, and one of the current state, an immutable Snapshot, or an
ISO-8601 point in time. The map classifies the selected area as fresh, stale,
or missing. The **Cache state** controls can be collapsed when they are not needed.

Select a cell for Revision count, selected byte size, and validation times. The
sidebar scrolls the cell details into view. The **Aggregation-Grid** information
tooltip shows how many source Tiles each grid cell represents. The legend also
provides a persisted **Show grid** toggle; when disabled, grid boundaries are
hidden and only colored cells can be selected.

Coverage requests are limited to the visible geographic bounds and never return
more than 4,096 cells. The default UI asks for at most 1,024. SQLite aggregates
stored Revision metadata before sending the response; the browser does not receive
every Tile row from a large cache. Missing counts are derived from the complete XYZ
coordinate range inside the requested bounds, so inspecting Coverage never contacts
the provider or creates cache entries. The background map is separate from that
read-only query: it uses the normal `auto` Tile mode and may fetch, validate, and
cache background Tiles through the configured provider.

### Batch Downloads in Coverage

Expand **Download tiles** in the Coverage sidebar, drag a rectangle directly on the
map, use the complete visible map area, or enter exact WGS84 bounds. Press `Esc` to
cancel an active map selection. `Ctrl`+click on the map activates selection without
using the sidebar button; `Ctrl`+drag selects the rectangle immediately. Then choose
a minimum and maximum source Zoom. The
default downloads only missing Tiles; the optional mode also revalidates stale
Tiles. The estimate updates before admission and reports cache-aware request counts,
transfer size when a cached sample exists, configured warning and hard limits, and
remaining daily requests.

Review the linked provider terms and explicitly accept responsibility before
queuing the Job. Running Jobs remain in the same sidebar with progress, current
Tile, pause, resume, cancel, retry, and bounded error details. Finished Jobs are
grouped in a nested collapsible history. The selected bounds remain visible when
the Download section is collapsed, and the current worker Tile appears with them as
purple overlays above Coverage without changing its status colors. The
**Selection** display checkbox can hide or restore the selected bounds. A **Download
tiles** action on each capable Map Set opens this same Coverage workflow; there is
no separate Downloads page.

## Statistics and deletion

The management view loads database totals and per-zoom summaries without walking
the Tile directory. The Revision Explorer remains empty until requested, then loads
at most 50 rows per page with optional zoom and current/historical filters. This
keeps the initial page bounded even for large archives. The state chip previews the
exact selected revision on demand without contacting the provider.

**Check consistency** explicitly scans the managed directory and reports physical
bytes, missing referenced files, and unreferenced files. The scan is not part of a
normal page load and may take a while for a large cache. Storage limits can reject
new content but never delete history automatically.

Only an explicit action can delete a historical Tile Revision. Current revisions and
snapshot-referenced revisions are protected. A content file is deleted only after
its final revision reference has been removed.

**Repair** becomes available only after a successful consistency check in the
current browser session and requires explicit confirmation. It removes
unreferenced files left by interrupted writes. It
also removes unusable Tile Revision records whose content files no longer exist,
clears affected current pointers and snapshot entries, and removes empty logical
tiles. Existing content files are never removed while the database still references
them. This action cannot be undone.
