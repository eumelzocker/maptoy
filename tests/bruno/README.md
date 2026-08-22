# Bruno collection

Open this directory as a Bruno collection and select the `Local` environment. Its
`appUrl` defaults to `http://localhost:4004`; include a public reverse-proxy prefix
in that value when needed. The first two read-only requests verify health and
readiness without changing application data.

Set `mapSetId` to an existing Map Set before running Tile Cache requests. Requests
whose names say that they write data or create a snapshot are intentionally not part
of a read-only smoke run. The consistency check is read-only but explicitly scans
the complete managed Tile directory and may take time on a large cache.
