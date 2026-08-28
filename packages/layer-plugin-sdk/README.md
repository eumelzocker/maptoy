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

The reference packages `plugins/track-layer` and `plugins/image-layer` demonstrate
line and point/raster-overlay specializations. Executable plugin upload or runtime
installation is outside the v1 trust model.
