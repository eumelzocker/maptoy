---
id: mapping-resources
title: Mapping Resources
language: en
---

# Mapping Resources

This page collects technical references for digital mapping, geospatial data,
map services, and cartographic software. It intentionally favors authoritative
specifications and project documentation over general programming material.

Last link review: **2026-08-29**.

## Coordinate systems, geodesy, and geometry

- [EPSG Geodetic Parameter Dataset](https://epsg.org/home.html) — The authoritative registry for coordinate reference systems, datums, coordinate operations, units, and areas of use identified by EPSG codes.
- [PROJ documentation](https://proj.org/en/stable/) — The reference for cartographic projections, datum transformations, transformation pipelines, command-line tools, and programming APIs.
- [OGC WKT for coordinate reference systems](https://www.ogc.org/standards/wkt-crs/) — The standard defines Well-Known Text representations for coordinate reference systems and coordinate operations.
- [OGC Simple Features Access](https://www.ogc.org/standards/sfa/) — The standard defines the common point, curve, surface, collection, WKT, WKB, and spatial-relation model used across GIS software.
- [GEOS documentation](https://libgeos.org/) — GEOS implements robust planar geometry predicates and operations based on the OGC Simple Features model.

## Tile grids, addressing, and tileset metadata

- [OpenStreetMap Slippy Map tilenames](https://wiki.openstreetmap.org/wiki/Slippy_map_tilenames) — This practical reference explains Web Mercator XYZ addressing, zoom levels, tile bounds, and coordinate-to-tile formulas.
- [OGC Two Dimensional Tile Matrix Set](https://www.ogc.org/standards/tms/) — The standard defines reusable tile matrices, scale levels, row and column indexing, limits, and tileset metadata for arbitrary coordinate systems.
- [OGC API — Tiles](https://ogcapi.ogc.org/tiles/) — This REST-oriented standard describes discovery and retrieval of raster, vector, coverage, and other geospatial tiles.
- [TileJSON specification](https://github.com/mapbox/tilejson-spec/tree/master/3.0.0) — TileJSON is a compact JSON metadata format for advertising tile URLs, bounds, zoom ranges, attribution, and vector layers.
- [Mapbox Vector Tile specification](https://github.com/mapbox/vector-tile-spec/tree/master/2.1) — MVT defines the Protocol Buffers encoding and geometry command model widely used for Web Mercator vector tiles.
- [MapLibre Tile specification](https://maplibre.org/maplibre-tile-spec/specification/) — MLT is an evolving column-oriented vector-tile specification whose documentation clearly marks stable and experimental features.

## Tile archives and raster containers

- [MBTiles specification](https://github.com/mapbox/mbtiles-spec) — MBTiles stores a Web Mercator raster or vector tileset in a SQLite database for transfer and local use.
- [PMTiles version 3 specification](https://github.com/protomaps/PMTiles/blob/main/spec/v3/spec.md) — PMTiles stores a tile pyramid in one range-readable archive suited to static HTTP or object storage.
- [OGC GeoPackage](https://www.ogc.org/standards/geopackage/) — GeoPackage defines a portable SQLite container for vector features, raster tiles, attributes, metadata, and extensions.
- [OGC GeoTIFF](https://www.ogc.org/standards/geotiff/) — GeoTIFF defines TIFF tags for georeferenced raster imagery, grids, coordinate systems, and model-space transforms.
- [OGC Cloud Optimized GeoTIFF](https://www.ogc.org/standards/ogc-cloud-optimized-geotiff/) — COG specifies tiled images, overviews, and HTTP range behavior for efficient remote raster access.

## Vector, track, and catalog formats

- [GeoJSON RFC 7946](https://datatracker.ietf.org/doc/html/rfc7946) — The IETF standard defines JSON geometries, features, collections, bounding boxes, coordinate order, and antimeridian behavior in WGS 84.
- [GPX 1.1 schema documentation](https://www.topografix.com/gpx/1/1/) — The schema is the definitive reference for WGS 84 waypoints, routes, tracks, segments, timestamps, elevation, and extensions.
- [OGC KML](https://www.ogc.org/standards/kml/) — KML defines an XML encoding for geographic annotations, overlays, camera views, styles, and time-aware globe or map content.
- [ESRI Shapefile driver notes](https://gdal.org/en/stable/drivers/vector/shapefile.html) — GDAL documents the legacy multi-file format's geometry, attribute, encoding, size, and indexing constraints.
- [FlatGeobuf specification](https://github.com/flatgeobuf/flatgeobuf#specification) — FlatGeobuf is a streaming binary feature format with an optional packed spatial index for range-based access.
- [GeoParquet specification](https://geoparquet.org/releases/) — GeoParquet standardizes geometry columns, coordinate reference metadata, bounds, and encodings in Apache Parquet files.
- [SpatioTemporal Asset Catalog](https://www.ogc.org/standards/stac/) — STAC defines interoperable JSON and API conventions for discovering geospatial assets by space, time, collection, and metadata.

## Web mapping APIs and services

- [OGC API overview](https://ogcapi.ogc.org/) — This index links the modular OpenAPI-based standards for maps, features, tiles, coverages, records, processing, routes, and related spatial resources.
- [OGC API — Features](https://ogcapi.ogc.org/features/) — The standard defines collection discovery, bounding-box and property queries, paging, filtering, and retrieval of individual geographic features.
- [OGC API — Maps](https://ogcapi.ogc.org/maps/overview.html) — The standard defines map-image requests with selectable datasets, styles, dimensions, extents, sizes, formats, and coordinate reference systems.
- [OGC API — Records](https://ogcapi.ogc.org/records/) — The standard defines discovery and querying of metadata records for datasets, services, and other geospatial resources.
- [OGC Web Map Service](https://www.ogc.org/standards/wms/) — WMS is the established parameterized HTTP interface for requesting georeferenced map images and optional feature information.
- [OGC Web Map Tile Service](https://www.ogc.org/standards/wmts/) — WMTS is the established capabilities-driven interface for serving maps through predefined tile matrix sets.
- [OpenStreetMap data access APIs](https://wiki.openstreetmap.org/wiki/APIs) — This overview distinguishes the editing API, Overpass queries, planet extracts, replication feeds, and other ways to obtain OSM data.

## Styling and browser rendering

- [MapLibre Style Specification](https://maplibre.org/maplibre-style-spec/) — The JSON specification defines sources, layers, expressions, filters, sprites, glyphs, terrain, and other rules for vector and raster map presentation.
- [MapLibre GL JS documentation](https://maplibre.org/maplibre-gl-js/docs/) — The TypeScript API renders GPU-accelerated vector tiles, raster sources, terrain, globe views, and styled interactive layers in browsers.
- [Leaflet API reference](https://leafletjs.com/reference) — Leaflet documents a compact browser API for maps, raster grids, GeoJSON, vector paths, overlays, controls, events, and coordinate conversion.
- [OpenLayers API](https://openlayers.org/en/latest/apidoc/) — OpenLayers provides projection-aware browser APIs for tiled, image, vector, vector-tile, WebGL, and OGC service sources.
- [Turf.js documentation](https://turfjs.org/docs/) — Turf supplies modular GeoJSON-based spatial analysis such as measurement, buffering, clipping, predicates, interpolation, and aggregation.

## Processing, storage, and desktop tools

- [GDAL documentation](https://gdal.org/en/stable/) — GDAL provides raster and vector data models, format drivers, georeferencing, conversion, reprojection, and processing APIs.
- [GDAL command-line programs](https://gdal.org/en/stable/programs/) — This reference covers inspection, conversion, warping, tiling, mosaics, overviews, raster algebra, and vector processing commands.
- [PostGIS manual](https://postgis.net/documentation/manual/) — PostGIS adds spatial types, indexes, predicates, measurements, transformations, raster operations, and format conversion to PostgreSQL.
- [QGIS user guide](https://docs.qgis.org/latest/en/docs/user_manual/) — QGIS documents desktop workflows for projections, layers, styling, editing, analysis, layouts, databases, and OGC services.
- [Tippecanoe documentation](https://github.com/felt/tippecanoe) — Tippecanoe builds scale-dependent vector tilesets from large GeoJSON, FlatGeobuf, and CSV feature collections.

## Open mapping and Earth observation data

- [OpenStreetMap copyright and licence](https://www.openstreetmap.org/copyright) — This page summarizes the ODbL terms, attribution requirements, contributor sources, and trademark boundaries for OSM data.
- [Natural Earth](https://www.naturalearthdata.com/) — Natural Earth provides public-domain raster and vector datasets designed for small-scale maps at three coordinated levels of detail.
- [Copernicus Data Space APIs](https://documentation.dataspace.copernicus.eu/APIs.html) — The portal documents catalog, STAC, OData, S3, processing, and download interfaces for European Earth observation products.
- [NASA Earthdata Search](https://search.earthdata.nasa.gov/search) — Earthdata Search provides spatial, temporal, instrument, platform, processing-level, and format discovery across NASA Earth science holdings.
