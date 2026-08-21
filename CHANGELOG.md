# Changelog

All notable changes to maptoy are documented in this file.

## [Unreleased]

## [0.0.1] - 2026-08-21

### Added

- pnpm and TypeScript monorepo foundation with Nix, direnv, Biome, Vitest, and a
  shared quality-check command.
- Vue application shell and Fastify API served on one port, including
  route-relative SPA deep links for reverse-proxy prefixes.
- Environment validation, structured logging, and health and readiness endpoints
  with initial Bruno requests.
- Build-time renderer and layer-plugin registries, shared contract-test harnesses,
  and initial Leaflet XYZ, track-layer, and image-layer manifests.
- Integrated Markdown documentation with English, German, and Thai routes,
  visible English fallbacks, localized glossaries and abbreviation lists, and a
  documented selection of tile providers. The repository changelog is included
  directly as an English documentation page.
- Multi-stage, non-root Docker image and Compose setup with a health check and
  persistent data volume.
- Architecture decisions and a reproducible rendering spike covering tile
  composition, plugin layers, and raster reprojection.
