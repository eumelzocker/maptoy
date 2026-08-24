# maptoy

maptoy is a self-hosted application for viewing, archiving, and exporting raster
maps while keeping configuration and stored data under the user's control.

> maptoy is under active development. Map Sets, the interactive map, immutable
> Tile Revisions, snapshots, the Cache overview, and integrated documentation are
> available now. Batch downloads, additional layers, and exports will be added in
> later versions.

## Start with Docker Compose

Requirements: Docker with the Compose plugin.

```sh
cp .env.example .env
mkdir -p .data/logs/api .data/logs/provider
docker compose up --build
```

Open <http://localhost:4004>. Compose bind-mounts the host directory configured by
`MAPTOY_DATA_DIR` and the two traffic-log directories. They must exist and be
writable by the container user (UID `1000`). The defaults created above keep all
of them below `.data`.

Edit `.env` to change the port, data paths, logging, provider limits, or provider
secrets. Available settings are listed in [`.env.example`](./.env.example) and
explained in the integrated **Getting started** and **Map Sets** documentation.

To stop the application without deleting its data:

```sh
docker compose down
```

## Reverse proxy

To publish maptoy below a URL prefix such as `/tools/maptoy/`, configure the reverse
proxy to remove that prefix before forwarding requests.

Minimal nginx example:

```nginx
location = /tools/maptoy {
    return 308 /tools/maptoy/;
}

location /tools/maptoy/ {
    proxy_pass http://127.0.0.1:4004/;
}
```
