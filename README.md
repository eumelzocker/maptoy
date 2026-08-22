# maptoy

maptoy is a self-hosted application for viewing, archiving, and exporting raster
maps. It is designed to keep map-source configuration, downloaded tiles, revision
history, snapshots, and optional track or image layers under the user's control.

> maptoy is under active development. The repository currently provides the
> application shell, persistent XYZ Map Sets, a server-side provider proxy, the
> Leaflet map renderer, immutable Tile Revisions and snapshots, extension contracts,
> integrated documentation, and the container foundation. Batch downloads and
> exports are implemented in later phases.

## Start with Docker Compose

Requirements: Docker with the Compose plugin.

```sh
cp .env.example .env
mkdir -p .data
docker compose up --build
```

Open <http://localhost:4004>. Compose bind-mounts the host directory configured by
`MAPTOY_DATA_DIR` to `/data` in the container. The directory must exist and be
writable by the container user (UID `1000`). Database files and, in later phases,
the tile archive therefore remain directly visible and controllable on the host.

To stop the application without deleting its data:

```sh
docker compose down
```

Repository shortcuts are available as `pnpm d:up`, `pnpm d:down`, and
`pnpm d:logs`. Use `pnpm d:rebuild` after source or image changes to stop,
rebuild, and recreate the Compose service.

## Configuration

Edit `.env` before starting the application:

```dotenv
MAPTOY_HOST=0.0.0.0
MAPTOY_PORT=4004
MAPTOY_DATA_DIR=./.data
MAPTOY_LOG_LEVEL=info
MAPTOY_ALLOW_PRIVATE_TILE_HOSTS=false
MAPTOY_PROVIDER_TIMEOUT_MS=10000
MAPTOY_MAX_TILE_BYTES=10485760
```

For Compose, `MAPTOY_DATA_DIR` is the host side of the required bind mount. Inside
the container, maptoy always uses `/data`; the database is automatically stored as
`/data/maptoy.sqlite`. When running
without Docker, the same `.env` values are used directly. Compose does not create a
Docker-managed named or anonymous data volume. Variables from `.env`, including
provider secrets, are passed into the container; the internal data directory is
overridden with `/data`.

For operation below a URL prefix such as `/tools/maptoy/`, configure the reverse
proxy to remove that prefix before forwarding requests. All frontend URLs and the
generated HTML base are relative, so clean routes such as `/tools/maptoy/docs/en`
remain directly accessible and bookmarkable.

Minimal nginx example:

```nginx
location = /tools/maptoy {
    return 308 /tools/maptoy/;
}

location /tools/maptoy/ {
    proxy_pass http://127.0.0.1:4004/;
}
```

The operational endpoints are available relative to the public entry URL:

- `api/health` — process liveness
- `api/ready` — data-directory readiness
- `api/map-sets` — persistent Map Set management
- `api/map-sets/:id/tiles/:z/:x/:y` — revision-aware Tile Cache and proxy

Provider secrets use `MAPTOY_*` environment variables and are referenced from Map
Sets as `${MAPTOY_EXAMPLE_API_KEY}`. Private and link-local provider hosts are
blocked by default. See the integrated **Map Sets** documentation before enabling
`MAPTOY_ALLOW_PRIVATE_TILE_HOSTS=true` for a trusted self-hosted tile server.

## Local development with Nix

Requirements: Nix with flakes and direnv.

```sh
direnv allow
pnpm install
pnpm start
```

Run all formatting, linting, build, type-checking, and test gates with:

```sh
pnpm check
```

The implementation roadmap and architectural decisions are documented in
[`plan.md`](./plan.md) and [`docs/internal/adr`](./docs/internal/adr).
