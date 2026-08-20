# ADR 0001: Frontend map-renderer adapter boundary

Status: accepted  
Date: 2026-08-21

## Context

Leaflet is the v1 renderer, but business-facing Vue components must not depend on
Leaflet classes or events. A later renderer may have different capabilities and may
not support maptoy tile caching, batch download, layers, or server export.

## Decision

The web application uses a build-time registry of `MapRendererAdapter` factories.
Each adapter publishes a stable ID, implementation version, compatible SDK version,
configuration schema, and capability flags.

The first contract exposes only:

- create and destroy a renderer instance in a supplied host element;
- read and set an adapter-neutral WGS84 viewport and numeric zoom;
- subscribe to normalized viewport, pointer, and selection events;
- attach, update, reorder, show, hide, and remove a base-map or plugin-layer handle;
- convert between WGS84 coordinates and screen pixels;
- report effective capabilities.

The contract does not expose Leaflet maps, layers, bounds, events, or DOM nodes to
business components. Adapter-owned DOM stays inside its supplied host element.
Business components operate on maptoy DTOs and capability checks.

The `leaflet-xyz` adapter and a minimal fake adapter must pass the same contract test
suite. Import-boundary checks prevent Leaflet imports outside the adapter package and
its focused integration tests.

## Consequences

The v1 interface stays deliberately smaller than Leaflet. New operations are added
only when at least one business use case cannot be expressed through the existing
contract. Renderer-specific options remain inside validated adapter configuration.
Unsupported capabilities produce explicit UI states instead of emulation by core
components.
