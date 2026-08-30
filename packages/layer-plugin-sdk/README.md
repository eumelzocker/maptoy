# Layer Plugin SDK

This package is maptoy's versioned contract for trusted, build-time registered Layer
plugins. A definition combines a manifest with shared validation and migrations plus
optional frontend, managed-Asset import, preview, and server-rendering hooks. Plugins
receive only the narrow contexts declared in `src/index.ts`; they do not receive
Fastify, Pinia, database, arbitrary filesystem, or secret access.

The common domain model provides `PointFeature`, `LineFeature`, and `AreaFeature`.
Line vertices accept generic typed properties, allowing a Track specialization to
retain timestamps or accuracy while elevation remains part of its coordinate. Area
rings must be closed. Symbolization is deliberately absent from these geometry
types.

Use `assertPointGeometry`, `assertLineGeometry`, and `assertAreaGeometry` at runtime.
Use `createLayerPluginRegistry` to validate and register definitions, and run
`exerciseLayerPluginContract` in every plugin's tests. A manifest declares a stable
category ID and display name for the first level of the Layer hierarchy and must use
an exact `LAYER_PLUGIN_SDK_VERSION` match. Persisted schema migrations advance by one
version, are ordered, and must be deterministic.

Interactive manifests declare the renderer descriptor types they require. In
addition to stored geometry and raster overlays, a plugin may publish a state-derived
`xyz-tile-grid` descriptor. It persists only configuration for boundaries, labels,
and the percentage width of the per-Tile metric scale; the active renderer derives
the visible content from its viewport, projection, and Tile matrix.

SDK 1.1 adds the general Layer opacity to the server-render context. SDK 1.2 adds
renderer descriptor requirements and state-derived decorations. A schema step
that must preserve appearance while changing configuration can use `migrateLayer`
to migrate configuration, data, and opacity atomically; data-only migrations keep
using `migrate`.

The reference packages `plugins/track-layer`, `plugins/image-layer`, and
`plugins/tile-grid-layer` demonstrate line, point/raster-overlay, and asset-free
state-derived specializations. Executable plugin upload or runtime installation is
outside the v1 trust model.
