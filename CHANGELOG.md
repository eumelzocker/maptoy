# Changelog

All notable changes to maptoy are documented in this file.

## [Unreleased]

## [0.0.2] - 2026-08-21

### Added

- Host-controlled bind-mount persistence through `MAPTOY_DATA_DIR`, without a
  Docker-managed named or anonymous data volume.
- Persistent SQLite-backed XYZ Map Sets with shared validation, CRUD and provider
  test APIs, server-only secret resolution, redirect-aware SSRF protection, and a
  bounded relative tile proxy.
- Map Set management interface with create, edit, duplicate, test, and confirmed
  delete workflows.
- Interactive Map view backed by the Leaflet/XYZ renderer contract, capability
  states, relative tile requests, attribution, viewport selection, and pointer
  coordinates.
- English and German Map Set documentation covering configuration, provider
  responsibility, secret references, security controls, and current Phase 2 scope.
- English and German map-projection documentation plus visible current-page and
  requested-language indicators in the documentation navigation.

### Changed

- Compose helper scripts now use the unambiguous `d:up`, `d:down`, `d:logs`, and
  `d:rebuild` names.

### Fixed

- Tile-provider requests now pass Node.js 24's multi-address DNS callback contract
  while retaining address pinning and SSRF protection.

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
