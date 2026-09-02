---
id: getting-started
title: Getting started
language: en
---

# Getting started

*maptoy* can store XYZ Map Sets and display them through its Leaflet renderer. When
the server starts with an empty `map_sets` table, it automatically creates an
**OpenTopoMap** Map Set. This credential-free default includes the OpenTopoMap
CC-BY-SA and OpenStreetMap contributor attribution and links to the provider's
information page. Existing Map Sets are left unchanged. If you delete every Map
Set, OpenTopoMap is created again on the next server start.

Open **Map Sets** to review, edit, duplicate, delete, or add sources, then select a
source on **Map**. Review the linked provider information before using the default
beyond low-volume exploration. Provider URLs remain on the server side and browser
tile requests use relative *maptoy* API URLs.

## Development commands

Run `pnpm install` once inside the development shell. Use `pnpm start` to build and
start the application, and `pnpm check` to run formatting, linting, builds, type
checks, and tests.

The server defaults to port `4004`. A reverse proxy can publish it below a subpath by
removing that prefix before forwarding requests. Application routes, assets, the
generated HTML base, and API calls remain relative to the public entry URL.

Continue with [Map Sets](docs/en/map-sets) for configuration, secret references,
provider testing, and network-safety details.

## Docker data directory

Copy `.env.example` to `.env`, choose a host directory with `MAPTOY_STORAGE_DATA_DIR`,
and create it before starting Compose. The default setup is:

```sh
cp .env.example .env
mkdir -p .data/logs
docker compose up --build
```

Runtime settings follow `MAPTOY_<DOMAIN>_<PROPERTY>`. The current domains are
`SERVER`, `STORAGE`, `LOGGING`, `TILES`, `LAYERS`, `JOBS`, and `PHOTOS`; provider
secrets use the provider name as their domain. Previous variable names are not
supported.

Set `MAPTOY_PHOTOS_DIR` to an existing host directory when using the Photo catalog.
The standard Compose file mounts it read-only automatically; no additional Compose
file or special start command is required.

Compose bind-mounts that host directory to `/data` in the container. The SQLite
database is stored as `maptoy.sqlite` in it; future tile archives and exports use
the same host-controlled directory. *maptoy* does not use a Docker-managed named or
anonymous volume for persistent application data. The directory must be writable
by UID `1000`, which is the non-root user running the container.

SQLite schema version 4 is *maptoy*'s production baseline. New installations first
create that baseline and then apply every numbered migration, including version 5's
Tile Revision origin. Versions 1 through 3 were development-only schemas and are
not supported upgrade sources; no production database predates version 4.

`MAPTOY_TILES_MAX_BYTES` limits both provider responses and the raw body of the Tile
seeding route. The upload limit is route-specific and does not reduce the accepted
size of Map Set JSON or unrelated API requests.

Terminal Jobs are retained for 30 days by default. Configure that period with
`MAPTOY_JOBS_RETENTION_DAYS` and the per-Job diagnostic history with
`MAPTOY_JOBS_ERROR_HISTORY_LIMIT`. Cleanup runs during startup and hourly; a trusted
operator can also trigger the same policy with `POST api/jobs/cleanup`. Queued,
running, and paused Jobs are never removed by retention.

## Traffic logs

*maptoy* keeps client/API traffic and backend/tile-provider traffic in separate
JSON Lines logs. Compose bind-mounts the shared directory configured by
`MAPTOY_LOGGING_DIR`; its default is below `MAPTOY_STORAGE_DATA_DIR`, but it can
point elsewhere on the host. *maptoy* creates the `api` and `provider`
subdirectories when needed. Their active files are named `api-traffic.log` and
`provider-traffic.log`.

`MAPTOY_LOGGING_TRAFFIC_MAX_BYTES` controls the size of each file before rotation.
`MAPTOY_LOGGING_TRAFFIC_MAX_FILES` controls the total retained files per traffic type,
including the active file. Authentication headers, cookies, and common secret
query parameters are redacted. The shared log directory must exist before Compose
starts and must be writable by UID `1000`. Requests to the liveness endpoint
`api/health` are excluded from API traffic logs regardless of their origin; Docker
continues to evaluate and expose the container health status.

The readiness endpoint verifies the database and the continued writability of the
application data directory and both generated traffic-log subdirectories. Traffic
logs configured outside `MAPTOY_STORAGE_DATA_DIR` are not part of the core
application-data backup and only need a separate backup if these bounded
operational records should be retained.
