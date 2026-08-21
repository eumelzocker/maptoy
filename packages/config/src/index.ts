import path from "node:path";

export const DEFAULT_HTTP_HOST = "0.0.0.0";
export const DEFAULT_HTTP_PORT = 4004;
export const DEFAULT_DATA_DIR = ".data";
export const DEFAULT_LOG_LEVEL = "info";
export const DEFAULT_PROVIDER_TIMEOUT_MILLISECONDS = 10_000;
export const DEFAULT_MAX_TILE_BYTES = 10 * 1024 * 1024;

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
  allowPrivateTileHosts: boolean;
  providerTimeoutMilliseconds: number;
  maximumTileBytes: number;
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
  };
}
