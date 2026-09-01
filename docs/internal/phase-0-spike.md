# Phase 0 technical spike

Status: completed historical specification

## Purpose

This spike validates the risky parts of the map rendering architecture before the
production monorepo is scaffolded. It must answer whether a Node.js implementation
based on `sharp` and a projection library is sufficient, or whether maptoy needs a
native GIS dependency such as GDAL.

The spike is deliberately independent of public tile services. All automated runs
use deterministic local fixtures so that results remain reproducible and do not
depend on network availability or provider terms.

## Questions to answer

1. Is the WGS84-to-XYZ tile calculation correct at tile edges and for the selected
   test area?
2. Can a 3x3 XYZ tile set be assembled without visible seams or coordinate drift?
3. Can adapter-neutral layer hooks render a track and a positioned image into the
   same scene?
4. Can the scene be exported to a second projection with acceptable positional
   accuracy and image quality?
5. What are the wall-clock time and peak memory usage at representative export
   sizes?
6. Which native runtime and build dependencies are actually required?

## Deterministic test scene

### Tile grid

- XYZ zoom: `14`
- Tile size: `256 x 256` pixels
- Columns: `x=8801..8803`
- Rows: `y=5372..5374`
- Native mosaic size: `768 x 768` pixels
- Approximate WGS84 bounds:
  - west: `13.38134765625`
  - east: `13.447265625`
  - north: `52.536273041459474`
  - south: `52.4961595310971`

Each generated tile must contain a unique background color, its `(z, x, y)` label,
a visible border, diagonal reference lines, and control markers at known pixel and
geographic coordinates. This makes ordering, clipping, seams, and orientation
errors visible in the output.

### Plugin-layer fixtures

- A synthetic GeoJSON track crosses several tile boundaries and includes control
  points whose expected output pixels can be calculated independently.
- A synthetic image contains non-sensitive EXIF GPS coordinates within the test
  area. Its orientation tag is not `1`, so EXIF orientation handling is exercised.

All fixture data is generated locally and may be committed to the repository.

### Attribution

Every output includes the text `Synthetic maptoy test data` in a fixed attribution
area. No output may imply that the local fixtures originate from a real provider.

## Projection cases

The baseline output uses the XYZ source projection, Web Mercator (`EPSG:3857`).
The required alternative output uses WGS84 (`EPSG:4326`). UTM zone 33N
(`EPSG:25833`) is the decision-driving case because it also exercises a projected,
non-axis-equivalent output grid for the selected area.

The spike must record which cases can be implemented safely with `sharp` plus
coordinate transforms and which require a dedicated raster warper.

## Prototype boundaries

The prototype may use a small standalone TypeScript workspace. It must keep these
interfaces separate even if their first implementation is minimal:

- tile coordinate and geographic-bound calculations;
- tile loading and raster composition;
- projection and output-grid calculation;
- core scene rendering, including attribution;
- layer-plugin hooks for validation and server-side rendering;
- output encoding and measurement.

Plugin hooks receive a controlled drawing context, geographic transforms, validated
configuration, and resolved fixture assets. They do not receive arbitrary filesystem,
network, database, or environment access.

Frontend renderer behavior is represented only by a small adapter contract and a
fake adapter during this server-side spike. Leaflet is not required to prove raster
composition or reprojection.

## Measurements

Measure at least these output sizes after one warm-up run:

| Case | Output size | Repetitions |
| --- | ---: | ---: |
| Native composition | 768 x 768 | 10 |
| Representative export | 4096 x 4096 | 5 |
| Stress probe | 8192 x 8192 | 1 |

For each case, record:

- elapsed wall-clock time;
- peak resident memory attributable to the process;
- encoded output size;
- output format and quality settings;
- Node.js version, platform, CPU count, and available memory;
- relevant library versions and concurrency/cache settings.

The stress probe may fail cleanly. A failure is useful if it produces enough data to
set an initial pixel or memory limit rather than terminating the process or leaving
partial output behind.

## Acceptance criteria

- One documented command generates all fixtures, outputs, and a machine-readable
  measurement report without contacting the network.
- The native mosaic has the expected dimensions, tile order, and no transparent or
  incorrectly sampled seams.
- Geographic control points, track vertices, and the GPS image are within one pixel
  of their independently calculated native positions.
- Reprojected control points and layer features are within two pixels of their
  expected positions in each supported output case.
- EXIF orientation is applied exactly once, and exported previews do not retain
  unnecessary EXIF or GPS metadata.
- Attribution is visible, legible, and inside the output bounds.
- Invalid tile content, missing tiles, unsupported projections, and excessive image
  sizes fail with typed, understandable errors.
- Temporary output is either atomically promoted to a final file or removed after a
  failed run.
- Results are sufficient to propose initial export-pixel and memory limits.
- An ADR records the `sharp`/projection-library versus GDAL decision and its evidence.

## Provider requirements

The spike and all automated tests remain independent of public providers. OpenTopoMap
is the documented source for manual development and demonstrations that need real
Tiles. Its provider record is reviewed and documented with at least:

- an official tile/API documentation URL and current terms URL;
- required attribution text and display rules;
- supported XYZ zoom range, tile size, formats, and projection;
- authentication and secret-reference requirements;
- required request headers, especially a meaningful User-Agent where applicable;
- published rate, concurrency, caching, retention, batch-download, and export rules;
- the date on which the user last reviewed those rules.

maptoy records these facts as technical guidance, not as a legal determination. No
automated test may access a public Tile service. The current manual development
profile and its review date are maintained in
[Example provider decision](./provider-example.md).

## Expected Phase 0 records

The implementation work should conclude with these short ADRs:

1. frontend map-renderer adapter boundary;
2. trusted layer-plugin lifecycle and hook boundary;
3. stable Map Set source, tile revision, snapshot, and temporal-selection model;
4. raster reprojection dependency decision.

The spike report must link its generated images and measurements from the fourth
ADR so that the dependency decision remains reproducible.

## Records

- [Example provider decision](./provider-example.md)
- [ADR 0001: Frontend map-renderer adapter boundary](./adr/0001-map-renderer-adapter-boundary.md)
- [ADR 0002: Trusted layer-plugin lifecycle](./adr/0002-trusted-layer-plugin-lifecycle.md)
- [ADR 0003: Immutable tile revisions and snapshots](./adr/0003-tile-revision-and-snapshot-model.md)
- [ADR 0004: Use GDAL for raster reprojection](./adr/0004-use-gdal-for-raster-reprojection.md)
