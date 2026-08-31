# syntax=docker/dockerfile:1

FROM node:24.19.0-bookworm-slim AS toolchain

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

RUN apt-get update \
  && apt-get install --yes --no-install-recommends libimage-exiftool-perl \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@11.21.0 --activate

WORKDIR /workspace

FROM toolchain AS dependencies

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY adapters/leaflet-xyz/package.json adapters/leaflet-xyz/package.json
COPY apps/server/package.json apps/server/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/layer-plugin-sdk/package.json packages/layer-plugin-sdk/package.json
COPY packages/map-adapter-sdk/package.json packages/map-adapter-sdk/package.json
COPY packages/map-core/package.json packages/map-core/package.json
COPY plugins/photo-layer/package.json plugins/photo-layer/package.json
COPY plugins/tile-grid-layer/package.json plugins/tile-grid-layer/package.json
COPY plugins/track-layer/package.json plugins/track-layer/package.json

RUN pnpm install --frozen-lockfile

FROM dependencies AS build

COPY . .

RUN pnpm check
RUN pnpm --filter @maptoy/server deploy --prod /release/server
RUN mkdir -p /release/web && cp -R apps/web/dist /release/web/dist

FROM node:24.19.0-bookworm-slim AS runtime

RUN apt-get update \
  && apt-get install --yes --no-install-recommends ca-certificates gdal-bin libimage-exiftool-perl proj-bin tini \
  && rm -rf /var/lib/apt/lists/*

ENV MAPTOY_SERVER_HOST=0.0.0.0
ENV MAPTOY_SERVER_PORT=4004
ENV MAPTOY_STORAGE_DATA_DIR=/data
ENV MAPTOY_LOGGING_LEVEL=info
ENV MAPTOY_LOGGING_TRAFFIC_MAX_BYTES=10485760
ENV MAPTOY_LOGGING_TRAFFIC_MAX_FILES=5
ENV NODE_ENV=production

WORKDIR /app

COPY --from=build --chown=node:node /release/ /app/

RUN mkdir -p /data && chown node:node /data

USER node

EXPOSE 4004

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["node", "server/dist/healthcheck.js"]

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "server/dist/cli.js"]
