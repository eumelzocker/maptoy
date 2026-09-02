# Changelog

All notable changes to maptoy are documented in this file.

## [Unreleased]

## [0.4.0] - 2026-09-02

### Added

- Added cache-aware Batch Download estimates and persistent Tile Download Jobs
  with provider rate limits, concurrency, Retry-After handling, pause, resume,
  cancellation, restart recovery, retry, bounded errors, and configurable Tile
  admission limits.
- Integrated Batch Download configuration, responsibility confirmation, progress,
  controls, error details, draggable map-area selection, selected bounds, and active
  Tile overlays into Coverage.

## [0.3.4] - 2026-09-02

### Changed

- Consolidated the separate API and provider traffic-log directory settings into
  `MAPTOY_LOGGING_DIR`; maptoy now creates their `api` and `provider`
  subdirectories below that shared location when needed.

## [0.3.3] - 2026-09-01

### Added

- Added Photo map navigation that centers the current coordinate from an icon action
  on its preview without changing zoom and fits a complete Photo Layer through a
  compact, antimeridian-aware extent API.
- Added configurable, zoom-responsive Photo marker clustering with count pins,
  plus a scrollable click popup with up to 100 lazily loaded previews and configured
  Photo details.

### Changed

- Keep detailed Photo scan results scoped to the current Layers dialog session and
  show the persisted relative source folder with its loaded Photo count on reopen.
- Restore the last browser-local Layer selection whenever the Layers tool opens
  without an explicit target, falling back to the first visible Layer.
- Show all captured Photo metadata in the position editor independently of the map
  popup field configuration.
- Place individual and clustered Photo popups above or below their marker according
  to available map space, correcting edge overflow without automatic map movement.

## [0.3.2] - 2026-09-01

### Added

- Added stable three-state column sorting to the Cache Map Sets and Zoom Overview
  tables, cycling through original, descending, and ascending order with accessible
  state indicators and unchanged bounded Revision Explorer ordering.
- Added a safe Photo subdirectory-browsing API and picker that exposes only relative
  folders below `MAPTOY_PHOTOS_DIR`, blocks root selection in the UI, skips symbolic
  links, and restores each Photo Layer's latest scan folder and recursion setting.
- Added extensible Photo marker preview details with code-configured field
  visibility, initially showing only filename, DMS point coordinate, and available
  capture time below the image while retaining further metadata for later UI
  configuration.
- Added capture of optional Photo manufacturer, camera model, ISO, f-stop, shutter
  speed, and `IPTC.caption` in persisted scan metadata, exposed through the typed
  Asset contract.

### Changed

- Show Layer category icons for Tracks, Photos, and Decorations in the hierarchy
  picker, and replace the category name with its icon in the collapsed selection.
- Show the active stale-age limit below the Coverage legend using the Cache table's
  compact duration format, and render Coverage percentages at normal weight.
- Open the Photo position dialog at a more useful content-sized width and allow it
  to be resized in both directions within the viewport.
- Admit newly scanned Photos to the catalog only when they have a complete, valid
  EXIF GPS point, avoid creating previews or database records for unlocated Photos,
  and show their separate skipped count in the scan result.
- Open Photo preview popups on marker hover without auto-panning the Map, replacing
  the filename-only tooltip while retaining click behavior for touch interaction.

### Removed

- Removed geographic bounds and raster-overlay handling from Photo Layers across
  the editor, API, persistence, rendering contracts, documentation, and plan. Photo
  positions now use point coordinates exclusively; schema migration 11 discards
  previously stored Photo bounds.

### Fixed

- Recalculate Leaflet Photo popup dimensions after an asynchronously loaded preview
  so its frame fits correctly on the first marker click.

## [0.3.1] - 2026-08-31

### Added

- Added bounded per-Job diagnostic history and configurable terminal-Job retention
  with automatic and manual cleanup that protects queued, running, and paused Jobs.

### Changed

- Load Photo Asset pages on demand in the browser, with explicit cursor-based
  catalog continuation and full map loading limited to visible Photo Layers.
- Document reproducible Photo scan measurements and tighten configurable ceilings
  for file bytes, decoded pixels, previews, batches, decoder concurrency, and files.

### Fixed

- Checkpointed Photo scan progress so pause, resume, cancellation, and restart
  recovery never count already processed files twice.

## [0.3.0] - 2026-08-31

### Changed

- Standardized runtime configuration as `MAPTOY_<DOMAIN>_<PROPERTY>` across the
  `SERVER`, `STORAGE`, `LOGGING`, `TILES`, `LAYERS`, and `PHOTOS` domains without
  compatibility aliases. Photo configuration consistently uses `PHOTOS`.
- Renamed the external-photo feature across plugin IDs, API routes, contracts,
  persistent Asset and Job types, server services, and Vue components. Schema
  migration 9 converts existing catalog records once; no legacy runtime names or
  API aliases remain. Photo setup now needs only `MAPTOY_PHOTOS_DIR`; the standard
  Compose file mounts it read-only automatically, while the scan API and UI no
  longer expose or require configurable root IDs. Generic raster decoding and
  preview storage retain the technical `Image` terminology.
- Replaced the Map view's Layers and Display Options popovers with draggable,
  non-modal dialogs and made focused dialogs move to the top. Escape now closes
  only the topmost dialog. Both tools are available at the bottom of the context
  menu's Tools submenu, while Goto precedes Map Set at the top level.
- Hid the Layer editor's move-up and move-down controls while retaining Layer
  reordering below the UI for later use.
- Let the Layers dialog grow within the viewport while keeping overflow and
  scrollbars inside its Layer editor or expanded hierarchy instead of the dialog
  itself, and size its width to its content.
- Extended Goto Coordinates with a Map Set-bounded whole-level Zoom selector. Zoom
  and coordinate values now apply together on confirmation, with centered DMS
  readouts below the coordinate fields.
- Sized the Tile Calculator dialog and preview to the active Map Set's native Tile
  dimensions, removing excess space around 256 px Tiles and only scaling larger
  Tiles down when the browser viewport cannot show them at 1:1.

## [0.2.3] - 2026-08-30

### Added

- Added an off-by-default **Show Tile Grid** option to the Map display popup and
  context menu. It reuses or creates the editable `Default Grid` Decorations layer
  and keeps its browser-local toggle in sync with Layer visibility and deletion.
- Added an asset-free, editable Tile Grid Decorations layer that outlines and labels
  the active base map's visible source Tiles as `z/x/y`. It renders a centered,
  latitude-aware metric scale in every Tile with configurable percentage width,
  collision-safe labels, marker ticks, alternating subdivisions, and independently
  transparent line, text, and background colors.
- Added explicit renderer descriptor compatibility and registry-resolved,
  schema-based Layer editors so decorative and future plugin types reuse the common
  Layer lifecycle without plugin-specific branches in the editor shell.
- Added an English Mapping Resources documentation page with curated references
  for geospatial standards, APIs, formats, tools, and open data catalogs.

### Changed

- Placed every Layer's visibility and opacity controls on one row.
- Vertically centered the Map view's Layer and Display Options.
- Kept the Map viewport at least 400 by 400 pixels when the browser window is
  resized, using application scrolling below that size.
- Made browser titles identify the active route and relevant context, including
  selected Map Set names for Map and Coverage, the Map view's current
  quarter-step zoom level, documentation-page titles, and Cache Map Set IDs.

### Fixed

- Kept the Map context menu above controls, popups, and dialogs.
- Displayed Map Set save and form-validation errors directly above the editor's
  action row instead of at the start of the page or form.
- Kept the active Map Set unchanged when another Map Set is created or
  duplicated.

## [0.2.2] - 2026-08-29

### Added

- Clicking the Map view's coordinate overlay opens a popup to choose the DD,
  DMS, or DMM coordinate notation; the choice is remembered in browser-local
  preferences.
- The Tile Calculator now loads every valid Tile preview automatically through
  normal cached Tile retrieval instead of requiring a separate Load Tile action,
  respects the Map view's Cached Tiles only option, and uses a centered,
  column-aligned cache-miss placeholder.
- Server startup now creates the credential-free OpenTopoMap default, including
  its attribution and provider information, whenever the Map Set table is empty.

### Changed

- Root-level Map Sets are sorted below named folders in selectors, the Map
  context menu, and the Map Sets view. Only collections with more than eight
  root-level Map Sets are grouped in a virtual `Other Maps` folder.

## [0.2.1] - 2026-08-29

### Added

- Added a Screenshots documentation page using the existing local application
  images.
- Reusable searchable Tree Select and Checkbox Tree Vue components with retained
  hierarchy state, tri-state group visibility, and independent Layer selection
  and visibility actions.
- Layer Plugin SDK 1.1 support for deterministic whole-Layer schema migrations
  covering configuration, data, and opacity, plus SQLite schema version 8 backups
  of pre-migration opacity values.

### Changed

- Grouped the Documentation table of contents into collapsible application and
  general map sections, simplified its links, and replaced untranslated-page
  glyphs with compact UK fallback flags and localized fallback notices.
- Highlighted the active title-bar view independently from hover and replaced the
  horizontal route links with an accessible view dropdown on narrow viewports.
- Reworked the Map view's Layer tool around a hierarchy dropdown above exactly one
  selected Layer editor. Layer-name clicks select the editor, while Layer, folder,
  and category checkboxes keep the dropdown open for rapid visibility changes.
- Split shared, Track, and Image editor responsibilities into focused Vue
  components and retained the selected Layer in browser-local preferences.
- Highlighted **Import track…** while a Track Layer is empty and changed the action
  to **Replace track…** after import to clarify that a later GPX or GeoJSON file
  replaces the normalized Track geometry.
- Consolidated Track transparency into the general Layer opacity control. Existing
  Track Layers migrate their former Layer and line-opacity factors into one value,
  while new Track Layers retain the previous effective default of `0.9`.

### Fixed

- Applied general Layer opacity consistently to Track and Image plugin server
  rendering instead of relying on the removed Track-only line-opacity setting.

## [0.2.0] - 2026-08-28

### Added

- Phase 5 Layer Plugin SDK with reusable Point, Line, and Area geometry,
  adapter-neutral display descriptors, manifest validation, schema migration
  hooks, and build-time plugin registration.
- Track and Image reference plugins with GPX/GeoJSON import, timestamp-capable
  Track vertices, GPS image points, geographic raster overlays, and shared
  interactive renderer integration.
- Persistent Layer, Asset, and Job APIs, managed non-image uploads, configured
  read-only image roots, incremental directory scans, EXIF metadata extraction,
  SQLite catalog metadata, and derived WebP previews without copying image
  originals into the application data directory.
- Optional Layer tooling inside the standard Map view, including visibility,
  opacity, Zoom limits, ordering, Track import, image scanning, image-position
  editing, and persisted scan controls. Layer instances form a global Overlay stack
  that retains visibility, order, and configuration across Map Set changes.
- Hierarchical Layer presentation with plugin-defined top-level categories and
  optional `/`-separated Layer name paths. Every category and generated folder
  level can be collapsed independently, Layer configurations default to collapsed,
  and both UI preferences persist in browser-local storage.
- Icon-based Layer category selection, optional automatically numbered Layer names,
  and an Add workflow that immediately expands the new editor and focuses its
  primary import control.
- Layer Plugin and Map Adapter SDK documentation plus Bruno requests for Layer,
  image-root, Asset, scan-Job, and Job APIs.

### Changed

- Reserved the coordinate readout height before the first pointer movement so the
  bottom-left Map tools no longer shift when coordinates first appear.

## [0.1.2] - 2026-08-27

### Added

- Reusable renderer-neutral Map Zoom control shared by the standard Map and
  Coverage views, with an exact quarter-step indicator, normal one-level
  buttons, Ctrl-click quarter steps, and Shift-click integer stepping.
- Clickable Zoom indicator with a Map-Set-bounded whole-level slider that keeps
  changes local while dragging, applies only on release, and supports internally
  configurable automatic popup closing.

### Changed

- Moved the standard Map view's Zoom value out of the coordinates overlay and
  into the shared Zoom control.
- Coverage refreshes automatically when the selected Cache state changes.
- Made Coverage's Cache-state controls collapsible, scroll selected grid-cell
  details into view, and show the Zoom-derived source-Tile capacity in a compact
  Aggregation-Grid tooltip.
- Clarified that the Coverage result header shows the current map Zoom, while
  the separately reported aggregation Zoom defines the visible grid.
- Renamed the Coverage status `available` to `fresh` across the UI and API so
  stale but present Tiles are not described as unavailable.
- Added a persistent Coverage **Show grid** toggle; disabling the grid keeps the
  status colors visible and makes only colored cells selectable.
- Added a persistent **Dimmed** toggle.
- Increased the contrast of coverage colors.
- Switched the Coverage background map from `cache-only` to normal `auto` Tile
  loading while keeping Coverage metadata queries read-only.
- Planned active-download visualization now uses separate Coverage map chip
  overlays instead of overloading Coverage cell statuses and colors.
- Marked app-specific pages in the integrated Documentation table of contents
  with the maptoy icon.

### Removed

- Removed the Coverage view's state-comparison controls, comparison styling,
  and manual **Apply to visible area** action.
- Removed the unused future `inProgress` Coverage response count, purple cell
  coloring, and corresponding legend scale ahead of the later chip-overlay
  implementation.

## [0.1.1] - 2026-08-27

### Added

- Phase 4 Cache Coverage API and map view with bounded SQLite aggregation,
  current, Snapshot, and point-in-time selection, freshness classes, state
  comparison, recursive drill-down to individual Tiles, and a future-compatible
  `inProgress` status.
- Neutral rectangle-grid renderer data and Leaflet rendering for interactive,
  adapter-independent Coverage overlays.
- Dedicated Coverage navigation, independent source and preview Zoom controls,
  browser-local view settings, five-step status scales, Map Set metadata, and
  direct Cache and editor links.
- Optional fractional Zoom indicator for Coverage and Shift-click integer Zoom
  stepping in both Coverage and the standard Map view.

### Changed

- Added direct Map Set editor links to every Cache overview row and Cache detail
  page.
- Displayed exact quarter-Zoom values in the standard Map view status overlay.

### Fixed

- Serialized Coverage renderer initialization across reloads and rapid Map Set
  changes to prevent duplicate Leaflet container initialization.
- Kept source and preview Zoom independent while constraining the preview below
  the source Zoom and respecting Map Set minimum Zoom and 512-pixel Tile offsets.

## [0.1.0] - 2026-08-26

### Added

- Independently versioned `maptoy-ff-ext` 1.0.0 workspace with configurable,
  generic response forwarding, bounded buffering, source-status filtering,
  retry-safe session deduplication, dedicated build/test/lint commands, and
  preserved local Map Set configurations. The Firefox extension is excluded
  from the maptoy Docker build and runtime image.

### Changed

- Simplified Tile-size metadata in the Map Set overview, Map information panel,
  and Tile Cache detail header by removing the redundant `px` suffix.
- Removed the completed standalone rendering-spike implementation and its separate
  toolchain after retaining the accepted decisions and benchmark results in the
  internal ADRs and repository history. Future export measurements will use the
  production pipeline.

### Fixed

- Made the Firefox extension wait for stored rules before processing the request
  that wakes its Manifest V3 background context, persist successful session
  deduplication across background suspension, and honor an explicit global `null`
  response-size limit.

## [0.0.8] - 2026-08-25

### Added

- Browser-local **Cached Tiles Only** display option. The mode renders uncached
  areas as dynamically generated, seamless `no_cache` Tiles, labelled with
  their `z`, `x`, and `y` coordinates.
- Bounded in-memory LRU caching for generated error Tiles in both supported Tile
  sizes, with non-cacheable HTTP responses so newly archived content can replace
  placeholders immediately.
- Map View context menu with hierarchical Map Set selection, available source
  zoom levels, application and Documentation-page navigation, map tools, and
  checked display preferences. It supports pointer and keyboard opening,
  viewport-aware placement, outside-click and Escape dismissal, and contained
  wheel scrolling for long submenus.
- Browser-local **Show map selector** preference in both the Display Options
  popup and Map context menu, plus the full selected Map Set name in the browser
  title with automatic reset outside the Map view.
- Reusable `AppContextMenu` overlay component that owns Teleport, positioning,
  focus, dismissal, scrolling, and global-listener cleanup while the existing
  menu component remains responsible for menu-tree interaction.
- Reusable, accessible centered Vue dialog with modal and non-modal modes,
  viewport-bounded title-bar dragging, and no background dimming or blur. Modal
  dialogs retain focus containment and backdrop dismissal; the Map view's new
  **Goto Coordinates** and **Tile Calculator** tools use the non-modal mode with
  frozen opening values while the map remains operable.
- WGS84 map centering and a live XYZ Tile calculator prefilled from the current
  viewport, including on-demand Tile preview through the selected Map Set.
- Structured in-app Bruno documentation for the API collection and every
  included request, covering inputs, headers, responses, and relevant errors.
- Per-zoom Tile Cache coverage statistics across the complete XYZ world, including
  empty supported zoom levels, the number of supporting Map Sets, exact possible
  Tile counts, and adaptive percentage formatting that keeps tiny high-zoom
  values visible in scientific notation.
- Automatic detection of cached Tiles outside a Map Set's current zoom range on
  its Tile Cache detail page, with confirmed bulk cleanup of all unprotected
  revisions and files, pruning of empty Tile directories, and explicit
  preservation of snapshot-referenced Tiles.

### Changed

- The Map Set editor's unsaved-changes guard now also covers navigation to every
  other application view as well as browser reload, tab closing, and leaving the
  page.
- Requests to the `api/health` liveness endpoint are excluded from detailed API
  traffic logs regardless of their origin, while Docker health evaluation remains
  unchanged.
- The shared menu now provides accessible checkbox entries, chooses each
  submenu direction from its actual available space, delays pointer-leave
  closing by 150 ms, and keeps long leaf menus usable with bounded scrolling.
- The Map View's upper-right control is reduced to the optional Map Set selector
  and information action.
- Uploaded and provider-fetched Tiles are now fully decoded before archival and
  rejected when their actual PNG/JPEG/WebP format or pixel dimensions do not
  match the Map Set.

### Fixed

- Nested-menu keyboard navigation now moves focus into the direct child menu
  and returns exactly one level at a time instead of refocusing the parent or
  collapsing the complete menu tree.

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
