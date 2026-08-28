import path from "node:path";

export const DEFAULT_HTTP_HOST = "0.0.0.0";
export const DEFAULT_HTTP_PORT = 4004;
export const DEFAULT_DATA_DIR = ".data";
export const DEFAULT_LOG_LEVEL = "info";
export const DEFAULT_TRAFFIC_LOG_MAX_BYTES = 10 * 1024 * 1024;
export const DEFAULT_TRAFFIC_LOG_MAX_FILES = 5;
export const DEFAULT_PROVIDER_TIMEOUT_MILLISECONDS = 10_000;
export const DEFAULT_MAX_TILE_BYTES = 10 * 1024 * 1024;
export const DEFAULT_MAX_IMAGE_BYTES = 100 * 1024 * 1024;
export const DEFAULT_MAX_LAYER_ASSET_BYTES = 25 * 1024 * 1024;
export const DEFAULT_MAX_IMAGE_PIXELS = 100_000_000;
export const DEFAULT_IMAGE_PREVIEW_MAX_EDGE = 640;
export const DEFAULT_IMAGE_SCAN_BATCH_SIZE = 100;
export const DEFAULT_IMAGE_DECODER_CONCURRENCY = 2;
export const DEFAULT_MAX_IMAGE_SCAN_FILES = 100_000;

const IMAGE_LIMITS = {
  bytes: 1024 * 1024 * 1024,
  pixels: 500_000_000,
  previewEdge: 4096,
  scanBatch: 10_000,
  decoderConcurrency: 16,
  scanFiles: 1_000_000,
} as const;

export interface ImageRootConfig {
  id: string;
  path: string;
}

export type LogLevel =
  | "fatal"
  | "error"
  | "warn"
  | "info"
  | "debug"
  | "trace"
  | "silent";

export interface MaptoyConfig {
  host: string;
  port: number;
  dataDirectory: string;
  databasePath: string;
  logLevel: LogLevel;
  apiTrafficLogDirectory: string;
  providerTrafficLogDirectory: string;
  trafficLogMaxBytes: number;
  trafficLogMaxFiles: number;
  allowPrivateTileHosts: boolean;
  providerTimeoutMilliseconds: number;
  maximumTileBytes: number;
  maximumLayerAssetBytes: number;
  imageRoots: readonly ImageRootConfig[];
  maximumImageBytes: number;
  maximumImagePixels: number;
  imagePreviewMaximumEdge: number;
  imageScanBatchSize: number;
  imageDecoderConcurrency: number;
  maximumImageScanFiles: number;
}

function parseLogDirectory(
  value: string | undefined,
  dataDirectory: string,
  defaultName: string,
): string {
  const dataDirectoryReference = "$" + "{MAPTOY_DATA_DIR}";
  const configured = value
    ?.trim()
    .replaceAll(dataDirectoryReference, dataDirectory);
  return path.resolve(
    configured || path.join(dataDirectory, "logs", defaultName),
  );
}

function parsePort(value: string | undefined): number {
  if (value === undefined || value === "") {
    return DEFAULT_HTTP_PORT;
  }
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("MAPTOY_PORT must be an integer between 1 and 65535.");
  }
  return port;
}

function parseLogLevel(value: string | undefined): LogLevel {
  const logLevel = value?.trim() || DEFAULT_LOG_LEVEL;
  if (
    !["fatal", "error", "warn", "info", "debug", "trace", "silent"].includes(
      logLevel,
    )
  ) {
    throw new Error("MAPTOY_LOG_LEVEL is invalid.");
  }
  return logLevel as LogLevel;
}

function parseBoolean(value: string | undefined, name: string): boolean {
  if (value === undefined || value === "" || value === "false") {
    return false;
  }
  if (value === "true") {
    return true;
  }
  throw new Error(`${name} must be true or false.`);
}

function parsePositiveInteger(
  value: string | undefined,
  defaultValue: number,
  name: string,
): number {
  if (value === undefined || value === "") {
    return defaultValue;
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return parsed;
}

function parseBoundedPositiveInteger(
  value: string | undefined,
  defaultValue: number,
  maximum: number,
  name: string,
): number {
  const parsed = parsePositiveInteger(value, defaultValue, name);
  if (parsed > maximum) {
    throw new Error(`${name} must not exceed ${maximum}.`);
  }
  return parsed;
}

function parseImageRoots(
  value: string | undefined,
): readonly ImageRootConfig[] {
  if (value === undefined || value.trim() === "") {
    return [];
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error("MAPTOY_IMAGE_ROOTS_JSON must be valid JSON.");
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("MAPTOY_IMAGE_ROOTS_JSON must be a JSON object.");
  }
  return Object.entries(parsed).map(([id, configuredPath]) => {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {
      throw new Error(
        "MAPTOY_IMAGE_ROOTS_JSON keys must be lowercase stable IDs.",
      );
    }
    if (
      typeof configuredPath !== "string" ||
      !path.isAbsolute(configuredPath)
    ) {
      throw new Error(
        `MAPTOY_IMAGE_ROOTS_JSON path for ${id} must be absolute.`,
      );
    }
    return { id, path: path.normalize(configuredPath) };
  });
}

export function loadConfig(
  environment: NodeJS.ProcessEnv = process.env,
): MaptoyConfig {
  const host = environment.MAPTOY_HOST?.trim() || DEFAULT_HTTP_HOST;
  const dataDirectory = path.resolve(
    environment.MAPTOY_DATA_DIR?.trim() || DEFAULT_DATA_DIR,
  );
  const databasePath = path.join(dataDirectory, "maptoy.sqlite");

  return {
    host,
    port: parsePort(environment.MAPTOY_PORT),
    dataDirectory,
    databasePath,
    logLevel: parseLogLevel(environment.MAPTOY_LOG_LEVEL),
    apiTrafficLogDirectory: parseLogDirectory(
      environment.MAPTOY_API_TRAFFIC_LOG_DIR,
      dataDirectory,
      "api",
    ),
    providerTrafficLogDirectory: parseLogDirectory(
      environment.MAPTOY_PROVIDER_TRAFFIC_LOG_DIR,
      dataDirectory,
      "provider",
    ),
    trafficLogMaxBytes: parsePositiveInteger(
      environment.MAPTOY_TRAFFIC_LOG_MAX_BYTES,
      DEFAULT_TRAFFIC_LOG_MAX_BYTES,
      "MAPTOY_TRAFFIC_LOG_MAX_BYTES",
    ),
    trafficLogMaxFiles: parsePositiveInteger(
      environment.MAPTOY_TRAFFIC_LOG_MAX_FILES,
      DEFAULT_TRAFFIC_LOG_MAX_FILES,
      "MAPTOY_TRAFFIC_LOG_MAX_FILES",
    ),
    allowPrivateTileHosts: parseBoolean(
      environment.MAPTOY_ALLOW_PRIVATE_TILE_HOSTS,
      "MAPTOY_ALLOW_PRIVATE_TILE_HOSTS",
    ),
    providerTimeoutMilliseconds: parsePositiveInteger(
      environment.MAPTOY_PROVIDER_TIMEOUT_MS,
      DEFAULT_PROVIDER_TIMEOUT_MILLISECONDS,
      "MAPTOY_PROVIDER_TIMEOUT_MS",
    ),
    maximumTileBytes: parsePositiveInteger(
      environment.MAPTOY_MAX_TILE_BYTES,
      DEFAULT_MAX_TILE_BYTES,
      "MAPTOY_MAX_TILE_BYTES",
    ),
    maximumLayerAssetBytes: parsePositiveInteger(
      environment.MAPTOY_MAX_LAYER_ASSET_BYTES,
      DEFAULT_MAX_LAYER_ASSET_BYTES,
      "MAPTOY_MAX_LAYER_ASSET_BYTES",
    ),
    imageRoots: parseImageRoots(environment.MAPTOY_IMAGE_ROOTS_JSON),
    maximumImageBytes: parseBoundedPositiveInteger(
      environment.MAPTOY_MAX_IMAGE_BYTES,
      DEFAULT_MAX_IMAGE_BYTES,
      IMAGE_LIMITS.bytes,
      "MAPTOY_MAX_IMAGE_BYTES",
    ),
    maximumImagePixels: parseBoundedPositiveInteger(
      environment.MAPTOY_MAX_IMAGE_PIXELS,
      DEFAULT_MAX_IMAGE_PIXELS,
      IMAGE_LIMITS.pixels,
      "MAPTOY_MAX_IMAGE_PIXELS",
    ),
    imagePreviewMaximumEdge: parseBoundedPositiveInteger(
      environment.MAPTOY_IMAGE_PREVIEW_MAX_EDGE,
      DEFAULT_IMAGE_PREVIEW_MAX_EDGE,
      IMAGE_LIMITS.previewEdge,
      "MAPTOY_IMAGE_PREVIEW_MAX_EDGE",
    ),
    imageScanBatchSize: parseBoundedPositiveInteger(
      environment.MAPTOY_IMAGE_SCAN_BATCH_SIZE,
      DEFAULT_IMAGE_SCAN_BATCH_SIZE,
      IMAGE_LIMITS.scanBatch,
      "MAPTOY_IMAGE_SCAN_BATCH_SIZE",
    ),
    imageDecoderConcurrency: parseBoundedPositiveInteger(
      environment.MAPTOY_IMAGE_DECODER_CONCURRENCY,
      DEFAULT_IMAGE_DECODER_CONCURRENCY,
      IMAGE_LIMITS.decoderConcurrency,
      "MAPTOY_IMAGE_DECODER_CONCURRENCY",
    ),
    maximumImageScanFiles: parseBoundedPositiveInteger(
      environment.MAPTOY_MAX_IMAGE_SCAN_FILES,
      DEFAULT_MAX_IMAGE_SCAN_FILES,
      IMAGE_LIMITS.scanFiles,
      "MAPTOY_MAX_IMAGE_SCAN_FILES",
    ),
  };
}
