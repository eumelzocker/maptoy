# ADR 0002: Trusted layer-plugin lifecycle

Status: accepted  
Date: 2026-08-21

## Context

Track and image layers must use the same data in the interactive map and bitmap
export, while plugins must not receive unrestricted access to application internals.
v1 does not need runtime installation of arbitrary code.

## Decision

Layer plugins are trusted packages selected at build or deployment time and added to
explicit frontend and server registries. There is no plugin-code upload or install
API in v1.

A plugin manifest contains a stable plugin ID, plugin version, compatible SDK range,
versioned configuration/data schemas, capabilities, and ordered migration steps. A
plugin can provide these controlled hooks:

- shared validation and deterministic schema migration;
- frontend import/editor metadata and adapter-neutral interactive rendering;
- server asset validation and normalization;
- server preview generation;
- server export rendering.

Hooks receive the smallest context required for their task. Server hooks use managed
asset IDs, bounded byte streams, a redacted logger, coordinate transforms, and a
controlled drawing surface. They do not receive Fastify, the database connection,
arbitrary paths, environment variables, secrets, or general network access.

Persisted instances retain plugin ID, plugin version, schema version, validated
configuration, display properties, and managed asset references. Missing or
incompatible plugins disable the instance with a diagnosis but do not delete or
silently migrate its data.

SDK compatibility uses semantic versioning. Contract tests cover manifest checking,
validation, migrations, lifecycle cleanup, interactive handles, and server rendering.
The track and image plugins are the reference implementations for v1.

## Historical spike evidence

The completed rendering spike registered track and image hooks behind the same small
server contract. It rendered a GeoJSON track, an EXIF-oriented GPS image, and a
bounds image without giving those hooks arbitrary filesystem access. Managed fixture
paths were checked before hook execution. The prototype was removed after its
decisions were accepted and remains available in the repository history.

## Consequences

Build-time trust keeps the first security model understandable but requires a new
application build to add plugin code. A future signed administrative distribution
mechanism requires a separate ADR and does not weaken this v1 boundary implicitly.
