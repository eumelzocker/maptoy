---
id: glossary
title: Glossary
language: en
---

# Glossary

This glossary defines map and maptoy concepts. Short forms are collected separately
in the [abbreviations directory](docs/en/abbreviations).

## Attribution

The text or mark that identifies a map's data and imagery providers. maptoy preserves
configured attribution in the interactive map and in exports where applicable.

## Bounds

A rectangular geographic extent, usually expressed by its western, southern,
eastern, and northern edges. In maptoy, bounds can define a download area, export
area, or the placement of an image layer.

## Cache

Local storage for tiles already retrieved from a provider. A cached tile can be used
without another provider request, subject to the selected refresh mode and revision.

## Cache snapshot

A named, immutable selection of exact tile revisions for one Map Set. A snapshot
makes later display, comparison, and export reproducible.

## Capability

A machine-readable statement that a provider, renderer adapter, or layer plugin
supports a function such as interactive display, caching, download, or export.

## Content hash

A cryptographic digest calculated from stored bytes. maptoy uses it to recognize
identical tile content and to address content files without discarding revision
history.

## Coordinate reference system

The rules that give coordinates a defined location on Earth. maptoy identifies
supported coordinate reference systems with EPSG codes.

## Coverage

A summary of which tiles exist for an area and zoom range. Coverage distinguishes
states such as fresh, stale, or missing.

## GeoJSON

A JSON-based format for geographic features and their properties. The track-layer
plugin can import supported line and point geometry from GeoJSON.

## Layer

Information drawn above the base map. In maptoy, a layer instance is managed by a
registered layer plugin and may contain tracks, positioned images, or other data.

## Logical tile

The identity of a tile within a Map Set, defined by its zoom and `x`/`y` coordinates.
One logical tile may have several immutable tile revisions.

## Map Set

A maptoy configuration that combines a map source, renderer adapter, display
settings, cache and download policies, and assigned layers. Secret values are
referenced from the environment rather than stored in the Map Set.

## Provider

The external source from which map tiles are requested. Its current terms,
attribution requirements, technical limits, and permitted uses remain the user's
responsibility to review and follow.

## Renderer adapter

The component that connects maptoy's neutral map interface to a concrete browser
renderer. Version 1.0 supplies the Leaflet/XYZ adapter.

## Reprojection

The conversion of geographic data or a raster image from one coordinate reference
system to another. Reprojection can change shape, scale, and visible extent.

## Tile

A small, rectangular map image at one zoom level and `x`/`y` position. Adjacent
tiles form the map visible in the renderer or an export.

## Tile revision

An immutable record of tile content observed at a particular time. It stores the
content hash and validation metadata while preserving earlier and later content.

## URL template

A provider URL containing placeholders such as `{z}`, `{x}`, and `{y}`. maptoy
resolves the placeholders for a requested tile and handles configured secret
references without storing their values in the Map Set.

## Web Mercator

The projected coordinate reference system commonly used by slippy maps and XYZ
tiles. Its identifier is `EPSG:3857`; its scale and area distortion increase toward
the poles.

## Zoom level

The `z` coordinate in an XYZ tile pyramid. A higher zoom level contains more tiles
and normally shows a smaller area in greater detail.
