# ADR 0005: Use Node.js SQLite for metadata

Status: accepted
Date: 2026-08-21
Amended: 2026-08-24

## Context

maptoy needs transactional, persistent metadata without an external database. The
runtime is pinned to Node.js 24, which includes the `node:sqlite` API. SQLite was
introduced for Map Sets and provides the migration mechanism that later phases
extend for Tile Revisions, snapshots, layers, and jobs.

## Decision

Use `DatabaseSync` from `node:sqlite` behind repository classes. Run numbered,
external SQL migration assets transactionally during server startup, enable foreign
keys and WAL, and store the database as `maptoy.sqlite` below `MAPTOY_STORAGE_DATA_DIR`.

Schema version 4 is the production baseline. No production database uses an older
schema; pre-baseline versions 1 through 3 were development-only steps and are not
supported upgrade sources. A new installation applies the version 4 baseline
directly. Every future schema change uses a version greater than 4 and preserves
data from an existing baseline-4-or-newer database.

Core persistent application data remains below `MAPTOY_STORAGE_DATA_DIR`, making its
bind-mount persistence, backup, and restore behavior unambiguous. Rotating API and
provider traffic logs are operational artifacts rather than core application state.
They default to subdirectories of `MAPTOY_STORAGE_DATA_DIR`, but may use independently
configured host bind mounts and must then be backed up separately if retention
outside maptoy's bounded log rotation is desired.

Synchronous statements are acceptable for the small, single-user configuration
transactions in Phase 2. HTTP and filesystem work remains asynchronous. Repository
interfaces keep SQLite details out of route handlers and make it possible to move
expensive later workloads to a worker or different access pattern if measurements
show event-loop contention.

## Consequences

The application needs no third-party native Node binding or compilation step for
SQLite. The database uses the same pinned Node runtime in development and the
container. Startup fails rather than continuing with a partially applied migration.
Tests create the version 4 baseline directly, reopen it without rerunning the
baseline, and must preserve its data when future migrations are added.

Readiness checks a database query and verifies that `MAPTOY_STORAGE_DATA_DIR` plus both
configured traffic-log directories remain writable. Losing a traffic-log bind mount
therefore makes the instance not ready instead of silently presenting full
operational readiness.

Later phases must keep long scans and batch mutations bounded and measured. Backup,
restore, migration recovery, and WAL handling still require dedicated operational
documentation before v1.0.
