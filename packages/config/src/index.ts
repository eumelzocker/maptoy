import path from "node:path";

export const DEFAULT_HTTP_HOST = "0.0.0.0";
export const DEFAULT_HTTP_PORT = 4004;
export const DEFAULT_DATA_DIR = ".data";
export const DEFAULT_LOG_LEVEL = "info";

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
  logLevel: LogLevel;
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

export function loadConfig(
  environment: NodeJS.ProcessEnv = process.env,
): MaptoyConfig {
  const host = environment.MAPTOY_HOST?.trim() || DEFAULT_HTTP_HOST;
  const dataDirectory = path.resolve(
    environment.MAPTOY_DATA_DIR?.trim() || DEFAULT_DATA_DIR,
  );

  return {
    host,
    port: parsePort(environment.MAPTOY_PORT),
    dataDirectory,
    logLevel: parseLogLevel(environment.MAPTOY_LOG_LEVEL),
  };
}
