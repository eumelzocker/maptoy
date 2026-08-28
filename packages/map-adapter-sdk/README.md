# Map Adapter SDK

This package isolates maptoy's views and plugins from a concrete browser map engine.
A `MapRendererFactory` publishes a versioned manifest and creates a renderer that
owns viewport, events, Layer lifecycle, ordering, attribution, and coordinate
conversion.

Adapter-neutral Layer data includes point, line, and area collections with separate
symbolizers, a raster-overlay descriptor for geographically bounded images, and a
composite of primitive descriptors. Raster overlays are intentionally not modeled as
vector areas.

Use `createMapRendererFactoryRegistry` for registration and
`exerciseMapRendererContract` in adapter tests. The contract exercises attachment,
update, ordering, and removal for point, line, area, raster-overlay, and composite
descriptors. `createFakeMapRendererFactory` is available to test higher-level code
without importing a rendering library. The shipped Leaflet/XYZ adapter is the v1
reference implementation.
