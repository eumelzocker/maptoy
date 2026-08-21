# ADR 0005: Use Node.js SQLite for metadata

Status: accepted
Date: 2026-08-21

## Context

maptoy needs transactional, persistent metadata without an external database. The
runtime is pinned to Node.js 24, which includes the `node:sqlite` API. Phase 2 uses
SQLite for Map Sets and establishes the migration mechanism that later phases will
extend for source revisions, tiles, snapshots, layers, and jobs.

## Decision

Use `DatabaseSync` from `node:sqlite` behind repository classes. Run numbered SQL
migrations transactionally during server startup, enable foreign keys and WAL, and
store the database as `maptoy.sqlite` below `MAPTOY_DATA_DIR`. Keeping all
persistent files below one configured data directory makes bind-mount persistence,
backup, and restore behavior unambiguous.

Synchronous statements are acceptable for the small, single-user configuration
transactions in Phase 2. HTTP and filesystem work remains asynchronous. Repository
interfaces keep SQLite details out of route handlers and make it possible to move
expensive later workloads to a worker or different access pattern if measurements
show event-loop contention.

## Consequences

The application needs no third-party native Node binding or compilation step for
SQLite. The database uses the same pinned Node runtime in development and the
container. Startup fails rather than continuing with a partially applied migration.
Readiness checks both the data directory and a database query.

Later phases must keep long scans and batch mutations bounded and measured. Backup,
restore, migration recovery, and WAL handling still require dedicated operational
documentation before v1.0.
