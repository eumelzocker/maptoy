# Bruno collection

Open this directory as a [Bruno](https://github.com/usebruno/bruno) collection and select the `Local` environment. Its `appUrl` defaults to `http://localhost:4004`. The first two read-only requests verify health and readiness without changing application data.

Set `mapSetId` to an existing Map Set and `tileZ`, `tileX`, and `tileY` to a valid coordinate before running Tile requests. Set `tileRefresh` to `auto`, `force`, or `cache-only` to exercise the corresponding Tile GET strategy. The consistency check is read-only but explicitly scans the complete managed Tile directory and may take time on a large cache.

Before using the Tile-seeding request, set `tileFile` to an absolute PNG, JPEG, or WebP path and adjust its `Content-Type` header to the Map Set's configured format. The request sends that file directly as the body.

Layer requests use `layerId` for a Track Layer, `imageLayerId` for an Image Layer, `layerAssetFile` for a GPX or GeoJSON file, and `imageRootId` for one of the safe IDs returned by **Image Roots - List**. Upload and scan requests are explicitly marked as state-changing and should be run individually.
