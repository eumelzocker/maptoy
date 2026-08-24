# Changelog

All notable changes to maptoy are documented in this file.

## [Unreleased]

## [0.0.7] - 2026-08-24

### Added

- Raw PNG, JPEG, and WebP Tile seeding through
  `POST api/map-sets/:id/tiles/:z/:x/:y`, with shared archive validation,
  deduplication, storage limits, and deterministic coordination with provider
  requests.
- Persisted `provider` or `upload` origin for every Tile Revision, including the
  lossless schema version 5 migration of existing production-baseline data.
- Integrated English API reference and a clearly marked Bruno write request for
  manual Tile seeding.

### Changed

- Tile cache and provider documentation now covers external seeding, its
  unauthenticated trusted-network boundary, and OpenTopoMap as the manual
  development example without requiring a standalone local Tile server.
- The project plan now records the actual `0.0.x` release sequence, completed and
  remaining phase scope, and the reduced set of unresolved v1 decisions.

## [0.0.6] - 2026-08-24

### Added

- Separate detailed JSON Lines traffic logs for client/API and
  backend/tile-provider exchanges, including credential redaction, independent
  host bind mounts, and configurable size rotation with bounded retention.

### Changed

- The current SQLite schema is now a single version 4 baseline `.sql` package
  asset instead of a chain of pre-release migrations embedded in TypeScript. No
  production database predates this baseline; future numbered migrations build on
  version 4 and preserve its data.
- Readiness now verifies the independently configured API and provider traffic-log
  directories in addition to the application data directory and database.
- The README now focuses on user setup and startup, with implementation and
  architectural details kept in the project plan and ADRs.

## [0.0.5] - 2026-08-24

### Added

- Documentation images: `docs/assets/` files are now served under
  `/docs-assets/` in both development and production, with relative
  `<img src>` references in documentation pages rewritten automatically at
  build time.
- Every inline code snippet and fenced code block in the documentation now has
  a click/keyboard-activated copy-to-clipboard icon (inline: right after the
  text; blocks: top-right corner of the block). A custom
  `<callout type="clipcopy">text</callout>` Markdown tag is also available and
  renders like inline code.
- Reusable accessible Vue menu with optional nested submenus, pointer and
  keyboard navigation, viewport-aware popup positioning, and a responsive
  inline submenu layout on narrow screens. It now powers the Map Set selectors
  in the Map and Tile Cache views and provides a base for future context menus.
- Tile Cache overview at `/cache` with efficiently aggregated statistics and
  zoom totals across all Map Sets, per-Map-Set storage summaries, and an
  explicitly triggered overall file-system consistency check. Map Set details
  remain directly addressable at `/cache/:mapSetId`.

### Changed

- Documentation improvements
- Map Set names now use their first `/`-separated segment as a presentation
  hierarchy in the Map Sets overview and selectors. Later separators remain in
  the displayed item name, while names without a separator are collected under
  `Other Map Sets`; persisted Map Set names remain unchanged.

### Fixed

- `apps/web/build/` (the documentation loader and its tests) was unintentionally
  excluded from version control by an overly broad `build/` entry in
  `.gitignore`, which also silently hid it from Biome's format checks; the
  entry is now scoped to `dist/` only.

## [0.0.4] - 2026-08-23

### Added

- Browser-local persistence for one shared map centre and zoom across reloads and
  Map Set switches, with safe fallback and zoom-range clamping.
- Reusable HTML-capable Vue tooltip with hover, focus, click-to-pin, and keyboard
  support, first used for a compact Map Set information card with attribution and
  terms.
- Reset-to-initial-view action in the Map Set information card, jumping the map
  back to the Map Set's configured default centre and zoom.
- On-demand exact-revision Tile previews in the Revision Explorer without provider
  requests.
- Browser-local persistence for the selected Documentation language, restored the
  next time the Documentation link or a bare `/docs` URL is opened.
- Unsaved-changes confirmation in the Map Set editor before closing, switching to
  another Map Set, or duplicating, with the Edit action disabled for the Map Set
  currently open in the editor.
- Cached Tile count in the Map Set list, and automatic scrolling to the editor
  panel when it opens.
- Map display options panel, toggled from a bottom-left overlay button, to
  show or hide the coordinates status bar and the on-map attribution control;
  both preferences persist across reloads and Map Set switches.
- "Show title bar" option in the Map display options panel, hiding the app
  header for more vertical space on the Map view; other views always show it
  regardless of the stored preference.

### Changed

- Interactive Map view now uses the full canvas, with the Map Set selector and
  management actions in a compact overlay and zoom plus pointer coordinates in a
  bottom status bar instead of the former sidebar.

### Fixed

- 512-pixel XYZ sources now use Leaflet's required one-level zoom offset, so their
  complete world extent is rendered while API and cache coordinates retain the
  provider's zoom levels.
- The Map Set selection store no longer risks failing at startup when the browser
  blocks or disables local storage (private browsing, storage quotas, restrictive
  policies); reads and writes now degrade gracefully instead.
- The shared stored viewport is no longer discarded after panning past a pole or
  across the antimeridian: out-of-range centre latitude and longitude are now
  clamped and wrapped instead of falling back to the Map Set's default, fixing an
  intermittent reset of position and zoom on Map Set switches and reloads.
- The Leaflet map now wraps its reported centre longitude and jumps seamlessly
  between world copies while dragging, preventing longitude drift when panning
  repeatedly across the antimeridian.

## [0.0.3] - 2026-08-22

### Added

- Revision-aware Tile Archive with immutable Tile Revisions, content-addressed
  atomic storage, concurrent miss deduplication, conditional validation, and
  `auto`, `force`, and `cache-only` refresh modes.
- Reproducible current, snapshot, time-based, and explicit-revision tile selection,
  snapshot comparison, cache statistics, protected deletion, and explicit orphan
  file repair.
- Tile Cache management view, English and German documentation, and manual Bruno
  cache requests.
- Bidirectional cache-index repair that removes unusable revision metadata
  after Tile files were deleted outside maptoy.
- Scalable Tile Cache overview with per-zoom database summaries, explicit
  file-system consistency checks, a filtered cursor-paginated Revision Explorer,
  and SQL-aggregated snapshot comparisons.
- Stable Map Set source identity: source-defining fields become immutable after the
  first cached Tile Revision; a different source uses a duplicated Map Set instead
  of separate Source Revision and activation tables.
- `d:rebuild:all` for a complete no-cache Compose rebuild with recreation and
  health waiting, while the regular `d:rebuild` keeps the faster cached workflow.

### Fixed

- Trusted HTML links in Map Set attribution are rendered by Leaflet instead of
  being displayed as escaped markup.
- Map zoom controls and Tile API requests consistently enforce each Map Set's
  configured minimum and maximum zoom.

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
