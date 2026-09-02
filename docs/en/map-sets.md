---
id: map-sets
title: Map Sets
language: en
---

# Map Sets

A Map Set connects an XYZ raster source to *maptoy*'s renderer, initial viewport,
technical capabilities, cache policy, and download limits. No public provider is
configured automatically. Before adding a source, review its current terms,
attribution rules, request limits, and permissions for proxying or storage. See the
[tile-provider overview](docs/en/tile-providers) for technical orientation.

## Create a Map Set

Open **Map Sets**, choose **New Map Set**, and complete these essential fields:

- **Name** is the local display name.
- **XYZ URL template** must be an HTTP or HTTPS URL containing `{z}`, `{x}`, and
  `{y}`. `{s}` is optional and requires at least one configured subdomain.
- **Attribution** is shown by the interactive renderer. Plain text and trusted
  Leaflet-compatible link markup such as `<a href="https://…">…</a>` are accepted.
  The markup is stored and rendered unchanged, so only administrators should edit
  Map Set configuration.
- **Provider terms URL**, **Terms last reviewed**, and **Notes** record what you
  checked; they do not constitute legal approval by *maptoy*.
- **Minimum**, **maximum**, and **default zoom** must describe the source's actual
  range. The default zoom must fall inside that range.
- **Default longitude and latitude** determine the first viewport.
- **Tile size** and **format** must match the provider response.

Zoom values describe the provider's `{z}` coordinate. A 512-pixel Tile at provider
zoom `z` is displayed at Leaflet zoom `z + 1`, as it contains the detail of a
256-pixel Tile from that level. *maptoy* applies this offset automatically; API and
cache coordinates continue to use the provider zoom.

The initial implementation supports the `xyz-raster` source type in Web Mercator
(`EPSG:3857`) and the `leaflet-xyz` renderer only.

The Map view remembers one shared centre and zoom in the browser's local storage.
Reloading the page restores that viewport, and switching Map Sets keeps the same
area visible so sources can be compared directly. If the new Map Set has a narrower
zoom range, *maptoy* clamps the shared zoom to its nearest limit. The configured
default viewport is used when no valid stored value exists.

## Source settings after caching

Once a Map Set contains its first cached Tile Revision, *maptoy* locks the fields that
define the source: source type, URL template, request headers, subdomains, tile size,
format, and source projection. Metadata, viewport, zoom limits, capabilities, and
cache or download policies remain editable.

To change a locked source field, duplicate the Map Set and edit the copy. This keeps
every cached coordinate tied to one understandable source without maintaining a
separate source-version history. Changing the value of an environment variable, such
as rotating an API key referenced by a header, does not change the stored Map Set and
does not invalidate its cached Tiles.

The editor shows locked source controls as disabled and offers **Duplicate to change
source**. The server enforces the same rule for API clients.

## Secrets and request headers

Never paste an API key directly into a Map Set. Put it in the server environment
and reference its name in the URL or a header:

```text
https://tiles.example.test/{z}/{x}/{y}.png?key=${MAPTOY_EXAMPLE_API_KEY}
Authorization: Bearer ${MAPTOY_EXAMPLE_API_KEY}
```

Only `MAPTOY_*` names are accepted. The referenced variable must exist when the Map
Set is saved. SQLite stores the reference, not the resolved value; API responses,
diagnostics, and the web interface therefore never need the secret itself.

Request headers use one `Name: value` line each. Hop-by-hop headers, `Host`,
`Cookie`, and `Content-Length` cannot be configured. If a provider redirects to a
different origin, *maptoy* removes configured headers before following it.

## Provider test

Save the Map Set and choose **Test tile**. *maptoy* requests the tile containing the
configured default centre at the default zoom and reports:

- XYZ coordinate and provider HTTP status;
- normalized content type;
- response byte size and duration;
- a clear error for DNS, timeout, network, size, status, or unsupported image type.

The test accepts PNG, JPEG, and WebP raster responses. It does not grant permission
to use the provider and does not enable capabilities automatically.

## Network protection

Provider requests allow HTTPS by default. Localhost, private, and link-local
addresses are rejected both when configured as literal IP addresses and after DNS
resolution. Redirect destinations are checked again. A self-hosted private tile
server requires the explicit server setting
`MAPTOY_TILES_ALLOW_PRIVATE_HOSTS=true`; this also permits HTTP and should be enabled
only in a trusted network.

Provider responses have a configurable timeout and byte limit. The defaults are
10 seconds and 10 MiB per tile. Configure them with
`MAPTOY_TILES_PROVIDER_TIMEOUT_MS` and `MAPTOY_TILES_MAX_BYTES`.

## Capabilities and current scope

Capability switches describe technical behavior, not provider permission. *maptoy*
combines them with the selected renderer's capabilities. A disabled interactive
capability prevents the Map Set from opening in the Map view.

During Phase 2, the Map view loads every tile through the relative *maptoy* endpoint
`api/map-sets/:id/tiles/:z/:x/:y`; the browser never receives the external provider
URL or resolved secrets. Persistent Tile Revisions, refresh modes, snapshots, and
cache-state comparisons are described in the [Tile Cache](docs/en/tile-cache)
documentation. A capable Map Set provides **Download tiles**, which opens the
cache-aware Batch Download workflow in Coverage.
