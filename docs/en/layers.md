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
timestamp and elevation data per vertex. The Photo plugin specializes points. This
foundation can also support POIs, routes, and regions in future plugins.

Use **Add layer** and its icon choices to create a Track, Photos, or Decorations
layer. The name is optional; an empty field gets the next free numbered name, such
as `Track 1`.
After creation, the new Layer is selected in the tree dropdown, its single editor
opens, and its import or scan control receives focus. The checkboxes in the dropdown
change visibility without changing the editor selection. Opening the Layers tool
without an explicit target restores the last locally stored Layer, or selects the
first visible Layer if that preference is unavailable. The general **Opacity**
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

Create a Photos layer, choose whether the scan is recursive, and select
**Scan directory…**. The directory browser exposes only folders below the configured
photo directory and never discloses its absolute path. Navigate into a subdirectory
and select **Scan this directory**. Selecting the configured root itself is disabled
in the browser, which makes it practical to assign a separate source folder to each
Photos layer. The persistent job can be paused, resumed, or cancelled. An interrupted
running scan returns to the queue after restart. Detailed scan results remain visible
until the Layers dialog closes. On reopening, the latest folder relative to
`MAPTOY_PHOTOS_DIR` and the loaded Photo count appear above the scan action instead.
The folder and recursive setting are restored from that Layer's latest Job.

The first scan admits only photos with a complete, valid EXIF GPS point into the
catalog. It creates an EXIF-oriented, metadata-free WebP preview and records a
size/mtime fingerprint for each admitted photo. Photos without a valid location are
not stored, and the scan result reports their separate skipped count. Unchanged
cataloged files are skipped on later scans before decoding. Changed files are
reprocessed. Files no longer present are marked `missing`; their metadata and
existing preview remain available.

The browser does not preload every Asset page for every Layer. Selecting a Photo
Layer loads its first catalog page, and **Load more photos** follows the server's
cursor when needed. The Map exhausts cursor pages only for visible Photo Layers so
hidden catalogs do not delay initial Layer loading.

EXIF GPS is immediately used as the effective point coordinate. There is no separate
“detected” and “accepted” coordinate. Open **Manage photos** to correct or remove the
point. A manual position—or a deliberate removal—is never overwritten by a later
scan. Only a position whose source is still `exif` may be refreshed from a changed
original. **Center map here** uses the currently entered position without saving it
or changing the map zoom. **Fit photos on map** requests only the Layer's compact
coordinate extent and adjusts map center and zoom so all positioned Photos fit.
The **Photo position** dialog also shows every captured metadata value for the
selected Photo independently of the map popup field configuration.

Nearby Photo markers are clustered by default using a configurable screen-pixel
radius. Cluster pins update after pan or zoom and show their Photo count. Clicking a
cluster opens a scrollable overview with reduced previews, filenames, and configured
popup details for up to 100 lazily loaded Photos without changing the zoom. Larger
clusters also report the remaining count. Disable **Cluster nearby photos** to render every
marker independently. Hovering an individual marker opens its preview popup instead of a filename tooltip;
click remains available for touch and pointer interaction. The popup shows the
filename, point coordinate in DMS notation, and available capture time below the
image. This field selection is currently configured in code. Manufacturer, camera
model, ISO, f-stop, shutter speed, and IPTC caption remain stored for a later
user-configurable popup selection but are initially hidden.
Individual and cluster popups choose a position above or below their marker based on
the available map space, correct horizontal overflow, and constrain their height
without automatically moving the map when they open.

## What is stored

SQLite stores the layer instances, normalized Track data, Asset IDs, relative photo
paths, selected metadata, fingerprints, effective coordinates, statuses, and
persistent jobs. Selected Photo metadata includes capture time, manufacturer, camera
model, ISO, f-stop, shutter speed in seconds, and `IPTC.caption` when present.
`MAPTOY_STORAGE_DATA_DIR` stores managed non-image
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
