# ADR 0004: Use GDAL for raster reprojection

Status: accepted  
Date: 2026-08-21

## Context

The export pipeline must compose XYZ tiles, attribution, and plugin layers and then
optionally transform the resulting raster to an allowlisted target projection.
`sharp` performs composition and encoding efficiently but does not provide a general
geospatial raster warp. The spike compared a small Node raster warper using `proj4`
with the GDAL command-line tools from the same pinned Nix environment.

## Decision

Use these responsibilities in v1:

- `sharp`: decode trusted raster inputs, normalize orientation, resize, composite,
  and encode PNG/JPEG/WebP;
- `proj4`: point, bounds, control-feature, and output-grid coordinate calculations;
- GDAL command-line tools: general raster reprojection.

The server invokes a pinned GDAL executable as a bounded child process rather than
using a Node native binding. Inputs and outputs use managed temporary paths; the
process receives an explicit CRS, extent, dimensions, resampler, timeout, memory
budget, and sanitized environment. Completion is validated before the output is
atomically registered.

The initial target allowlist is `EPSG:3857`, `EPSG:4326`, and `EPSG:25833`. Adding a
projection requires a control-point test, visual fixture, and resource measurement.

Initial limits are:

- default maximum: `4096 x 4096` (`16,777,216` pixels);
- configurable hard ceiling: `8192 x 8192` (`67,108,864` pixels);
- one concurrent reprojection per container by default;
- preflight memory estimate: `160 MiB + 8 bytes per output pixel`;
- reject before execution if the configured memory budget cannot cover the estimate.

These are safe starting limits, not compatibility guarantees for every layer stack or
format. Phase 7 must repeat measurements with representative production inputs.

## Evidence

The deterministic Berlin test scene contains a 3x3 XYZ grid, attribution, a track, an
EXIF-oriented GPS image, and a bounds image. Outputs were bilinearly reprojected on
the same x86_64 NixOS machine. Peak RSS is process high-water memory.

| Target | Size | Node time | GDAL time | Node peak RSS | GDAL peak RSS | Mean channel difference |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| EPSG:4326 | 768² | 0.255 s | 0.245 s | 206 MiB | 126 MiB | 0.000 |
| EPSG:25833 | 768² | 0.253 s | 0.292 s | 209 MiB | 128 MiB | 0.169 |
| EPSG:25833 | 4096² | 7.020 s | 2.042 s | 272 MiB | 198 MiB | 0.004 |
| EPSG:25833 | 8192² | 27.590 s | 7.266 s | 600 MiB | 438 MiB | 0.001 |

The 4096² and 8192² results show that the custom single-threaded Node loop scales
poorly and consumes more memory. GDAL is about 3.4 to 3.9 times faster in those cases.
The very small pixel differences are consistent with edge and resampling details;
visual comparison showed aligned tiles and plugin layers.

The standalone implementation that produced these measurements was removed after
the Phase 0 decision was accepted. It remains available in the repository history.
The table is the retained decision record; Phase 7 must produce fresh,
machine-readable measurements and images from the production export pipeline rather
than treating the prototype as a permanent benchmark harness.

## Consequences

The production container will be larger and its Nix/Docker builds must include GDAL
and projection data. In return, maptoy avoids maintaining a custom raster warper and
gets established CRS, resampling, nodata, and output-grid behavior. The rejected
standalone Node implementation remains historical evidence in the repository
history, not maintained production code.
