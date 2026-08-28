---
id: layers
title: Layers, tracks, and external images
language: en
---

# Layers, tracks, and external images

Layers are optional features of the standard **Map** view. Open the Layers tool in
the lower-left corner of the map. There is no separate layer page, and Coverage
continues to describe only the Tile Archive.

## Shared layer model

Layer plugins build on reusable point, line, and area geometry. Geometry and feature
properties are stored independently from colors, widths, marker styles, opacity, and
other presentation options. The Track plugin specializes lines and can retain
timestamp and elevation data per vertex. The Image plugin specializes points; an
image with geographic bounds uses the separate raster-overlay contract rather than a
vector polygon. This foundation can also support POIs, routes, and regions in future
plugins.

Use **Add layer** and its icon choices to create a Track or Images layer. The name
is optional; an empty field gets the next free numbered name, such as `Track 1`.
After creation, the new Layer editor opens and focuses its import or scan control.
Layers form one global overlay stack independent of Map Sets. Changing the
Map Set replaces only the base map and reattaches the same overlays with their
existing order, visibility, opacity, Zoom range, and configuration. A missing or
incompatible build-time plugin disables its layer and reports a diagnostic without
deleting stored data. Plugins cannot be installed through the browser or API.

The first hierarchy level comes from the plugin category, such as **Tracks** or
**Images**. Use `/` in the Layer name for deeper folders:
`Trips/2026/Alps` appears below `Tracks > Trips > 2026`. Renaming the Layer changes
this path; no separate folder records are created. Categories and every generated
folder level can be collapsed independently. Those display preferences are retained
in the browser.

## Importing tracks

Create a Track layer and choose **Import GPX/GeoJSON**. The upload is assigned a
generated Asset ID and stored below `MAPTOY_DATA_DIR/layer-assets`; the original
client filename is metadata only. GPX track segments and GeoJSON LineString or
MultiLineString features are normalized into the shared line model. GPX DTD and
entity declarations are rejected. The upload is limited by
`MAPTOY_MAX_LAYER_ASSET_BYTES` and validated by the Track plugin before the layer is
updated.

## External image roots

*maptoy never imports image originals into its data directory.* An operator exposes
one or more existing directories as named, read-only image roots. The server setting
maps a safe ID to an absolute container path, for example:

```dotenv
MAPTOY_IMAGE_ROOTS_JSON={"photos":"/images/photos"}
```

The matching host directory must be mounted read-only. With the repository's sample
override this is:

```sh
MAPTOY_PHOTOS_DIR=/srv/photos docker compose \
  -f compose.yaml -f compose.images.example.yaml up --build
```

Only the stable root ID is exposed to clients. Scan requests accept a normalized
relative subdirectory; absolute paths, parent traversal, and symbolic-link escapes
are rejected.

## Scanning images

Create an Images layer, select an image root and optional subdirectory, choose
whether the scan is recursive, and select **Scan directory**. The persistent job can
be paused, resumed, or cancelled. An interrupted running scan returns to the queue
after restart.

The first scan extracts selected metadata, creates an EXIF-oriented, metadata-free
WebP preview, and records a size/mtime fingerprint. Unchanged files are skipped on
later scans before decoding. Changed files are reprocessed. Files no longer present
are marked `missing`; their metadata and existing preview remain available.

EXIF GPS is immediately used as the effective point coordinate. There is no separate
“detected” and “accepted” coordinate. Open **Manage images** to correct or remove the
point, or to enter west/south/east/north bounds for a raster overlay. A manual
position—or a deliberate removal—is never overwritten by a later scan. Only a
position whose source is still `exif` may be refreshed from a changed original.

## What is stored

SQLite stores the layer instances, normalized Track data, Asset IDs, external image
root IDs and relative paths, selected metadata, fingerprints, effective coordinates,
bounds, statuses, and persistent jobs. `MAPTOY_DATA_DIR` stores managed non-image
uploads and derived image previews. Image originals remain exclusively in the
configured external roots and are not returned by the preview endpoint.

Back up `MAPTOY_DATA_DIR` for the catalog and previews. Back up external image roots
separately if their originals must be preserved.

## Image limits

The defaults are 100 MiB per image, 100 million decoded pixels, a 640-pixel preview
edge, batches of 100, two concurrent decoders, and at most 100,000 files per scan.
Configure these with `MAPTOY_MAX_IMAGE_BYTES`, `MAPTOY_MAX_IMAGE_PIXELS`,
`MAPTOY_IMAGE_PREVIEW_MAX_EDGE`, `MAPTOY_IMAGE_SCAN_BATCH_SIZE`,
`MAPTOY_IMAGE_DECODER_CONCURRENCY`, and `MAPTOY_MAX_IMAGE_SCAN_FILES`. The server
also enforces hard ceilings to reject unsafe configuration values at startup.
