import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { MaptoyConfig } from "@maptoy/config";
import { createDefaultMapSetInput } from "@maptoy/contracts";
import { afterEach, describe, expect, it } from "vitest";
import type { ProviderClient } from "./providerClient.js";
import { buildServer } from "./server.js";

const temporaryDirectories: string[] = [];
const validPng = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.from("maptoy-test"),
]);

async function testConfig(): Promise<MaptoyConfig> {
  const dataDirectory = await mkdtemp(
    path.join(tmpdir(), "maptoy-server-test-"),
  );
  temporaryDirectories.push(dataDirectory);
  return {
    host: "127.0.0.1",
    port: 4004,
    dataDirectory,
    databasePath: path.join(dataDirectory, "maptoy.sqlite"),
    logLevel: "silent",
    allowPrivateTileHosts: true,
    providerTimeoutMilliseconds: 1000,
    maximumTileBytes: 1024 * 1024,
  };
}

const providerClient: ProviderClient = {
  request: async () => ({
    statusCode: 200,
    headers: { "content-type": "image/png" },
    body: validPng,
  }),
};

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("maptoy server", () => {
  it("serves health, readiness, and extension manifests", async () => {
    const server = await buildServer({
      config: await testConfig(),
      serveWeb: false,
    });

    const health = await server.inject({
      method: "GET",
      url: "/api/health",
    });
    const ready = await server.inject({
      method: "GET",
      url: "/api/ready",
    });
    const mapRenderers = await server.inject({
      method: "GET",
      url: "/api/map-renderers",
    });
    const layerPlugins = await server.inject({
      method: "GET",
      url: "/api/layer-plugins",
    });

    expect(health.statusCode).toBe(200);
    expect(health.json()).toEqual({ status: "ok" });
    expect(ready.statusCode).toBe(200);
    expect(ready.json()).toEqual({ status: "ready" });
    expect(mapRenderers.json()).toMatchObject({
      items: [{ id: "leaflet-xyz", sdkVersion: "1.0.0" }],
    });
    expect(layerPlugins.json()).toMatchObject({
      items: [
        { id: "track-layer", sdkVersion: "1.0.0" },
        { id: "image-layer", sdkVersion: "1.0.0" },
      ],
    });
    await server.close();
  });

  it("creates, updates, tests, persists, and deletes Map Sets", async () => {
    const config = await testConfig();
    const server = await buildServer({
      config,
      environment: { MAPTOY_TEST_KEY: "secret-value" },
      providerClient,
      serveWeb: false,
    });
    const input = {
      ...createDefaultMapSetInput(),
      name: "Local test map",
      minZoom: 1,
      maxZoom: 15,
      urlTemplate:
        "http://tiles.example.test/{z}/{x}/{y}.png?key=$" + "{MAPTOY_TEST_KEY}",
    };

    const created = await server.inject({
      method: "POST",
      url: "/api/map-sets",
      payload: input,
    });
    expect(created.statusCode).toBe(201);
    expect(created.body).not.toContain("secret-value");
    const mapSet = created.json();

    const updated = await server.inject({
      method: "PATCH",
      url: `/api/map-sets/${mapSet.id}`,
      payload: { name: "Updated map" },
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json()).toMatchObject({ name: "Updated map" });

    const belowMinimumZoom = await server.inject({
      method: "GET",
      url: `/api/map-sets/${mapSet.id}/tiles/0/0/0?refresh=cache-only`,
    });
    const aboveMaximumZoom = await server.inject({
      method: "GET",
      url: `/api/map-sets/${mapSet.id}/tiles/16/0/0?refresh=cache-only`,
    });
    expect(belowMinimumZoom).toMatchObject({ statusCode: 400 });
    expect(belowMinimumZoom.json()).toMatchObject({
      error: { code: "MAP_SET_INVALID" },
    });
    expect(aboveMaximumZoom).toMatchObject({ statusCode: 400 });
    expect(aboveMaximumZoom.json()).toMatchObject({
      error: { code: "MAP_SET_INVALID" },
    });

    const tested = await server.inject({
      method: "POST",
      url: `/api/map-sets/${mapSet.id}/test`,
    });
    expect(tested.statusCode).toBe(200);
    expect(tested.json()).toMatchObject({
      ok: true,
      statusCode: 200,
      contentType: "image/png",
    });
    const tile = await server.inject({
      method: "GET",
      url: `/api/map-sets/${mapSet.id}/tiles/10/550/335`,
    });
    expect(tile.statusCode).toBe(200);
    expect(tile.headers["content-type"]).toContain("image/png");
    expect(tile.headers["x-maptoy-cache"]).toBe("miss");
    expect(tile.rawPayload).toEqual(validPng);
    const cachedTile = await server.inject({
      method: "GET",
      url: `/api/map-sets/${mapSet.id}/tiles/10/550/335?refresh=cache-only`,
    });
    expect(cachedTile.statusCode).toBe(200);
    expect(cachedTile.headers["x-maptoy-cache"]).toBe("hit");

    const metadataUpdate = await server.inject({
      method: "PATCH",
      url: `/api/map-sets/${mapSet.id}`,
      payload: { notes: "Cached Map Sets still allow metadata changes." },
    });
    expect(metadataUpdate.statusCode).toBe(200);
    const sourceUpdate = await server.inject({
      method: "PATCH",
      url: `/api/map-sets/${mapSet.id}`,
      payload: {
        urlTemplate: "http://other.example.test/{z}/{x}/{y}.png",
      },
    });
    expect(sourceUpdate.statusCode).toBe(409);
    expect(sourceUpdate.json()).toMatchObject({
      error: { code: "MAP_SET_SOURCE_LOCKED" },
    });

    const stats = await server.inject({
      method: "GET",
      url: `/api/map-sets/${mapSet.id}/cache/stats`,
    });
    expect(stats.json()).toMatchObject({
      logicalTileCount: 1,
      currentRevisionCount: 1,
      historicalRevisionCount: 0,
      totalStorageBytes: validPng.byteLength,
      zoomLevels: [{ zoom: 10, logicalTileCount: 1 }],
    });
    const audit = await server.inject({
      method: "POST",
      url: `/api/map-sets/${mapSet.id}/cache/audit`,
    });
    expect(audit.json()).toMatchObject({
      scannedFileCount: 1,
      missingFileCount: 0,
      orphanFileCount: 0,
    });
    const createdSnapshot = await server.inject({
      method: "POST",
      url: `/api/map-sets/${mapSet.id}/snapshots`,
      payload: { name: "smoke" },
    });
    expect(createdSnapshot.statusCode).toBe(201);
    expect(createdSnapshot.json()).toMatchObject({
      name: "smoke",
      tileCount: 1,
    });
    const snapshotId = createdSnapshot.json().id;
    const snapshotTile = await server.inject({
      method: "GET",
      url: `/api/map-sets/${mapSet.id}/tiles/10/550/335?snapshot=${snapshotId}`,
    });
    expect(snapshotTile.rawPayload).toEqual(validPng);
    const revisions = await server.inject({
      method: "GET",
      url: `/api/map-sets/${mapSet.id}/tile-revisions`,
    });
    expect(revisions.json()).toMatchObject({
      items: [{ current: true, byteLength: validPng.byteLength }],
      total: 1,
      nextCursor: null,
    });
    const protectedDeletion = await server.inject({
      method: "DELETE",
      url: `/api/map-sets/${mapSet.id}/tile-revisions/${revisions.json().items[0].id}`,
    });
    expect(protectedDeletion.statusCode).toBe(409);
    await server.close();

    const restarted = await buildServer({
      config,
      providerClient,
      serveWeb: false,
    });
    const listed = await restarted.inject({
      method: "GET",
      url: "/api/map-sets",
    });
    expect(listed.json()).toMatchObject({ items: [{ name: "Updated map" }] });

    const deleted = await restarted.inject({
      method: "DELETE",
      url: `/api/map-sets/${mapSet.id}`,
    });
    expect(deleted.statusCode).toBe(204);
    expect(
      await restarted.inject({
        method: "GET",
        url: `/api/map-sets/${mapSet.id}`,
      }),
    ).toMatchObject({ statusCode: 404 });
    await restarted.close();
  });

  it("uses a route-relative base for clean SPA routes and assets", async () => {
    const staticDirectory = fileURLToPath(
      new URL("../../web/dist", import.meta.url),
    );
    await readFile(path.join(staticDirectory, "index.html"));
    const server = await buildServer({
      config: await testConfig(),
      staticDirectory,
    });

    const application = await server.inject({
      method: "GET",
      url: "/docs/en/getting-started",
    });
    const missingApi = await server.inject({
      method: "GET",
      url: "/api/missing",
    });
    const rootApplication = await server.inject({
      method: "GET",
      url: "/",
    });

    expect(application.statusCode).toBe(200);
    expect(application.headers["content-type"]).toContain("text/html");
    expect(application.body).toContain('<base href="../../" />');
    const assetPath = application.body.match(
      /(?:src|href)="\.\/(assets\/[^"]+)"/,
    )?.[1];
    expect(assetPath).toBeDefined();
    const publicDeepLink =
      "https://example.test/tools/maptoy/docs/en/getting-started";
    const publicBase = new URL("../../", publicDeepLink);
    expect(publicBase.pathname).toBe("/tools/maptoy/");
    expect(new URL(`./${assetPath}`, publicBase).pathname).toBe(
      `/tools/maptoy/${assetPath}`,
    );
    const asset = await server.inject({
      method: "GET",
      url: `/${assetPath}`,
    });
    expect(asset.statusCode).toBe(200);
    expect(missingApi.statusCode).toBe(404);
    expect(rootApplication.body).toContain('<base href="./" />');

    await server.close();
  });
});
