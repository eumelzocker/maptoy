# maptoy

*maptoy* is a self-hosted application for viewing, archiving, and exporting maps and custom layers. For developers, it is a strong foundation for playing around with any kind of geospatial data.

**[Screenshots](./docs/en/screenshots.md)**

> *maptoy* is under active development. Currently available features include:
>
> - Interactive map
> - Map Sets
> - Immutable tile revisions
> - Snapshots
> - Cache coverage overview
> - Controlled batch downloads
> - Map compare
> - Track and external photo layers
> - Integrated documentation
>
> Exports in additional map projections will be added soon.<br>
> Support for vector maps comes in v2.

## Start with Docker Compose 🐳

**Requirements:** Docker with the Compose plugin. If you don't know what the hell that means, *maptoy* is currently not for you, sorry!

```sh
cp .env.example .env
mkdir -p .data/logs
docker compose up --build --detach
```

Open <http://localhost:4004>.

When the server starts with an empty Map Set table, *maptoy* creates an **OpenTopoMap** Map Set automatically. It uses no provider secret and includes the OpenTopoMap CC-BY-SA and OpenStreetMap contributor attribution. Existing Map Sets are never changed or supplemented; if all Map Sets are deleted, the default is created again on the next server start. Review the linked provider information before using the service beyond low-volume exploration.

Compose bind-mounts the host directories configured by `MAPTOY_STORAGE_DATA_DIR` and `MAPTOY_LOGGING_DIR`. They must exist and be writable by the container user. The defaults created above keep everything below `.data`.

Edit `.env` to change the port, data paths, logging, provider limits, or provider secrets. Available settings are listed in [`.env.example`](./.env.example) and explained in the integrated **[Getting started](./docs/en/getting-started.md)** and **[Map Sets](./docs/en/map-sets.md)** documentation.

To scan an existing photo directory without copying originals into *maptoy*, set the host path in `.env`:

```dotenv
MAPTOY_PHOTOS_DIR=~/Pictures
```

Then start maptoy normally:

```sh
docker compose up --build --detach
```

Compose mounts the directory read-only; neither that path nor the host path is exposed to the browser. See **[Layers, tracks, and external photos](./docs/en/layers.md)** in the integrated documentation for storage rules and limits.

To stop the application without deleting its data:

```sh
docker compose down
```

## Reverse proxy

To publish *maptoy* below a URL prefix such as `/tools/maptoy/`, configure the reverse proxy to remove that prefix before forwarding requests.

Minimal nginx example:

```nginx
location = /tools/maptoy {
    return 308 /tools/maptoy/;
}

location /tools/maptoy/ {
    proxy_pass http://127.0.0.1:4004/;
}
```

*maptoy* v1 does not authenticate API clients. Keep the service on a trusted private network, or add authentication and authorization at the reverse proxy before making it reachable from an untrusted network. In particular, never expose the Tile seeding `POST` endpoint to untrusted clients without access control.

## Firefox extension

This repository also contains the independently versioned [*maptoy* Firefox extension](./extensions/firefox/README.md). It can forward matching browser responses unchanged to configurable HTTP endpoints, including *maptoy*'s Tile seeding API. This allows *maptoy* to cache map tiles from your normal browser sessions.

The extension can also be easily reconfigured to feed other caching APIs.

The extension has its own build and test commands and is not included in the Docker image.

## Warnings

- This repository may contain AI slop!
- This repository may contain human stupidity!
- Use at your own risk! No warranties, no refunds!
- Feature requests and issues will probably be ignored!
- The app does not support authentication or authorization; keep your installation private!
- Respect map providers' rules!

## License

[WTFPL](https://www.wtfpl.net/)
