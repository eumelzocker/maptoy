import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { MaptoyConfig } from "@maptoy/config";
import { afterEach, describe, expect, it } from "vitest";
import { buildServer } from "./server.js";

const temporaryDirectories: string[] = [];

async function testConfig(): Promise<MaptoyConfig> {
  const dataDirectory = await mkdtemp(
    path.join(tmpdir(), "maptoy-server-test-"),
  );
  temporaryDirectories.push(dataDirectory);
  return {
    host: "127.0.0.1",
    port: 4004,
    dataDirectory,
    logLevel: "silent",
  };
}

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
