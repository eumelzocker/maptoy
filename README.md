# maptoy

maptoy is a self-hosted application for viewing, archiving, and exporting raster
maps. It is designed to keep map-source configuration, downloaded tiles, revision
history, snapshots, and optional track or image layers under the user's control.

> maptoy is under active development. The repository currently provides the
> application shell, extension contracts, integrated documentation, and container
> foundation. Map Sets, tile archiving, and exports are implemented in later phases.

## Start with Docker Compose

Requirements: Docker with the Compose plugin.

```sh
cp .env.example .env
docker compose up --build
```

Open <http://localhost:4004>. Application data is stored in the Compose-managed
`maptoy-data` volume and remains available across container restarts.

To stop the application without deleting its data:

```sh
docker compose down
```

## Configuration

Edit `.env` before starting the application:

```dotenv
MAPTOY_HOST=0.0.0.0
MAPTOY_PORT=4004
MAPTOY_DATA_DIR=.data
MAPTOY_LOG_LEVEL=info
```

Compose stores application data at `/data` inside the container; the local
`MAPTOY_DATA_DIR` value is used when running without Docker.

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
