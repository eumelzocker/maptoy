---
id: tile-cache
title: Tile Cache
language: en
---

# Tile Cache

maptoy stores successfully validated raster tiles as immutable revisions below
`MAPTOY_DATA_DIR/tiles`. SQLite contains the revision history and current pointers;
the image bytes remain directly accessible in the host data directory.

## Refresh modes

Normal map requests use `auto`: a current revision is returned until its configured
maximum age expires. A stale or missing tile is requested from the provider. Where
available, maptoy sends `If-None-Match` or `If-Modified-Since`; a `304` response only
updates validation timestamps.

- `auto` uses a fresh cached revision and validates stale content.
- `force` contacts the provider regardless of the configured maximum age.
- `cache-only` never contacts the provider and returns `404` when the selected tile
  is unavailable.

The API accepts the mode as `?refresh=auto`, `?refresh=force`, or
`?refresh=cache-only`. Concurrent requests for the same uncached logical tile share
one provider request.

## Immutable revisions

New bytes create a revision addressed by their SHA-256 hash. Earlier revisions are
not overwritten. If provider content changes from A to B and later back to A,
maptoy records three temporal revisions while reusing the original A file.

Files use this layout:

```text
tiles/<map-set-id>/<z>/<x>/<y>.<content-hash>.<ext>
```

Temporary files are written below the managed data directory and atomically moved
only after content type, image signature, size, and hash have been checked.

## Selecting a cache state

The default tile URL returns the current revision. Read-only historical selections
are available with exactly one of these query parameters:

- `snapshot=<snapshot-id>` selects the revision captured by an immutable snapshot.
- `asOf=<ISO-8601 timestamp>` selects the revision known at that time.
- `revision=<tile-revision-id>` selects one explicit revision.

Historical selection never causes a provider request.

## Snapshots and comparison

Open **Tile Cache** to create a named snapshot of all current revisions for the
Map Set. A snapshot does not copy image files. It stores explicit protected
references, making later reads reproducible.

The same view compares a snapshot with the current state by content hash and reports
identical, changed, added, and missing tiles. Deleting a snapshot removes only those
references, not Tile Revisions. Comparison counters are aggregated in SQLite rather
than loading every Tile hash into server memory.

## Statistics and deletion

The management view loads database totals and per-zoom summaries without walking
the Tile directory. The Revision Explorer remains empty until requested, then loads
at most 50 rows per page with optional zoom and current/historical filters. This
keeps the initial page bounded even for large archives. The state chip previews the
exact selected revision on demand without contacting the provider.

**Check consistency** explicitly scans the managed directory and reports physical
bytes, missing referenced files, and unreferenced files. The scan is not part of a
normal page load and may take a while for a large cache. Storage limits can reject
new content but never delete history automatically.

Only an explicit action can delete a historical Tile Revision. Current revisions and
snapshot-referenced revisions are protected. A content file is deleted only after
its final revision reference has been removed.

**Repair** becomes available only after a successful consistency check in the
current browser session and requires explicit confirmation. It removes
unreferenced files left by interrupted writes. It
also removes unusable Tile Revision records whose content files no longer exist,
clears affected current pointers and snapshot entries, and removes empty logical
tiles. Existing content files are never removed while the database still references
them. This action cannot be undone.
