# Map Adapter SDK

This package isolates maptoy's views and plugins from a concrete browser map engine.
A `MapRendererFactory` publishes a versioned manifest and creates a renderer that
owns viewport, events, Layer lifecycle, ordering, attribution, and coordinate
conversion.

Adapter-neutral Layer data includes point, line, and area collections with separate
symbolizers, a state-derived `xyz-tile-grid` decoration, and a composite of primitive
descriptors.
The Tile Grid descriptor combines boundaries, `z/x/y` labels, and a fixed-width
segmented metric scale across the visual center of every Tile. Renderer manifests
list their supported descriptor types so plugins can be disabled with a useful
diagnostic instead of failing during attachment.

Use `createMapRendererFactoryRegistry` for registration and
`exerciseMapRendererContract` in adapter tests. The contract exercises attachment,
update, ordering, and removal for stored and state-derived descriptors.
`createFakeMapRendererFactory` is available to test higher-level code without
importing a rendering library. The shipped Leaflet/XYZ adapter is the v1 reference
implementation.

SDK 2.0 removes the raster-overlay descriptor; Photo Layers use point coordinates
exclusively. SDK 2.1 adds optional geographic bounds fitting and renderer-managed
point clustering.
