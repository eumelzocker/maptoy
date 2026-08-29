import { randomUUID } from "node:crypto";
import { access, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import fastifyMultipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import { loadConfig, type MaptoyConfig } from "@maptoy/config";
import type { HealthResponse, ReadyResponse } from "@maptoy/contracts";
import Fastify, {
  type FastifyInstance,
  type FastifyServerOptions,
} from "fastify";
import { layerPluginRegistry, mapRendererRegistry } from "./registries.js";
import { openDatabase } from "./database.js";
import { ImageScanService } from "./layers/imageScanner.js";
import {
  ImagePreviewStorage,
  ImageRootResolver,
} from "./layers/imageStorage.js";
import { ManagedAssetService } from "./layers/managedAssets.js";
import { JobRepository, LayerRepository } from "./layers/repository.js";
import { registerLayerRoutes } from "./layers/routes.js";
import { LayerService } from "./layers/service.js";
import { MapSetRepository } from "./mapSets/repository.js";
import { registerMapSetRoutes } from "./mapSets/routes.js";
import { MapSetService } from "./mapSets/service.js";
import { SafeProviderClient, type ProviderClient } from "./providerClient.js";
import { TileArchiveRepository } from "./tiles/repository.js";
import { TileArchiveService } from "./tiles/service.js";
import { TileStorage } from "./tiles/storage.js";
import { RotatingTrafficLog } from "./trafficLog.js";
import {
  registerApiTrafficLogging,
  TrafficLoggingProviderClient,
} from "./trafficLogging.js";

export interface BuildServerOptions {
  config?: MaptoyConfig;
  logger?: FastifyServerOptions["logger"];
  serveWeb?: boolean;
  staticDirectory?: string;
  environment?: NodeJS.ProcessEnv;
  providerClient?: ProviderClient;
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

const configurationEnvironmentNames = new Set([
  "MAPTOY_HOST",
  "MAPTOY_PORT",
  "MAPTOY_DATA_DIR",
  "MAPTOY_LOG_LEVEL",
  "MAPTOY_API_TRAFFIC_LOG_DIR",
  "MAPTOY_PROVIDER_TRAFFIC_LOG_DIR",
  "MAPTOY_TRAFFIC_LOG_MAX_BYTES",
  "MAPTOY_TRAFFIC_LOG_MAX_FILES",
  "MAPTOY_ALLOW_PRIVATE_TILE_HOSTS",
  "MAPTOY_PROVIDER_TIMEOUT_MS",
  "MAPTOY_MAX_TILE_BYTES",
  "MAPTOY_MAX_LAYER_ASSET_BYTES",
  "MAPTOY_IMAGE_ROOTS_JSON",
  "MAPTOY_MAX_IMAGE_BYTES",
  "MAPTOY_MAX_IMAGE_PIXELS",
  "MAPTOY_IMAGE_PREVIEW_MAX_EDGE",
  "MAPTOY_IMAGE_SCAN_BATCH_SIZE",
  "MAPTOY_IMAGE_DECODER_CONCURRENCY",
  "MAPTOY_MAX_IMAGE_SCAN_FILES",
]);

function providerSecretValues(environment: NodeJS.ProcessEnv): string[] {
  return Object.entries(environment)
    .filter(
      ([name, value]) =>
        name.startsWith("MAPTOY_") &&
        !configurationEnvironmentNames.has(name) &&
        value !== undefined &&
        value !== "",
    )
    .map(([, value]) => value as string);
}

export async function buildServer(
  options: BuildServerOptions = {},
): Promise<FastifyInstance> {
  const config = options.config ?? loadConfig();
  const environment = options.environment ?? process.env;
  const server = Fastify({ logger: options.logger ?? false });
  await server.register(fastifyMultipart, {
    limits: {
      files: 1,
      fields: 0,
      fileSize: config.maximumLayerAssetBytes,
    },
  });
  server.addContentTypeParser(
    "*",
    { parseAs: "buffer" },
    (_request, body, done) => done(null, body),
  );
  const trafficLogOptions = {
    maximumBytes: config.trafficLogMaxBytes,
    maximumFiles: config.trafficLogMaxFiles,
    onError: (error: unknown) => {
      server.log.error({ error }, "Traffic log write failed");
    },
  };
  const apiTrafficLog = await RotatingTrafficLog.create({
    ...trafficLogOptions,
    directory: config.apiTrafficLogDirectory,
    filename: "api-traffic.log",
  });
  const providerTrafficLog = await RotatingTrafficLog.create({
    ...trafficLogOptions,
    directory: config.providerTrafficLogDirectory,
    filename: "provider-traffic.log",
  });
  registerApiTrafficLogging(server, apiTrafficLog);
  await mkdir(config.dataDirectory, { recursive: true });
  const database = await openDatabase(config.databasePath);
  const mapSetRepository = new MapSetRepository(database.sqlite);
  const layerRepository = new LayerRepository(database.sqlite);
  const jobRepository = new JobRepository(database.sqlite);
  const tileArchiveRepository = new TileArchiveRepository(database.sqlite);
  const tileArchive = new TileArchiveService(
    tileArchiveRepository,
    new TileStorage(config.dataDirectory),
  );
  await tileArchive.initialize();
  const baseProviderClient =
    options.providerClient ??
    new SafeProviderClient({
      allowPrivateHosts: config.allowPrivateTileHosts,
      timeoutMilliseconds: config.providerTimeoutMilliseconds,
      maximumResponseBytes: config.maximumTileBytes,
    });
  const providerClient = new TrafficLoggingProviderClient(
    baseProviderClient,
    providerTrafficLog,
    providerSecretValues(environment),
  );
  const mapSetService = new MapSetService(
    mapSetRepository,
    mapRendererRegistry,
    providerClient,
    tileArchive,
    {
      allowPrivateTileHosts: config.allowPrivateTileHosts,
      environment,
      maximumTileBytes: config.maximumTileBytes,
    },
  );
  mapSetService.initialize();
  const layerService = new LayerService(layerRepository, layerPluginRegistry);
  await layerService.initialize();
  const imageScanService = new ImageScanService(
    layerService,
    layerRepository,
    jobRepository,
    new ImageRootResolver(config.imageRoots),
    new ImagePreviewStorage(config.dataDirectory, {
      maximumImageBytes: config.maximumImageBytes,
      maximumImagePixels: config.maximumImagePixels,
      previewMaximumEdge: config.imagePreviewMaximumEdge,
    }),
    {
      batchSize: config.imageScanBatchSize,
      decoderConcurrency: config.imageDecoderConcurrency,
      maximumFiles: config.maximumImageScanFiles,
    },
  );
  const managedAssetService = new ManagedAssetService(
    layerService,
    layerPluginRegistry,
    layerRepository,
    config.dataDirectory,
    config.maximumLayerAssetBytes,
  );
  await managedAssetService.initialize();
  await imageScanService.initialize();

  server.addHook("onClose", async () => {
    await imageScanService.shutdown();
    await Promise.all([apiTrafficLog.close(), providerTrafficLog.close()]);
    database.close();
  });

  server.setErrorHandler((error, request, reply) => {
    if (
      error instanceof Error &&
      "code" in error &&
      error.code === "FST_ERR_CTP_BODY_TOO_LARGE" &&
      request.method === "POST" &&
      request.routeOptions.url === "/api/map-sets/:id/tiles/:z/:x/:y"
    ) {
      return reply.code(413).send({
        error: {
          code: "TILE_BODY_TOO_LARGE",
          message: "The upload exceeds MAPTOY_MAX_TILE_BYTES.",
        },
      });
    }
    if (
      error instanceof Error &&
      "validation" in error &&
      error.validation !== undefined
    ) {
      return reply.code(400).send({
        error: {
          code: "REQUEST_INVALID",
          message: error.message,
        },
      });
    }
    if (
      error instanceof Error &&
      "statusCode" in error &&
      typeof error.statusCode === "number" &&
      "code" in error &&
      typeof error.code === "string"
    ) {
      return reply.code(error.statusCode).send({
        error: { code: error.code, message: error.message },
      });
    }
    server.log.error({ error }, "Request failed");
    return reply.code(500).send({
      error: {
        code: "INTERNAL_ERROR",
        message: "The request failed unexpectedly.",
      },
    });
  });
  server.get<{ Reply: HealthResponse }>("/api/health", async () => ({
    status: "ok",
  }));

  server.get<{ Reply: ReadyResponse }>(
    "/api/ready",
    async (_request, reply) => {
      try {
        await Promise.all([
          assertWritableDirectory(config.dataDirectory),
          assertWritableDirectory(config.apiTrafficLogDirectory),
          assertWritableDirectory(config.providerTrafficLogDirectory),
        ]);
        database.assertReady();
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

  registerMapSetRoutes(server, mapSetService, tileArchive, {
    maximumTileBytes: config.maximumTileBytes,
  });
  registerLayerRoutes(
    server,
    layerService,
    imageScanService,
    managedAssetService,
  );

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
