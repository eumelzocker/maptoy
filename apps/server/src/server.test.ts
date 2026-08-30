import { execFile } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  unlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import type { MaptoyConfig } from "@maptoy/config";
import { createDefaultMapSetInput } from "@maptoy/contracts";
import { xyzTileBounds } from "@maptoy/map-core";
import sharp from "sharp";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ProviderClient } from "./providerClient.js";
import { buildServer } from "./server.js";

const executeFile = promisify(execFile);

const temporaryDirectories: string[] = [];
const validPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAQAAAAEAAQMAAABmvDolAAAAA1BMVEUBAQHIpFY6AAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAH0lEQVRo3u3BAQ0AAADCoPdPbQ43oAAAAAAAAAAAvg0hAAABfxmcpwAAAABJRU5ErkJggg==",
  "base64",
);
const wrongSizePng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAIAAAACAAQMAAAD58POIAAAAA1BMVEUBAQHIpFY6AAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAGUlEQVRIx2NgGAWjYBSMglEwCkbBKKAvAAAIgAABbisdVAAAAABJRU5ErkJggg==",
  "base64",
);
const jpeg = Buffer.from(
  "/9j/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAEAAQADASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAj/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AKpAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB//9k=",
  "base64",
);

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
    apiTrafficLogDirectory: path.join(dataDirectory, "logs", "api"),
    providerTrafficLogDirectory: path.join(dataDirectory, "logs", "provider"),
    trafficLogMaxBytes: 1024 * 1024,
    trafficLogMaxFiles: 3,
    allowPrivateTileHosts: true,
    providerTimeoutMilliseconds: 1000,
    maximumTileBytes: 1024 * 1024,
    maximumLayerAssetBytes: 1024 * 1024,
    imageRoots: [],
    maximumImageBytes: 10 * 1024 * 1024,
    maximumImagePixels: 10_000_000,
    imagePreviewMaximumEdge: 320,
    imageScanBatchSize: 10,
    imageDecoderConcurrency: 1,
    maximumImageScanFiles: 1000,
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
  it("seeds OpenTopoMap whenever the Map Set table is empty at startup", async () => {
    const config = await testConfig();
    const firstServer = await buildServer({ config, serveWeb: false });

    const firstList = await firstServer.inject({
      method: "GET",
      url: "/api/map-sets",
    });
    expect(firstList.statusCode).toBe(200);
    expect(firstList.json()).toEqual({
      items: [
        {
          id: expect.stringMatching(
            /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
          ),
          name: "OpenTopoMap",
          sourceType: "xyz-raster",
          urlTemplate: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
          attribution:
            '© <a href="http://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>) | Map data © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors.',
          termsUrl: "https://opentopomap.org/about",
          notes: "",
          termsReviewedAt: "2026-08-23",
          minZoom: 0,
          maxZoom: 17,
          tileSize: 256,
          tileFormat: "png",
          subdomains: ["a", "b", "c"],
          headers: {},
          sourceProjection: "EPSG:3857",
          defaultCenter: { longitude: 10, latitude: 53.55 },
          defaultZoom: 11,
          rendererId: "leaflet-xyz",
          capabilities: {
            interactive: true,
            tileArchive: true,
            batchDownload: true,
            serverExport: true,
            layerRendering: true,
          },
          cachePolicy: {
            enabled: true,
            maximumAgeSeconds: 2_592_000,
            maximumStorageBytes: null,
          },
          downloadPolicy: {
            requestsPerSecond: 5,
            concurrency: 2,
            retryLimit: 3,
            dailyRequestLimit: null,
          },
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
          logicalTileCount: 0,
        },
      ],
    });
    const firstId = firstList.json().items[0].id as string;
    await firstServer.close();

    const unchangedServer = await buildServer({ config, serveWeb: false });
    const unchangedList = await unchangedServer.inject({
      method: "GET",
      url: "/api/map-sets",
    });
    expect(unchangedList.json().items).toHaveLength(1);
    expect(unchangedList.json().items[0].id).toBe(firstId);
    await unchangedServer.inject({
      method: "DELETE",
      url: `/api/map-sets/${firstId}`,
    });
    await unchangedServer.close();

    const reseededServer = await buildServer({ config, serveWeb: false });
    const reseededList = await reseededServer.inject({
      method: "GET",
      url: "/api/map-sets",
    });
    expect(reseededList.json().items).toHaveLength(1);
    expect(reseededList.json().items[0]).toMatchObject({
      name: "OpenTopoMap",
      logicalTileCount: 0,
    });
    expect(reseededList.json().items[0].id).not.toBe(firstId);
    const reseededId = reseededList.json().items[0].id as string;
    const existingMapSet = await reseededServer.inject({
      method: "POST",
      url: "/api/map-sets",
      payload: {
        ...createDefaultMapSetInput(),
        name: "Existing Map Set",
      },
    });
    await reseededServer.inject({
      method: "DELETE",
      url: `/api/map-sets/${reseededId}`,
    });
    await reseededServer.close();

    const nonEmptyServer = await buildServer({ config, serveWeb: false });
    const nonEmptyList = await nonEmptyServer.inject({
      method: "GET",
      url: "/api/map-sets",
    });
    expect(nonEmptyList.json().items).toHaveLength(1);
    expect(nonEmptyList.json().items[0]).toMatchObject({
      id: existingMapSet.json().id,
      name: "Existing Map Set",
    });
    await nonEmptyServer.close();
  });

  it("serves bounded Coverage for current, Snapshot, and time selections", async () => {
    const server = await buildServer({
      config: await testConfig(),
      providerClient,
      serveWeb: false,
    });
    const created = await server.inject({
      method: "POST",
      url: "/api/map-sets",
      payload: createDefaultMapSetInput(),
    });
    const mapSetId = created.json().id as string;
    await server.inject({
      method: "GET",
      url: `/api/map-sets/${mapSetId}/tiles/3/4/2?refresh=force`,
    });
    const snapshot = await server.inject({
      method: "POST",
      url: `/api/map-sets/${mapSetId}/snapshots`,
      payload: { name: "Coverage API" },
    });
    expect(snapshot.statusCode, snapshot.body).toBe(201);
    expect(snapshot.json()).toHaveProperty("id");
    const bounds = xyzTileBounds({ zoom: 3, x: 4, y: 2 });
    const coverage = await server.inject({
      method: "POST",
      url: `/api/map-sets/${mapSetId}/coverage/query`,
      payload: {
        bounds,
        zoom: 3,
        selection: { kind: "current" },
        compareTo: { kind: "snapshot", snapshotId: snapshot.json().id },
      },
    });

    expect(coverage.statusCode, coverage.body).toBe(200);
    expect(coverage.json()).toMatchObject({
      mapSetId,
      sourceZoom: 3,
      aggregationZoom: 3,
      totals: {
        tileCount: 1,
        revisionCount: 1,
        statuses: { fresh: 1, stale: 0, missing: 0 },
        comparison: { identical: 1, changed: 0, added: 0, missing: 0 },
      },
      cells: [{ id: "3/4/2", tileCount: 1 }],
    });

    const invalidTime = await server.inject({
      method: "POST",
      url: `/api/map-sets/${mapSetId}/coverage/query`,
      payload: {
        bounds,
        zoom: 3,
        selection: { kind: "asOf", timestamp: "not-a-date" },
      },
    });
    expect(invalidTime).toMatchObject({ statusCode: 400 });
    expect(invalidTime.json()).toMatchObject({
      error: { code: "COVERAGE_QUERY_INVALID" },
    });
    await server.close();
  });

  it("writes separate redacted API and provider traffic logs", async () => {
    const config = await testConfig();
    const server = await buildServer({
      config,
      environment: { MAPTOY_TEST_KEY: "provider-secret" },
      providerClient,
      serveWeb: false,
    });
    const input = {
      ...createDefaultMapSetInput(),
      urlTemplate:
        "http://tiles.example.test/{z}/{x}/{y}.png?key=$" + "{MAPTOY_TEST_KEY}",
      headers: { Authorization: "Bearer provider-secret" },
    };

    const health = await server.inject({
      method: "GET",
      url: "/api/health",
      headers: { authorization: "Bearer client-secret" },
    });
    const ready = await server.inject({
      method: "GET",
      url: "/api/ready",
      headers: { authorization: "Bearer readiness-secret" },
    });
    const created = await server.inject({
      method: "POST",
      url: "/api/map-sets",
      payload: input,
    });
    await server.inject({
      method: "POST",
      url: `/api/map-sets/${created.json().id}/test`,
    });
    await server.close();

    const apiLog = await readFile(
      path.join(config.apiTrafficLogDirectory, "api-traffic.log"),
      "utf8",
    );
    const providerLog = await readFile(
      path.join(config.providerTrafficLogDirectory, "provider-traffic.log"),
      "utf8",
    );
    expect(health.statusCode).toBe(200);
    expect(ready.statusCode).toBe(200);
    expect(apiLog).toContain('"event":"api.response"');
    expect(apiLog).toContain('"authorization":"[REDACTED]"');
    expect(apiLog).not.toContain("client-secret");
    expect(apiLog).not.toContain("readiness-secret");
    expect(apiLog).not.toContain('"url":"/api/health"');
    expect(apiLog).toContain('"url":"/api/ready"');
    expect(providerLog).toContain('"event":"provider.response"');
    expect(providerLog).toContain("key=%5BREDACTED%5D");
    expect(providerLog).toContain('"Authorization":"[REDACTED]"');
    expect(providerLog).not.toContain("provider-secret");
  });

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
      items: [{ id: "leaflet-xyz", sdkVersion: "1.1.0" }],
    });
    expect(layerPlugins.json()).toMatchObject({
      items: [
        {
          id: "track-layer",
          sdkVersion: "1.2.0",
          category: { id: "tracks", displayName: "Tracks" },
        },
        {
          id: "image-layer",
          sdkVersion: "1.2.0",
          category: { id: "images", displayName: "Images" },
        },
        {
          id: "tile-grid-layer",
          sdkVersion: "1.2.0",
          category: { id: "decorations", displayName: "Decorations" },
        },
      ],
    });
    await server.close();
  });

  it("manages layers, imports a Track, and scans external images without copying originals", async () => {
    const config = await testConfig();
    const imageRoot = `${config.dataDirectory}-external-photos`;
    await mkdir(imageRoot, { recursive: true });
    temporaryDirectories.push(imageRoot);
    await sharp({
      create: {
        width: 48,
        height: 32,
        channels: 3,
        background: "#336699",
      },
    })
      .jpeg()
      .toFile(path.join(imageRoot, "photo.jpg"));
    await executeFile("exiftool", [
      "-overwrite_original",
      "-GPSLatitude=52.52",
      "-GPSLatitudeRef=N",
      "-GPSLongitude=13.405",
      "-GPSLongitudeRef=E",
      path.join(imageRoot, "photo.jpg"),
    ]);
    const server = await buildServer({
      config: {
        ...config,
        imageRoots: [{ id: "photos", path: imageRoot }],
      },
      providerClient,
      serveWeb: false,
    });

    const imageLayerResponse = await server.inject({
      method: "POST",
      url: "/api/layers",
      payload: {
        name: "Trips / Photos",
        pluginId: "image-layer",
        configuration: {},
        data: {},
        visible: true,
        displayOrder: 0,
        opacity: 1,
        minimumZoom: null,
        maximumZoom: null,
      },
    });
    expect(imageLayerResponse.statusCode, imageLayerResponse.body).toBe(201);
    expect(imageLayerResponse.json().name).toBe("Trips/Photos");
    const imageLayerId = imageLayerResponse.json().id as string;
    expect(
      (
        await server.inject({
          method: "GET",
          url: "/api/image-roots",
        })
      ).json(),
    ).toEqual({ items: [{ id: "photos", available: true }] });

    const scanResponse = await server.inject({
      method: "POST",
      url: `/api/layers/${imageLayerId}/image-scan-jobs`,
      payload: {
        rootId: "photos",
        relativeDirectory: "",
        recursive: true,
      },
    });
    expect(scanResponse.statusCode, scanResponse.body).toBe(201);
    const jobId = scanResponse.json().id as string;
    await vi.waitFor(
      async () => {
        const response = await server.inject({
          method: "GET",
          url: `/api/jobs/${jobId}`,
        });
        expect(response.json()).toMatchObject({
          status: "completed",
          summary: { created: 1 },
        });
      },
      { timeout: 5000 },
    );
    const assetsResponse = await server.inject({
      method: "GET",
      url: `/api/layers/${imageLayerId}/assets`,
    });
    expect(assetsResponse.statusCode, assetsResponse.body).toBe(200);
    expect(assetsResponse.json()).toMatchObject({
      items: [
        {
          kind: "external-image",
          status: "ready",
          fileName: "photo.jpg",
          coordinateSource: "exif",
          longitude: 13.405,
          latitude: 52.52,
          previewAvailable: true,
        },
      ],
    });
    const imageAssetId = assetsResponse.json().items[0].id as string;
    const preview = await server.inject({
      method: "GET",
      url: `/api/layers/${imageLayerId}/assets/${imageAssetId}`,
    });
    expect(preview.statusCode).toBe(200);
    expect(preview.headers["content-type"]).toBe("image/webp");
    await expect(
      readFile(path.join(config.dataDirectory, "photo.jpg")),
    ).rejects.toThrow();
    const manualPosition = await server.inject({
      method: "PATCH",
      url: `/api/layers/${imageLayerId}/assets/${imageAssetId}`,
      payload: {
        longitude: 13.405,
        latitude: 52.52,
        bounds: null,
      },
    });
    expect(manualPosition.json()).toMatchObject({
      coordinateSource: "manual",
      longitude: 13.405,
      latitude: 52.52,
    });
    const repeatedScan = await server.inject({
      method: "POST",
      url: `/api/layers/${imageLayerId}/image-scan-jobs`,
      payload: {
        rootId: "photos",
        relativeDirectory: "",
        recursive: true,
      },
    });
    const repeatedJobId = repeatedScan.json().id as string;
    await vi.waitFor(async () => {
      const response = await server.inject({
        method: "GET",
        url: `/api/jobs/${repeatedJobId}`,
      });
      expect(response.json()).toMatchObject({
        status: "completed",
        skipped: 1,
        summary: { unchanged: 1 },
      });
    });
    expect(
      (
        await server.inject({
          method: "GET",
          url: `/api/layers/${imageLayerId}/assets`,
        })
      ).json().items[0],
    ).toMatchObject({ coordinateSource: "manual", longitude: 13.405 });

    const removedPosition = await server.inject({
      method: "PATCH",
      url: `/api/layers/${imageLayerId}/assets/${imageAssetId}`,
      payload: { longitude: null, latitude: null, bounds: null },
    });
    expect(removedPosition.json()).toMatchObject({
      coordinateSource: "none",
      longitude: null,
      latitude: null,
    });
    await sharp({
      create: {
        width: 49,
        height: 32,
        channels: 3,
        background: "#663399",
      },
    })
      .jpeg()
      .toFile(path.join(imageRoot, "photo.jpg"));
    const changedScan = await server.inject({
      method: "POST",
      url: `/api/layers/${imageLayerId}/image-scan-jobs`,
      payload: {
        rootId: "photos",
        relativeDirectory: "",
        recursive: true,
      },
    });
    const changedJobId = changedScan.json().id as string;
    await vi.waitFor(async () => {
      const response = await server.inject({
        method: "GET",
        url: `/api/jobs/${changedJobId}`,
      });
      expect(response.json()).toMatchObject({
        status: "completed",
        completed: 1,
        summary: { changed: 1 },
      });
    });
    expect(
      (
        await server.inject({
          method: "GET",
          url: `/api/layers/${imageLayerId}/assets`,
        })
      ).json().items[0],
    ).toMatchObject({
      coordinateSource: "none",
      longitude: null,
      latitude: null,
      width: 49,
    });

    await unlink(path.join(imageRoot, "photo.jpg"));
    const missingScan = await server.inject({
      method: "POST",
      url: `/api/layers/${imageLayerId}/image-scan-jobs`,
      payload: {
        rootId: "photos",
        relativeDirectory: "",
        recursive: true,
      },
    });
    const missingJobId = missingScan.json().id as string;
    await vi.waitFor(async () => {
      const response = await server.inject({
        method: "GET",
        url: `/api/jobs/${missingJobId}`,
      });
      expect(response.json()).toMatchObject({
        status: "completed",
        summary: { missing: 1 },
      });
    });
    expect(
      (
        await server.inject({
          method: "GET",
          url: `/api/layers/${imageLayerId}/assets`,
        })
      ).json().items[0],
    ).toMatchObject({ status: "missing", coordinateSource: "none" });
    expect(
      (
        await server.inject({
          method: "GET",
          url: `/api/layers/${imageLayerId}/assets/${imageAssetId}`,
        })
      ).statusCode,
    ).toBe(200);

    const trackLayerResponse = await server.inject({
      method: "POST",
      url: "/api/layers",
      payload: {
        name: "Trips/Track",
        pluginId: "track-layer",
        configuration: {},
        data: { features: [] },
        visible: true,
        displayOrder: 1,
        opacity: 1,
        minimumZoom: null,
        maximumZoom: null,
      },
    });
    expect(trackLayerResponse.statusCode, trackLayerResponse.body).toBe(201);
    expect(trackLayerResponse.json().name).toBe("Trips/Track");
    const trackLayerId = trackLayerResponse.json().id as string;
    const boundary = "maptoy-track-boundary";
    const geoJson = JSON.stringify({
      type: "LineString",
      coordinates: [
        [13.4, 52.5],
        [13.5, 52.6],
      ],
    });
    const multipartBody = Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="track.geojson"\r\nContent-Type: application/geo+json\r\n\r\n${geoJson}\r\n--${boundary}--\r\n`,
    );
    const upload = await server.inject({
      method: "POST",
      url: `/api/layers/${trackLayerId}/assets`,
      headers: {
        "content-type": `multipart/form-data; boundary=${boundary}`,
      },
      payload: multipartBody,
    });
    expect(upload.statusCode, upload.body).toBe(201);
    expect(upload.json().layer.data.features).toHaveLength(1);
    expect(upload.json().asset).toMatchObject({
      kind: "managed",
      fileName: "track.geojson",
      status: "ready",
    });
    const managedAsset = await server.inject({
      method: "GET",
      url: `/api/layers/${trackLayerId}/assets/${upload.json().asset.id}`,
    });
    expect(managedAsset.statusCode).toBe(200);
    expect(managedAsset.headers["content-type"]).toBe("application/geo+json");
    expect(managedAsset.body).toBe(geoJson);

    expect(
      (
        await server.inject({
          method: "GET",
          url: "/api/layers",
        })
      ).json(),
    ).toMatchObject({
      items: [
        { id: imageLayerId, name: "Trips/Photos" },
        { id: trackLayerId, name: "Trips/Track" },
      ],
    });
    expect(
      (
        await server.inject({
          method: "POST",
          url: "/api/layers",
          payload: {
            name: "Trips//Broken",
            pluginId: "track-layer",
            configuration: {},
            data: { features: [] },
            visible: true,
            displayOrder: 2,
            opacity: 1,
            minimumZoom: null,
            maximumZoom: null,
          },
        })
      ).statusCode,
    ).toBe(400);

    expect(
      (
        await server.inject({
          method: "DELETE",
          url: `/api/layers/${trackLayerId}`,
        })
      ).statusCode,
    ).toBe(204);
    expect(
      await readdir(
        path.join(config.dataDirectory, "layer-assets", trackLayerId),
      ),
    ).toEqual([]);
    expect(
      (
        await server.inject({
          method: "DELETE",
          url: `/api/layers/${imageLayerId}`,
        })
      ).statusCode,
    ).toBe(204);
    expect(
      await readdir(path.join(config.dataDirectory, "layer-previews")),
    ).toEqual([]);

    await server.close();
  });

  it.each(["apiTrafficLogDirectory", "providerTrafficLogDirectory"] as const)(
    "reports not-ready when %s is no longer writable",
    async (key) => {
      const config = await testConfig();
      const server = await buildServer({ config, serveWeb: false });
      const directory = config[key];
      await rename(directory, `${directory}-moved`);
      await writeFile(directory, "blocks directory recreation");

      const ready = await server.inject({ method: "GET", url: "/api/ready" });

      expect(ready.statusCode).toBe(503);
      expect(ready.json()).toEqual({ status: "not-ready" });
      await server.close();
    },
  );

  it("creates, updates, tests, persists, and deletes Map Sets", async () => {
    const config = await testConfig();
    const server = await buildServer({
      config,
      environment: { MAPTOY_TEST_KEY: "secret-value" },
      providerClient,
      serveWeb: false,
    });
    const seededMapSets = await server.inject({
      method: "GET",
      url: "/api/map-sets",
    });
    await server.inject({
      method: "DELETE",
      url: `/api/map-sets/${seededMapSets.json().items[0].id}`,
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

    const emptyMapSetList = await server.inject({
      method: "GET",
      url: "/api/map-sets",
    });
    expect(emptyMapSetList.json()).toMatchObject({
      items: [{ id: mapSet.id, logicalTileCount: 0 }],
    });

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

    const uncachedTile = await server.inject({
      method: "GET",
      url: `/api/map-sets/${mapSet.id}/tiles/10/549/335?refresh=cache-only&displayGeneration=1`,
    });
    expect(uncachedTile.statusCode).toBe(200);
    expect(uncachedTile.headers["content-type"]).toContain("image/png");
    expect(uncachedTile.headers["cache-control"]).toBe("no-store");
    expect(uncachedTile.headers["x-maptoy-cache"]).toBe("miss");
    await expect(
      sharp(uncachedTile.rawPayload).metadata(),
    ).resolves.toMatchObject({
      format: "png",
      width: 256,
      height: 256,
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

    const populatedMapSetList = await server.inject({
      method: "GET",
      url: "/api/map-sets",
    });
    expect(populatedMapSetList.json()).toMatchObject({
      items: [{ id: mapSet.id, logicalTileCount: 1 }],
    });

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
    const overviewStats = await server.inject({
      method: "GET",
      url: "/api/cache/stats",
    });
    expect(overviewStats.statusCode).toBe(200);
    expect(overviewStats.json()).toMatchObject({
      mapSetCount: 1,
      populatedMapSetCount: 1,
      stats: {
        logicalTileCount: 1,
        currentRevisionCount: 1,
        snapshotCount: 1,
        totalStorageBytes: validPng.byteLength,
        zoomLevels: [{ zoom: 10, logicalTileCount: 1 }],
      },
      mapSets: [
        {
          mapSetId: mapSet.id,
          logicalTileCount: 1,
          currentRevisionCount: 1,
          snapshotCount: 1,
        },
      ],
    });
    const overviewAudit = await server.inject({
      method: "POST",
      url: "/api/cache/audit",
    });
    expect(overviewAudit.statusCode).toBe(200);
    expect(overviewAudit.json()).toMatchObject({
      totals: {
        scannedFileCount: 1,
        missingFileCount: 0,
        orphanFileCount: 0,
      },
      mapSets: [
        {
          mapSetId: mapSet.id,
          scannedFileCount: 1,
          missingFileCount: 0,
          orphanFileCount: 0,
        },
      ],
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

  it("accepts bounded raw Tile uploads and exposes their revision origin", async () => {
    const config = await testConfig();
    config.maximumTileBytes = 1024;
    const requestProvider = vi.fn(async () => ({
      statusCode: 200,
      headers: { "content-type": "image/png" },
      body: Buffer.concat([validPng, Buffer.from("provider")]),
    }));
    const server = await buildServer({
      config,
      providerClient: { request: requestProvider },
      serveWeb: false,
    });
    const createdMapSet = await server.inject({
      method: "POST",
      url: "/api/map-sets",
      payload: {
        ...createDefaultMapSetInput(),
        urlTemplate: "http://tiles.example.test/{z}/{x}/{y}.png",
      },
    });
    const mapSetId = createdMapSet.json().id as string;
    const tileUrl = `/api/map-sets/${mapSetId}/tiles/2/2/1`;

    const seeded = await server.inject({
      method: "POST",
      url: tileUrl,
      headers: { "content-type": "image/png" },
      payload: validPng,
    });
    expect(seeded.statusCode).toBe(201);
    expect(seeded.json()).toMatchObject({ created: true });
    expect(seeded.headers["x-maptoy-tile-revision"]).toBe(
      seeded.json().revisionId,
    );

    const lockedSource = await server.inject({
      method: "PATCH",
      url: `/api/map-sets/${mapSetId}`,
      payload: {
        urlTemplate: "http://other.example.test/{z}/{x}/{y}.png",
      },
    });
    expect(lockedSource).toMatchObject({ statusCode: 409 });
    expect(lockedSource.json()).toMatchObject({
      error: { code: "MAP_SET_SOURCE_LOCKED" },
    });

    const normalRead = await server.inject({ method: "GET", url: tileUrl });
    const cacheOnlyRead = await server.inject({
      method: "GET",
      url: `${tileUrl}?refresh=cache-only`,
    });
    expect(normalRead.rawPayload).toEqual(validPng);
    expect(cacheOnlyRead.rawPayload).toEqual(validPng);
    expect(requestProvider).not.toHaveBeenCalled();

    const identical = await server.inject({
      method: "POST",
      url: tileUrl,
      headers: { "content-type": "image/png" },
      payload: validPng,
    });
    expect(identical.statusCode).toBe(200);
    expect(identical.json()).toEqual({
      revisionId: seeded.json().revisionId,
      created: false,
    });

    const wrongMediaType = await server.inject({
      method: "POST",
      url: `/api/map-sets/${mapSetId}/tiles/2/2/2`,
      headers: { "content-type": "image/jpeg" },
      payload: validPng,
    });
    expect(wrongMediaType).toMatchObject({ statusCode: 415 });
    expect(wrongMediaType.json()).toMatchObject({
      error: { code: "TILE_MEDIA_TYPE_INVALID" },
    });

    const invalidContent = await server.inject({
      method: "POST",
      url: `/api/map-sets/${mapSetId}/tiles/2/2/2`,
      headers: { "content-type": "image/png" },
      payload: Buffer.alloc(validPng.byteLength),
    });
    expect(invalidContent).toMatchObject({ statusCode: 400 });
    expect(invalidContent.json()).toMatchObject({
      error: { code: "TILE_CONTENT_INVALID" },
    });

    const mismatchedFormat = await server.inject({
      method: "POST",
      url: `/api/map-sets/${mapSetId}/tiles/2/2/2`,
      headers: { "content-type": "image/png" },
      payload: jpeg,
    });
    expect(mismatchedFormat).toMatchObject({ statusCode: 400 });
    expect(mismatchedFormat.json()).toMatchObject({
      error: { code: "TILE_CONTENT_INVALID" },
    });

    const wrongDimensions = await server.inject({
      method: "POST",
      url: `/api/map-sets/${mapSetId}/tiles/2/2/2`,
      headers: { "content-type": "image/png" },
      payload: wrongSizePng,
    });
    expect(wrongDimensions).toMatchObject({ statusCode: 400 });
    expect(wrongDimensions.json()).toMatchObject({
      error: { code: "TILE_CONTENT_INVALID" },
    });

    const corruptImage = await server.inject({
      method: "POST",
      url: `/api/map-sets/${mapSetId}/tiles/2/2/2`,
      headers: { "content-type": "image/png" },
      payload: validPng.subarray(0, 80),
    });
    expect(corruptImage).toMatchObject({ statusCode: 400 });
    expect(corruptImage.json()).toMatchObject({
      error: { code: "TILE_CONTENT_INVALID" },
    });

    const emptyContent = await server.inject({
      method: "POST",
      url: `/api/map-sets/${mapSetId}/tiles/2/2/2`,
      headers: { "content-type": "image/png" },
      payload: Buffer.alloc(0),
    });
    expect(emptyContent).toMatchObject({ statusCode: 400 });
    expect(emptyContent.json()).toMatchObject({
      error: { code: "TILE_CONTENT_INVALID" },
    });

    const tooLarge = await server.inject({
      method: "POST",
      url: `/api/map-sets/${mapSetId}/tiles/2/2/2`,
      headers: { "content-type": "image/png" },
      payload: Buffer.alloc(config.maximumTileBytes + 1),
    });
    expect(tooLarge).toMatchObject({ statusCode: 413 });
    expect(tooLarge.json()).toMatchObject({
      error: { code: "TILE_BODY_TOO_LARGE" },
    });

    const revisions = await server.inject({
      method: "GET",
      url: `/api/map-sets/${mapSetId}/tile-revisions`,
    });
    expect(revisions.json()).toMatchObject({
      total: 1,
      items: [{ id: seeded.json().revisionId, origin: "upload" }],
    });

    const constrained = await server.inject({
      method: "PATCH",
      url: `/api/map-sets/${mapSetId}`,
      payload: {
        cachePolicy: {
          enabled: true,
          maximumAgeSeconds: 604_800,
          maximumStorageBytes: 1,
        },
      },
    });
    expect(constrained.statusCode).toBe(200);
    const storageLimited = await server.inject({
      method: "POST",
      url: `/api/map-sets/${mapSetId}/tiles/2/2/2`,
      headers: { "content-type": "image/png" },
      payload: validPng,
    });
    expect(storageLimited).toMatchObject({ statusCode: 507 });
    expect(storageLimited.json()).toMatchObject({
      error: { code: "TILE_STORAGE_LIMIT" },
    });
    const unchangedStats = await server.inject({
      method: "GET",
      url: `/api/map-sets/${mapSetId}/cache/stats`,
    });
    expect(unchangedStats.json()).toMatchObject({
      logicalTileCount: 1,
      totalRevisionCount: 1,
      totalStorageBytes: validPng.byteLength,
    });

    const narrowedZoomRange = await server.inject({
      method: "PATCH",
      url: `/api/map-sets/${mapSetId}`,
      payload: { minZoom: 3 },
    });
    expect(narrowedZoomRange.statusCode).toBe(200);
    const unsupportedZoomInfo = await server.inject({
      method: "GET",
      url: `/api/map-sets/${mapSetId}/cache/unsupported-zoom-levels`,
    });
    expect(unsupportedZoomInfo.statusCode).toBe(200);
    expect(unsupportedZoomInfo.json()).toMatchObject({
      zoomLevels: [2],
      logicalTileCount: 1,
      revisionCount: 1,
      deletableLogicalTileCount: 1,
      snapshotProtectedLogicalTileCount: 0,
      indexedStorageBytes: validPng.byteLength,
    });
    const unsupportedZoomCleanup = await server.inject({
      method: "DELETE",
      url: `/api/map-sets/${mapSetId}/cache/unsupported-zoom-levels`,
    });
    expect(unsupportedZoomCleanup.statusCode).toBe(200);
    expect(unsupportedZoomCleanup.json()).toMatchObject({
      removedLogicalTileCount: 1,
      removedRevisionCount: 1,
      removedFileCount: 1,
      removedIndexedStorageBytes: validPng.byteLength,
      remaining: { logicalTileCount: 0, zoomLevels: [] },
    });

    const disabledMapSet = await server.inject({
      method: "POST",
      url: "/api/map-sets",
      payload: {
        ...createDefaultMapSetInput(),
        urlTemplate: "http://tiles.example.test/{z}/{x}/{y}.png",
        cachePolicy: {
          enabled: false,
          maximumAgeSeconds: 60,
          maximumStorageBytes: null,
        },
      },
    });
    const archiveDisabled = await server.inject({
      method: "POST",
      url: `/api/map-sets/${disabledMapSet.json().id}/tiles/2/2/1`,
      headers: { "content-type": "image/png" },
      payload: validPng,
    });
    expect(archiveDisabled).toMatchObject({ statusCode: 409 });
    expect(archiveDisabled.json()).toMatchObject({
      error: { code: "TILE_ARCHIVE_DISABLED" },
    });

    await server.close();
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
