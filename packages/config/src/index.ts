import path from "node:path";

export const DEFAULT_SERVER_HOST = "0.0.0.0";
export const DEFAULT_SERVER_PORT = 4004;
export const DEFAULT_STORAGE_DATA_DIR = ".data";
export const DEFAULT_LOGGING_LEVEL = "info";
export const DEFAULT_LOGGING_TRAFFIC_MAX_BYTES = 10 * 1024 * 1024;
export const DEFAULT_LOGGING_TRAFFIC_MAX_FILES = 5;
export const DEFAULT_TILES_PROVIDER_TIMEOUT_MILLISECONDS = 10_000;
export const DEFAULT_TILES_MAX_BYTES = 10 * 1024 * 1024;
export const DEFAULT_LAYERS_ASSET_MAX_BYTES = 25 * 1024 * 1024;
export const DEFAULT_JOBS_RETENTION_DAYS = 30;
export const DEFAULT_JOBS_ERROR_HISTORY_LIMIT = 100;
export const DEFAULT_PHOTOS_MAX_FILE_BYTES = 100 * 1024 * 1024;
export const DEFAULT_PHOTOS_MAX_DECODED_PIXELS = 100_000_000;
export const DEFAULT_PHOTOS_PREVIEW_MAX_EDGE = 640;
export const DEFAULT_PHOTOS_SCAN_BATCH_SIZE = 100;
export const DEFAULT_PHOTOS_SCAN_CONCURRENCY = 2;
export const DEFAULT_PHOTOS_SCAN_MAX_FILES = 100_000;

const PHOTOS_LIMITS = {
  bytes: 256 * 1024 * 1024,
  pixels: 150_000_000,
  previewEdge: 2048,
  scanBatch: 1000,
  decoderConcurrency: 4,
  scanFiles: 250_000,
} as const;

const JOBS_LIMITS = {
  retentionDays: 3650,
  errorHistory: 1000,
} as const;

export type LogLevel =
  | "fatal"
  | "error"
  | "warn"
  | "info"
  | "debug"
  | "trace"
  | "silent";

export interface MaptoyConfig {
  server: { host: string; port: number };
  storage: { dataDirectory: string; databasePath: string };
  logging: {
    level: LogLevel;
    directory: string;
    trafficMaximumBytes: number;
    trafficMaximumFiles: number;
  };
  tiles: {
    allowPrivateHosts: boolean;
    providerTimeoutMilliseconds: number;
    maximumBytes: number;
  };
  layers: { assetMaximumBytes: number };
  jobs: {
    retentionDays: number;
    errorHistoryLimit: number;
  };
  photos: {
    directory: string | null;
    maximumFileBytes: number;
    maximumDecodedPixels: number;
    previewMaximumEdge: number;
    scanBatchSize: number;
    scanConcurrency: number;
    scanMaximumFiles: number;
  };
}

function parseLogDirectory(
  value: string | undefined,
  dataDirectory: string,
): string {
  const dataDirectoryReference = "$" + "{MAPTOY_STORAGE_DATA_DIR}";
  const configured = value
    ?.trim()
    .replaceAll(dataDirectoryReference, dataDirectory);
  return path.resolve(configured || path.join(dataDirectory, "logs"));
}

function parsePort(value: string | undefined): number {
  if (value === undefined || value === "") {
    return DEFAULT_SERVER_PORT;
  }
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(
      "MAPTOY_SERVER_PORT must be an integer between 1 and 65535.",
    );
  }
  return port;
}

function parseLogLevel(value: string | undefined): LogLevel {
  const logLevel = value?.trim() || DEFAULT_LOGGING_LEVEL;
  if (
    !["fatal", "error", "warn", "info", "debug", "trace", "silent"].includes(
      logLevel,
    )
  ) {
    throw new Error("MAPTOY_LOGGING_LEVEL is invalid.");
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

function parsePhotoDirectory(value: string | undefined): string | null {
  const configured = value?.trim();
  return configured ? path.resolve(configured) : null;
}

export function loadConfig(
  environment: NodeJS.ProcessEnv = process.env,
): MaptoyConfig {
  const host = environment.MAPTOY_SERVER_HOST?.trim() || DEFAULT_SERVER_HOST;
  const dataDirectory = path.resolve(
    environment.MAPTOY_STORAGE_DATA_DIR?.trim() || DEFAULT_STORAGE_DATA_DIR,
  );
  const databasePath = path.join(dataDirectory, "maptoy.sqlite");

  return {
    server: { host, port: parsePort(environment.MAPTOY_SERVER_PORT) },
    storage: { dataDirectory, databasePath },
    logging: {
      level: parseLogLevel(environment.MAPTOY_LOGGING_LEVEL),
      directory: parseLogDirectory(
        environment.MAPTOY_LOGGING_DIR,
        dataDirectory,
      ),
      trafficMaximumBytes: parsePositiveInteger(
        environment.MAPTOY_LOGGING_TRAFFIC_MAX_BYTES,
        DEFAULT_LOGGING_TRAFFIC_MAX_BYTES,
        "MAPTOY_LOGGING_TRAFFIC_MAX_BYTES",
      ),
      trafficMaximumFiles: parsePositiveInteger(
        environment.MAPTOY_LOGGING_TRAFFIC_MAX_FILES,
        DEFAULT_LOGGING_TRAFFIC_MAX_FILES,
        "MAPTOY_LOGGING_TRAFFIC_MAX_FILES",
      ),
    },
    tiles: {
      allowPrivateHosts: parseBoolean(
        environment.MAPTOY_TILES_ALLOW_PRIVATE_HOSTS,
        "MAPTOY_TILES_ALLOW_PRIVATE_HOSTS",
      ),
      providerTimeoutMilliseconds: parsePositiveInteger(
        environment.MAPTOY_TILES_PROVIDER_TIMEOUT_MS,
        DEFAULT_TILES_PROVIDER_TIMEOUT_MILLISECONDS,
        "MAPTOY_TILES_PROVIDER_TIMEOUT_MS",
      ),
      maximumBytes: parsePositiveInteger(
        environment.MAPTOY_TILES_MAX_BYTES,
        DEFAULT_TILES_MAX_BYTES,
        "MAPTOY_TILES_MAX_BYTES",
      ),
    },
    layers: {
      assetMaximumBytes: parsePositiveInteger(
        environment.MAPTOY_LAYERS_ASSET_MAX_BYTES,
        DEFAULT_LAYERS_ASSET_MAX_BYTES,
        "MAPTOY_LAYERS_ASSET_MAX_BYTES",
      ),
    },
    jobs: {
      retentionDays: parseBoundedPositiveInteger(
        environment.MAPTOY_JOBS_RETENTION_DAYS,
        DEFAULT_JOBS_RETENTION_DAYS,
        JOBS_LIMITS.retentionDays,
        "MAPTOY_JOBS_RETENTION_DAYS",
      ),
      errorHistoryLimit: parseBoundedPositiveInteger(
        environment.MAPTOY_JOBS_ERROR_HISTORY_LIMIT,
        DEFAULT_JOBS_ERROR_HISTORY_LIMIT,
        JOBS_LIMITS.errorHistory,
        "MAPTOY_JOBS_ERROR_HISTORY_LIMIT",
      ),
    },
    photos: {
      directory: parsePhotoDirectory(environment.MAPTOY_PHOTOS_DIR),
      maximumFileBytes: parseBoundedPositiveInteger(
        environment.MAPTOY_PHOTOS_MAX_FILE_BYTES,
        DEFAULT_PHOTOS_MAX_FILE_BYTES,
        PHOTOS_LIMITS.bytes,
        "MAPTOY_PHOTOS_MAX_FILE_BYTES",
      ),
      maximumDecodedPixels: parseBoundedPositiveInteger(
        environment.MAPTOY_PHOTOS_MAX_DECODED_PIXELS,
        DEFAULT_PHOTOS_MAX_DECODED_PIXELS,
        PHOTOS_LIMITS.pixels,
        "MAPTOY_PHOTOS_MAX_DECODED_PIXELS",
      ),
      previewMaximumEdge: parseBoundedPositiveInteger(
        environment.MAPTOY_PHOTOS_PREVIEW_MAX_EDGE,
        DEFAULT_PHOTOS_PREVIEW_MAX_EDGE,
        PHOTOS_LIMITS.previewEdge,
        "MAPTOY_PHOTOS_PREVIEW_MAX_EDGE",
      ),
      scanBatchSize: parseBoundedPositiveInteger(
        environment.MAPTOY_PHOTOS_SCAN_BATCH_SIZE,
        DEFAULT_PHOTOS_SCAN_BATCH_SIZE,
        PHOTOS_LIMITS.scanBatch,
        "MAPTOY_PHOTOS_SCAN_BATCH_SIZE",
      ),
      scanConcurrency: parseBoundedPositiveInteger(
        environment.MAPTOY_PHOTOS_SCAN_CONCURRENCY,
        DEFAULT_PHOTOS_SCAN_CONCURRENCY,
        PHOTOS_LIMITS.decoderConcurrency,
        "MAPTOY_PHOTOS_SCAN_CONCURRENCY",
      ),
      scanMaximumFiles: parseBoundedPositiveInteger(
        environment.MAPTOY_PHOTOS_SCAN_MAX_FILES,
        DEFAULT_PHOTOS_SCAN_MAX_FILES,
        PHOTOS_LIMITS.scanFiles,
        "MAPTOY_PHOTOS_SCAN_MAX_FILES",
      ),
    },
  };
}
