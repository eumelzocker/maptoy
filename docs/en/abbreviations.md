---
id: abbreviations
title: Abbreviations
language: en
---

# Abbreviations

This directory lists abbreviations used by *maptoy* and its documentation. Product
and format names that are not abbreviations are explained in the
[glossary](docs/en/glossary).

| Abbreviation | Expanded form | Meaning in *maptoy* |
| --- | --- | --- |
| ADR | Architecture Decision Record | A versioned record of an important architectural decision and its rationale. |
| API | Application Programming Interface | The HTTP interface used by the web application and other clients. |
| CSP | Content Security Policy | Browser policy that restricts which resources and origins the application may use. |
| CRS | Coordinate Reference System | A coordinate system together with the information needed to locate coordinates on Earth. |
| DD | Decimal Degrees | A coordinate notation expressing latitude and longitude as signed decimal numbers, e.g. `53.548333°, 9.978889°`. |
| DMM | Degrees and Decimal Minutes | A coordinate notation expressing latitude and longitude as whole degrees plus decimal minutes, e.g. `53° 32.900'N 9°58.733'E`. |
| DMS | Degrees, Minutes, and Seconds | A coordinate notation expressing latitude and longitude as whole degrees, minutes, and seconds, e.g. `53° 32'54.0"N 9°58'44.0"E`. |
| DPI | Dots per inch | Output-resolution metadata for an exported raster image; it does not add map detail by itself. |
| EPSG | European Petroleum Survey Group | The name behind the commonly used numeric identifiers for coordinate reference systems, such as `EPSG:3857`. |
| EXIF | Exchangeable image file format | Metadata in image files that can include orientation, capture time, and GPS coordinates. |
| GDAL | Geospatial Data Abstraction Library | The command-line tooling used by *maptoy* for raster reprojection. |
| GPS | Global Positioning System | A satellite positioning system; *maptoy* can use GPS coordinates stored with images or tracks. |
| GPX | GPS Exchange Format | An XML format for exchanging tracks, routes, and waypoints. |
| HTTP | Hypertext Transfer Protocol | The protocol used for the *maptoy* API and, where allowed, provider requests. |
| HTTPS | Hypertext Transfer Protocol Secure | HTTP protected by transport encryption; the default protocol for external providers. |
| JPEG | Joint Photographic Experts Group | A lossy raster-image format supported for map exports. |
| JSON | JavaScript Object Notation | The structured data format used by the API, configuration schemas, and GeoJSON. |
| OGC | Open Geospatial Consortium | A standards organization responsible for geospatial standards including WMTS. |
| PNG | Portable Network Graphics | A lossless raster-image format supported for tiles and map exports. |
| SDK | Software Development Kit | The versioned contracts used to build renderer adapters and layer plugins. |
| SPA | Single-Page Application | The browser application that provides *maptoy*'s user interface and client-side navigation. |
| SQL | Structured Query Language | The language used to query the SQLite metadata database. |
| SSRF | Server-Side Request Forgery | A class of attack in which a server is induced to request an unintended network resource. |
| UI | User Interface | The browser-based controls and views presented to the user. |
| URL | Uniform Resource Locator | An address for an application route, tile source, or external reference. |
| WGS 84 | World Geodetic System 1984 | The geodetic reference system used for longitude and latitude input, identified as `EPSG:4326`. |
| WMTS | Web Map Tile Service | An OGC standard for serving map tiles; special WMTS cases are outside *maptoy* v1.0. |
| XYZ | Not an initialism; `x`, `y`, and `z` are tile coordinates | The tile scheme used by *maptoy* v1.0, where `z` is the zoom level and `x` and `y` identify a tile. |
