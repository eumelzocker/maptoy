---
id: layers
title: Layers
language: en
---

# Layers

Layers are optional features of the standard **Map** view. Open the Layers tool in
the lower-left corner of the map. There is no separate layer page, and Coverage
continues to describe only the Tile Archive.

## Shared layer model

Layer plugins build on reusable point, line, and area geometry. Geometry and feature
properties are stored independently from colors, widths, marker styles, opacity, and
other presentation options. A Layer may also be purely decorative and derive its
visible content from the current map without storing Features or Assets. The Track plugin specializes lines and can retain
timestamp and elevation data per vertex. The Photo plugin specializes points; a
photo with geographic bounds uses the separate raster-overlay contract rather than a
vector polygon. This foundation can also support POIs, routes, and regions in future
plugins.

Use **Add layer** and its icon choices to create a Track, Photos, or Decorations
layer. The name is optional; an empty field gets the next free numbered name, such
as `Track 1`.
After creation, the new Layer is selected in the tree dropdown, its single editor
opens, and its import or scan control receives focus. The checkboxes in the dropdown
change visibility without changing the editor selection. The general **Opacity**
slider applies to the complete Layer in both the interactive map and exports.
Layers form one global overlay stack independent of Map Sets. Changing the
Map Set replaces only the base map and reattaches the same overlays with their
existing order, visibility, opacity, Zoom range, and configuration. A missing or
incompatible build-time plugin disables its layer and reports a diagnostic without
deleting stored data. Plugins cannot be installed through the browser or API.

The first hierarchy level comes from the plugin category, such as **Tracks** or
**Photos**, or **Decorations**. Use `/` in the Layer name for deeper folders:
`Trips/2026/Alps` appears below `Tracks > Trips > 2026`. Renaming the Layer changes
this path; no separate folder records are created. Categories and every generated
folder level can be collapsed independently. Those display preferences are retained
in the browser.

## Tile Grid decoration

For quick access, enable **Show Tile Grid** in the Map view's Display Options or
context menu. maptoy reuses the Tile Grid layer named `Default Grid`, including its
current configuration, or creates it with default settings when it does not exist.
Turning the option off hides that Layer without deleting it. You can edit, hide, or
delete `Default Grid` like any other Layer in the Layers panel; the quick
option follows its visibility and is off by default.

Create the **Decorations** layer to display the boundaries of the XYZ Tiles used by
the active base map. Every visible Tile is labeled as `z/x/y` using its actual
integer source Zoom and canonical X coordinate. The labels therefore continue to
match requested Tiles at quarter-step map Zoom, with 256- or 512-pixel Tiles, and
when the map wraps across the antimeridian.

The same Layer can show a metric scale across the visual center of every visible
Tile, with its `z/x/y` label placed just above it. Every bar keeps the configured
width of 25–100 percent of its Tile while its labels describe the local distance at
that exact latitude and source Zoom. Three readable
intermediate distances and the exact rounded endpoint are shown. Each main interval
is divided into ten alternating black and white sections; a final proportional
section represents any remainder. Grid, labels, and scales can be toggled
independently. The Layer editor also controls line, text, and label-background
colors and their individual transparency; the shared Layer controls continue to
provide opacity and Zoom limits.

The Tile Grid stores only its validated configuration and general Layer settings.
It creates no imported Asset, background Job, or persistent map Feature. Changing
the Map Set keeps the Layer instance and recalculates the decoration for the new
base map.

## Importing tracks

Create a Track layer and choose the highlighted **Import track…** action. After a
successful import, the secondary action is named **Replace track…** because another
file replaces the normalized Track geometry. Both actions accept GPX and GeoJSON.
The upload is assigned a
generated Asset ID and stored below `MAPTOY_STORAGE_DATA_DIR/layer-assets`; the original
client filename is metadata only. GPX track segments and GeoJSON LineString or
MultiLineString features are normalized into the shared line model. GPX DTD and
entity declarations are rejected. The upload is limited by
`MAPTOY_LAYERS_ASSET_MAX_BYTES` and validated by the Track plugin before the layer is
updated.

## External photo directory

*maptoy never imports photo originals into its data directory.* Set the existing
host directory in the repository `.env` file:

```dotenv
MAPTOY_PHOTOS_DIR=/srv/photos
```

Start maptoy normally:

```sh
docker compose up --build
```

The standard Compose file mounts the directory read-only at `/photos` inside the
container and configures maptoy to use it. The photo limit variables already have
defaults and do not need to be changed for a first test. After startup,
`GET api/photos/directory` reports `available: true` when the mount is readable;
neither absolute path is returned. Scan requests accept a normalized relative
subdirectory; absolute paths, parent traversal, and symbolic-link escapes are
rejected.

## Scanning photos

Create a Photos layer, enter an optional subdirectory, choose whether the scan is
recursive, and select **Scan directory**. The persistent job can
be paused, resumed, or cancelled. An interrupted running scan returns to the queue
after restart.

The first scan extracts selected metadata, creates an EXIF-oriented, metadata-free
WebP preview, and records a size/mtime fingerprint. Unchanged files are skipped on
later scans before decoding. Changed files are reprocessed. Files no longer present
are marked `missing`; their metadata and existing preview remain available.

The browser does not preload every Asset page for every Layer. Selecting a Photo
Layer loads its first catalog page, and **Load more photos** follows the server's
cursor when needed. The Map exhausts cursor pages only for visible Photo Layers so
hidden catalogs do not delay initial Layer loading.

EXIF GPS is immediately used as the effective point coordinate. There is no separate
“detected” and “accepted” coordinate. Open **Manage photos** to correct or remove the
point, or to enter west/south/east/north bounds for a raster overlay. A manual
position—or a deliberate removal—is never overwritten by a later scan. Only a
position whose source is still `exif` may be refreshed from a changed original.

## What is stored

SQLite stores the layer instances, normalized Track data, Asset IDs, relative photo
paths, selected metadata, fingerprints, effective coordinates,
bounds, statuses, and persistent jobs. `MAPTOY_STORAGE_DATA_DIR` stores managed non-image
uploads and derived photo previews. Photo originals remain exclusively in the
configured external directory and are not returned by the preview endpoint.

Back up `MAPTOY_STORAGE_DATA_DIR` for the catalog and previews. Back up the external
photo directory separately if its originals must be preserved.

## Photo limits

The defaults are 100 MiB per photo, 100 million decoded pixels, a 640-pixel preview
edge, batches of 100, two concurrent decoders, and at most 100,000 files per scan.
Configure these with `MAPTOY_PHOTOS_MAX_FILE_BYTES`, `MAPTOY_PHOTOS_MAX_DECODED_PIXELS`,
`MAPTOY_PHOTOS_PREVIEW_MAX_EDGE`, `MAPTOY_PHOTOS_SCAN_BATCH_SIZE`,
`MAPTOY_PHOTOS_SCAN_CONCURRENCY`, and `MAPTOY_PHOTOS_SCAN_MAX_FILES`. The server
also rejects configuration above 256 MiB, 150 million decoded pixels, a 2048 px
preview edge, batch size 1,000, four decoders, or 250,000 files at startup. The
defaults and ceilings are backed by the reproducible Phase 5 Photo benchmark.
