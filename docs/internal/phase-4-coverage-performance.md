# Phase 4 Coverage performance

Measured on 26 August 2026 with Node.js 24.19.0, SQLite 3.51.2, and an AMD Ryzen 9
3900X. The benchmark used an in-memory database with the production coordinate and
revision-time indexes. It inserted 100,000 current Tiles at source Zoom 14, then ran
ten current-against-current comparisons over all Tiles. Each response contained 104
aggregate cells at Zoom 9.

| Measurement | Result |
| --- | ---: |
| p50 | 991.7 ms |
| p95 | 1,007.2 ms |
| maximum | 1,007.2 ms |

An earlier query plan allowed SQLite to inline repeatedly referenced CTEs. A
10,000-Tile current query took 8.3 seconds and its comparison took 23.7 seconds.
Marking the selected states, coordinate union, and revision counts as `MATERIALIZED`
reduced the same measurements to 72.4 ms and 93.3 ms respectively.

The API hard-limits a response to 4,096 cells and the UI requests at most 1,024 for
a visible viewport. Missing Tiles are computed from the requested XYZ range; only
stored state and revision aggregates are read from SQLite. The existing unique
coordinate index on `(map_set_id, zoom, tile_x, tile_y)` and the revision-time index
cover the current, Snapshot, and time-based query paths, so Phase 4 requires no
additional migration or precomputed aggregate table. A later worker can add
`inProgress` counts without changing the response schema.
