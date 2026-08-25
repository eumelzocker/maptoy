# Bruno collection

Open this directory as a Bruno collection and select the `Local` environment. Its
`appUrl` defaults to `http://localhost:4004`; include a public reverse-proxy prefix
in that value when needed. The first two read-only requests verify health and
readiness without changing application data.

Set `mapSetId` to an existing Map Set and `tileZ`, `tileX`, and `tileY` to a valid
coordinate before running Tile requests. Set `tileRefresh` to `auto`, `force`, or
`cache-only` to exercise the corresponding Tile GET strategy. Requests whose names
say that they write data or create a snapshot are intentionally not part of a
read-only smoke run. The consistency check is read-only but explicitly scans the
complete managed Tile directory and may take time on a large cache.

Before using the Tile-seeding request, set `tileFile` to an absolute PNG, JPEG, or
WebP path and adjust its `Content-Type` header to the Map Set's configured format.
The request sends that file directly as the body and is intentionally marked as a
write operation.
