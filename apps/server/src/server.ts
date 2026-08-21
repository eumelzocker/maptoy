import { randomUUID } from "node:crypto";
import { access, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import fastifyStatic from "@fastify/static";
import { loadConfig, type MaptoyConfig } from "@maptoy/config";
import type { HealthResponse, ReadyResponse } from "@maptoy/contracts";
import Fastify, {
  type FastifyInstance,
  type FastifyServerOptions,
} from "fastify";
import { layerPluginRegistry, mapRendererRegistry } from "./registries.js";

export interface BuildServerOptions {
  config?: MaptoyConfig;
  logger?: FastifyServerOptions["logger"];
  serveWeb?: boolean;
  staticDirectory?: string;
}

function relativeBaseHref(pathname: string): string {
  const segmentCount = pathname.split("/").filter(Boolean).length;
  const routeDepth = pathname.endsWith("/")
    ? segmentCount
    : Math.max(0, segmentCount - 1);
  return routeDepth === 0 ? "./" : "../".repeat(routeDepth);
}

function injectBaseHref(indexHtml: string, basePath: string): string {
  if (!indexHtml.includes("<head>")) {
    throw new Error("The web index does not contain a head element.");
  }
  return indexHtml.replace("<head>", `<head>\n    <base href="${basePath}" />`);
}

async function assertWritableDirectory(directory: string): Promise<void> {
  await mkdir(directory, { recursive: true });
  await access(directory);
  const probePath = path.join(directory, `.maptoy-ready-${randomUUID()}`);
  await writeFile(probePath, "ready", { flag: "wx" });
  await unlink(probePath);
}

function defaultStaticDirectory(): string {
  return path.resolve(import.meta.dirname, "../../web/dist");
}

export async function buildServer(
  options: BuildServerOptions = {},
): Promise<FastifyInstance> {
  const config = options.config ?? loadConfig();
  const server = Fastify({ logger: options.logger ?? false });
  server.get<{ Reply: HealthResponse }>("/api/health", async () => ({
    status: "ok",
  }));

  server.get<{ Reply: ReadyResponse }>(
    "/api/ready",
    async (_request, reply) => {
      try {
        await assertWritableDirectory(config.dataDirectory);
        return { status: "ready" };
      } catch (error) {
        server.log.error({ error }, "Readiness check failed");
        return reply.code(503).send({ status: "not-ready" });
      }
    },
  );

  server.get("/api/map-renderers", async () => ({
    items: mapRendererRegistry.list(),
  }));

  server.get("/api/layer-plugins", async () => ({
    items: layerPluginRegistry.list().map(({ manifest }) => manifest),
  }));

  if (options.serveWeb ?? true) {
    const root = options.staticDirectory ?? defaultStaticDirectory();
    const indexHtml = await readFile(path.join(root, "index.html"), "utf8");

    await server.register(fastifyStatic, {
      root,
      prefix: "/",
      index: false,
      wildcard: false,
    });

    server.setNotFoundHandler((request, reply) => {
      const pathname = new URL(request.url, "http://maptoy.invalid").pathname;
      if (request.method === "GET" && !pathname.startsWith("/api/")) {
        return reply
          .type("text/html; charset=utf-8")
          .send(injectBaseHref(indexHtml, relativeBaseHref(pathname)));
      }
      return reply.code(404).send({ error: "Not Found" });
    });
  }

  return server;
}
