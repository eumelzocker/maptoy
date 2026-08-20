import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { MaptoyConfig } from "@maptoy/config";
import { afterEach, describe, expect, it } from "vitest";
import { buildServer } from "./server.js";

const temporaryDirectories: string[] = [];

async function testConfig(basePath = "/"): Promise<MaptoyConfig> {
  const dataDirectory = await mkdtemp(
    path.join(tmpdir(), "maptoy-server-test-"),
  );
  temporaryDirectories.push(dataDirectory);
  return {
    host: "127.0.0.1",
    port: 3000,
    basePath,
    dataDirectory,
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
  it("serves health, readiness, and public config below the configured base path", async () => {
    const server = await buildServer({
      config: await testConfig("/tools/maptoy"),
      serveWeb: false,
    });

    const health = await server.inject({
      method: "GET",
      url: "/tools/maptoy/api/health",
    });
    const ready = await server.inject({
      method: "GET",
      url: "/tools/maptoy/api/ready",
    });
    const publicConfig = await server.inject({
      method: "GET",
      url: "/tools/maptoy/api/config/public",
    });

    expect(health.statusCode).toBe(200);
    expect(health.json()).toEqual({ status: "ok" });
    expect(ready.statusCode).toBe(200);
    expect(ready.json()).toEqual({ status: "ready" });
    expect(publicConfig.json()).toEqual({ basePath: "/tools/maptoy" });
    await server.close();
  });

  it("injects the base href and keeps unknown API routes as 404 responses", async () => {
    const staticDirectory = fileURLToPath(
      new URL("../../web/dist", import.meta.url),
    );
    await readFile(path.join(staticDirectory, "index.html"));
    const server = await buildServer({
      config: await testConfig("/tools/maptoy"),
      staticDirectory,
    });

    const application = await server.inject({
      method: "GET",
      url: "/tools/maptoy/docs/getting-started",
    });
    const missingApi = await server.inject({
      method: "GET",
      url: "/tools/maptoy/api/missing",
    });

    expect(application.statusCode).toBe(200);
    expect(application.headers["content-type"]).toContain("text/html");
    expect(application.body).toContain('<base href="/tools/maptoy/" />');
    const assetPath = application.body.match(
      /(?:src|href)="\.\/(assets\/[^"]+)"/,
    )?.[1];
    expect(assetPath).toBeDefined();
    const asset = await server.inject({
      method: "GET",
      url: `/tools/maptoy/${assetPath}`,
    });
    expect(asset.statusCode).toBe(200);
    expect(missingApi.statusCode).toBe(404);
    await server.close();
  });
});
