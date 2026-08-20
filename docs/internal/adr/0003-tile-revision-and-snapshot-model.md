# ADR 0003: Immutable tile revisions and snapshots

Status: accepted  
Date: 2026-08-21

## Context

maptoy must preserve provider changes, reproduce historical exports, represent an
`A -> B -> A` content sequence, and avoid duplicate content files. Configuration
changes affecting tile retrieval must not rewrite earlier history.

## Decision

A source revision is an immutable, fingerprinted copy of every Map Set field that can
affect requested or interpreted tile bytes. A Map Set points to one active source
revision; relevant edits create a new revision rather than changing an existing one.

A logical tile is identified by Map Set, source revision, zoom, x, and y. Each
successful content transition creates an immutable tile-revision row with observation
and validation timestamps, redacted provider validators, media metadata, content
hash, and selection interval. The current pointer is explicit.

Content bytes are stored under the Map Set by coordinate and cryptographic hash.
Equal bytes reuse the same content file. If content changes `A -> B -> A`, the final
observation creates a new temporal revision row that references the existing `A`
file. Thus storage is deduplicated without collapsing history.

A snapshot is immutable and stores explicit references from a named snapshot to the
selected tile revisions. An `asOf` lookup selects the most recent known revision at
or before the requested instant. Explicit revision selection bypasses current and
temporal resolution.

New bytes are written and validated in a managed temporary path, hashed, and
atomically promoted before the database transaction exposes the revision. Concurrent
requests for the same logical tile share one in-flight operation. A failed process
may leave removable temporary data but never a registered partial content file.

Historical rows are never removed automatically. Explicit deletion refuses current
or snapshot-referenced revisions. A content file is removable only when no revision
references its hash. Repair scans are non-destructive by default.

## Consequences

The model uses more metadata than an overwrite cache but makes current, snapshot,
temporal, and explicit-revision reads deterministic. Provider validation that returns
unchanged content updates observation metadata without creating a duplicate temporal
revision. Retention and capacity controls may block new intake, but they cannot
silently erase history.
