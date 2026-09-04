---
id: tile-providers
title: Tile Providers
language: en
---

# Tile Providers

Last content review: **2026-09-04**.

This page is a technical orientation, not a recommendation, legal review, or
guarantee that a provider permits a particular use. Provider terms, plans, URLs,
limits, and attribution requirements can change. Check the linked official
documentation and terms before creating or rechecking a Map Set.

*maptoy* is a server-side tile proxy with persistent revision history, snapshots,
batch downloads, and exports. Those features go beyond ordinary browser caching.
A technically valid XYZ URL therefore does not mean that the provider permits
*maptoy*'s archive features. Unless an applicable agreement explicitly permits them,
disable batch downloads and do not assume that permanent storage, snapshots,
exports, or redistribution are allowed.

Catalog placeholders such as `{style}` and `{mapId}` must be replaced with a fixed
value before saving a Map Set. *maptoy* itself resolves only tile placeholders such as
`{z}`, `{x}`, `{y}`, and optional `{s}`. Keep credentials in environment variables;
the examples below use `${MAPTOY_*}` references rather than real secrets.

| Provider | Raster XYZ fit for v1 | Archive and batch policy |
| --- | --- | --- |
| [OpenStreetMap Standard](https://openstreetmap.org/) | Direct | Bulk download and prefetch are prohibited; only policy-compliant interactive use and caching. [Wiki](https://wiki.openstreetmap.org/) |
| [OpenTopoMap](https://opentopomap.org/) | Direct; *maptoy*'s manual development example | Credential-free low-volume development with attribution; avoid mass downloads and contact the project before larger use. |
| [MapTiler Cloud](https://www.maptiler.com/) | Direct | Server-side proxy/cache, export, and bulk download require a custom agreement. |
| [Mapbox](https://www.mapbox.com/) | Direct through Static Tiles API | Do not infer archival rights from HTTP cache headers; verify the current agreement for proxying, storage, export, and offline use. |
| [Stadia Maps](https://stadiamaps.com/) | Direct | Standard terms prohibit server-side proxying/caching and general bulk download. |
| [Thunderforest](https://www.thunderforest.com/maps/) | Direct | Standard terms allow limited client/device caching but prohibit caching proxies and redistribution. |
| [ArcGIS Location](https://location.arcgis.com/) | Direct with `{z}/{y}/{x}` path order | Account-, service-, and agreement-dependent; no general archival permission is implied. |
| [Google Maps](https://maps.google.com/) | Manual and limited for 2D tiles | An externally created session can be used, but *maptoy* does not create or renew sessions or retrieve viewport attribution. Google's caching restrictions limit archive features. |

## OpenStreetMap Standard

**Name:** OpenStreetMap Standard tile layer, operated by the OpenStreetMap
Foundation.

**Variants:** Standard only on this endpoint. Other OSM-derived styles are separate
services with their own operators and policies.

**URL template:**
`https://tile.openstreetmap.org/{z}/{x}/{y}.png`

**Parameters and headers:** No API key. Configure an honest, contactable
`User-Agent`; browser use must send a valid `Referer`.

**Policy notes:** Visible `© OpenStreetMap contributors` attribution is required.
Honor HTTP caching headers, or cache for at least seven days when those headers
cannot be read. Bulk download, offline prefetch, and bypassing the cache are
prohibited. The service is best-effort and can block abusive use. *maptoy*'s batch
download must not be enabled for this endpoint.

**Official information:** [Tile usage policy](https://operations.osmfoundation.org/policies/tiles/),
[attribution guidelines](https://osmfoundation.org/wiki/Licence/Attribution_Guidelines),
and [copyright and licence](https://www.openstreetmap.org/copyright).

## OpenTopoMap

**Name:** OpenTopoMap.

**Variants:** One worldwide topographic raster style with contours and hillshading;
coverage and maximum useful zoom vary.

**URL template:**
`https://tile.opentopomap.org/{z}/{x}/{y}.png`

**Parameters and headers:** No API key. Provide the required OpenTopoMap and data
attribution.

**Development use:** This is *maptoy*'s documented source for manual development,
smoke checks, screenshots, and demonstrations that need real Tiles. Configure it
explicitly; automated tests never access public Tile services. The published usage
notes make the map available under CC-BY-SA with attribution, so controlled
low-volume development fits this profile without credentials.

**Policy notes:** Availability is not guaranteed. Avoid mass downloads, broad
pre-seeding, and load tests; contact the project before larger use. Keep *maptoy* batch
download disabled unless the operator has agreed to the intended load and retention.
The development profile is not a general legal review or an unlimited-use guarantee.

**Official information:** [Service, licence, legend, and usage notes](https://opentopomap.org/about#verwendung)
and [project source](https://github.com/der-stefan/OpenTopoMap).

## MapTiler Cloud

**Name:** MapTiler Cloud Maps API.

**Variants:** Hosted rasterizations of map styles such as Streets, Basic, Bright,
Outdoor, Satellite, Hybrid, Toner, Topo, and custom map IDs. Available styles and
plan access can change in the account catalog.

**URL template:**
`https://api.maptiler.com/maps/{mapId}/256/{z}/{x}/{y}.png?key=${MAPTOY_MAPTILER_API_KEY}`

Replace `{mapId}` with a fixed map ID such as `streets-v4`. The `/256/` segment is
optional for the documented 256-pixel tile endpoint; `.jpg`, `.webp`, and `@2x`
variants depend on the selected map.

**Parameters and headers:** `mapId`, tile size, format, optional scale, and a
required `key`. Use a dedicated, protected API key and monitor its quota.

**Policy notes:** The standard Cloud terms permit only temporary single-user device
caching. Server-side proxying/caching, map-content export, and batch or excessive
bulk download require a written custom agreement. Standard MapTiler and source-data
attribution is required; free accounts can have additional logo requirements.

**Official information:** [Maps API](https://docs.maptiler.com/cloud/api/maps/),
[map catalog](https://cloud.maptiler.com/maps/),
[API-key protection](https://docs.maptiler.com/cloud/api/authentication-key/),
[Cloud terms](https://www.maptiler.com/terms/cloud/), and
[attribution guide](https://docs.maptiler.com/guides/map-design/attribution/add-attribution/).

## Mapbox

**Name:** Mapbox Static Tiles API.

**Variants:** Classic rasterizable styles are
- Streets v12 `streets-v12`
- Outdoors v12 `outdoors-v12`
- Light v11 `light-v11`
- Dark v11 `dark-v11`
- Satellite v9 `satellite-v9`
- Satellite Streets v12 `satellite-streets-v12`
- Navigation Day `navigation-day-v1`
- Navigation Night `navigation-night-v1`

plus compatible custom Studio styles. The current Mapbox Standard and
Standard Satellite styles are not supported by the Static Tiles API.

**URL template:**
`https://api.mapbox.com/styles/v1/{styleId}/tiles/512/{z}/{x}/{y}?access_token=${MAPTOY_MAPBOX_ACCESS_TOKEN}`

Replace `{styleId}` with fixed values. Use `/256/` only when the Map Set and billing
expectations are configured for 256-pixel tiles; 512-pixel tiles use a different
zoom interpretation from 256-pixel tiles. A literal `@2x` suffix is optional.

**Parameters and headers:** Account username, style ID, `256` or `512` tile size,
optional `@2x`, and an access token with the required scope. Requests are billed and
rate-limited under the active plan.

**Policy notes:** The API publishes HTTP cache lifetimes, but those values describe
freshness and do not by themselves grant rights to maintain *maptoy*'s permanent
revision archive, proxy content, export it, or prefetch it. Check the current Mapbox
agreement and product terms for the exact account and use case before enabling any
archive function. Preserve all required Mapbox and data attribution.

**Official information:** [Static Tiles API](https://docs.mapbox.com/api/maps/static-tiles/),
[classic style IDs](https://docs.mapbox.com/map-styles/guides/classic-styles/),
[token management](https://docs.mapbox.com/accounts/guides/tokens/),
[API caching](https://docs.mapbox.com/help/dive-deeper/api-caching/), and
[legal portal](https://www.mapbox.com/legal/).

## Stadia Maps

**Name:** Stadia Maps raster map tiles.

**Variants:** Alidade Smooth, Alidade Smooth Dark, Alidade Satellite, Outdoors, OSM
Bright, and Stadia-hosted Stamen styles including Toner, Terrain, and Watercolor.
Some styles provide background, line, or label-only variants.

**URL template:**
`https://tiles.stadiamaps.com/tiles/{style}/{z}/{x}/{y}.png?api_key=${MAPTOY_STADIA_API_KEY}`

Replace `{style}` with a fixed style ID such as `alidade_smooth_dark`. Some styles
support a literal `@2x` before the extension; Watercolor uses JPEG and has different
HiDPI availability.

**Parameters and headers:** Fixed style ID and either account/domain authentication
or `api_key`. A self-hosted server request normally needs an API key rather than
browser-domain authentication.

**Policy notes:** Stadia's standard terms prohibit server-side proxying and caching,
with narrow exceptions that do not cover *maptoy*'s general tile archive. General bulk
download is prohibited; limited mobile-device offline caching is separately capped
and conditioned. Required attribution varies by style and can include Stadia Maps,
Stamen Design, OpenMapTiles, OpenStreetMap, and other data providers.

**Official information:** [Style library](https://docs.stadiamaps.com/themes/),
[raster URL examples](https://docs.stadiamaps.com/guides/migrating-from-stamen-map-tiles/),
[attribution](https://docs.stadiamaps.com/attribution/),
[service limits](https://docs.stadiamaps.com/limits/), and
[terms of service](https://stadiamaps.com/terms-of-service/).

## Thunderforest

**Name:** Thunderforest Map Tiles API.

**Variants:** OpenCycleMap (`cycle`), Transport, Transport Dark, Landscape,
Outdoors, Atlas, and other styles shown in the account and map catalog.

**URL template:**
`https://api.thunderforest.com/{style}/{z}/{x}/{y}.png?apikey=${MAPTOY_THUNDERFOREST_API_KEY}`

Replace `{style}` with a fixed style ID. Optional literal `@2x` scale and PNG/JPEG
format variants are available. The single `api.thunderforest.com` host is preferred
over legacy `a`, `b`, and `c` subdomains.

**Parameters and headers:** Fixed style ID, optional scale, selected format, and the
required `apikey`. Send an honest `Referer` and/or `User-Agent`.

**Policy notes:** Registration and attribution to Thunderforest and the underlying
data sources are required. Standard terms permit browser/on-device caching, even for
offline use, but prohibit caching proxies and other redistribution. *maptoy*'s
server-side archive therefore needs separate permission. Respect the account plan,
quota, and any provider response limiting the request rate.

**Official information:** [Map Tiles API](https://www.thunderforest.com/docs/map-tiles-api/),
[API keys](https://www.thunderforest.com/docs/apikeys/),
[map catalog](https://www.thunderforest.com/maps/), and
[terms](https://www.thunderforest.com/terms/).

## ArcGIS Location Platform

**Name:** ArcGIS Static Basemap Tiles service.

**Variants:** ArcGIS families such as Navigation, Streets, Outdoor, Light Gray, Dark
Gray, Imagery Labels, and Human Geography, plus Open families such as OSM Style,
Navigation, Streets, Hybrid Detail, Light Gray, and Dark Gray.

**URL template:**
`https://static-map-tiles-api.arcgis.com/arcgis/rest/services/static-basemap-tiles-service/v1/{styleFamily}/{styleName}/static/tile/{z}/{y}/{x}`

Replace `{styleFamily}` and `{styleName}` with fixed values such as
`arcgis/navigation`. Note the documented path order `{z}/{y}/{x}`, which differs
from the usual textual order but can be represented by a *maptoy* template.

**Parameters and headers:** Fixed style family and style name, optional `language`
and `worldview`, and an access token with the
`premium:user:staticbasemaptiles` privilege. Prefer an `Authorization: Bearer
${MAPTOY_ARCGIS_ACCESS_TOKEN}` header over a query token when supported by the Map
Set.

**Policy notes:** Access requires an ArcGIS Location Platform or suitable ArcGIS
account and can incur tile-usage charges. Attribution can vary by style and
underlying data provider. Offline use, caching, redistribution, and export depend on
the applicable Esri agreement, service terms, and data-specific terms; the presence
of a static tile endpoint is not general permission for *maptoy*'s archive.

**Official information:** [Static Basemap Tiles introduction](https://developers.arcgis.com/documentation/mapping-and-location-services/mapping/basemaps/introduction-static-basemap-tiles-service/),
[service self-description](https://developers.arcgis.com/rest/static-basemap-tiles/service-self-get/),
[authentication](https://developers.arcgis.com/documentation/security-and-authentication/),
and [Esri legal overview](https://www.esri.com/en-us/legal/overview).

## Google Maps Platform

**Name:** Google Maps Platform Map Tiles API.

**Variants:** Roadmap, satellite, terrain, Street View, and Photorealistic 3D. Only
the 2D roadmap, satellite, and terrain responses resemble raster XYZ tiles.

**Manual Map Set URL template:**
`https://tile.googleapis.com/v1/2dtiles/{z}/{x}/{y}?session=${MAPTOY_GOOGLE_MAPS_SESSION_TOKEN}&key=${MAPTOY_GOOGLE_MAPS_API_KEY}`

**Parameters and workflow:** An API key and a short-lived session token are required.
*maptoy* can read both from its server environment and use an existing, currently
valid token for ordinary 2D tile requests. It does not create or renew that token.
The token must be created externally with a POST request containing `mapType`,
`language`, and `region`, plus optional scale, layer, and style settings. Google
currently documents a lifetime of about two weeks, subject to change. Replace the
environment value and restart or recreate the *maptoy* process when the token
expires. A viewport request is also needed to obtain current coverage and
attribution for the displayed area; *maptoy* does not perform that request.

**Policy and compatibility notes:** *maptoy* v1.0 intentionally has no Google Maps
adapter. Nevertheless, the generic Leaflet/XYZ adapter can technically request and
display 2D tiles when a valid session token is supplied as shown above. This is
limited manual compatibility, not a complete Google Maps Platform integration:
*maptoy* cannot maintain the required viewport-dependent attribution. Google also
restricts prefetching, caching, storage, non-visualization analysis, and offline
use. Unless the agreement applicable to the account explicitly permits them, keep
Tile Archive, cache, batch download, and server export disabled. A future dedicated
adapter would still need to implement Google's complete session and attribution
workflow and disable incompatible archive features.

**Official information:** [Map Tiles API overview](https://developers.google.com/maps/documentation/tile/overview),
[session tokens](https://developers.google.com/maps/documentation/tile/session_tokens),
[roadmap tile requests](https://developers.google.com/maps/documentation/tile/roadmap),
[Map Tiles policies](https://developers.google.com/maps/documentation/tile/policies),
and [Google Maps Platform terms](https://cloud.google.com/maps-platform/terms/).

## Choosing a provider for *maptoy* archives

For unrestricted revision history, batch downloads, snapshots, and exports, prefer
a tile service you operate yourself from data whose licence permits the intended use,
or a provider contract that explicitly grants server-side caching, historical
retention, bulk retrieval, export, and the required redistribution rights. Record the
terms URL, attribution, your review date, configured limits, and any written
permission in the Map Set. Provider documentation is technical guidance and does not
replace the current agreement that applies to your account.
