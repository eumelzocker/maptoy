import path from "node:path";

export const DEFAULT_HTTP_HOST = "0.0.0.0";
export const DEFAULT_HTTP_PORT = 3000;
export const DEFAULT_BASE_PATH = "/";
export const DEFAULT_DATA_DIRECTORY = ".data";

export interface MaptoyConfig {
  host: string;
  port: number;
  basePath: string;
  dataDirectory: string;
}

export function normalizeBasePath(value: string): string {
  const trimmed = value.trim();
  if (trimmed === "" || trimmed === "/") {
    return "/";
  }

  const withLeadingSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  const normalized = withLeadingSlash.replace(/\/+$/, "");
  const segments = normalized.slice(1).split("/");
  if (
    !/^\/(?:[A-Za-z0-9._~-]+\/)*[A-Za-z0-9._~-]+$/.test(normalized) ||
    segments.some((segment) => segment === "." || segment === "..")
  ) {
    throw new Error(
      "MAPTOY_BASE_PATH must contain only URL-safe path segments.",
    );
  }
  return normalized;
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

export function loadConfig(
  environment: NodeJS.ProcessEnv = process.env,
): MaptoyConfig {
  const host = environment.MAPTOY_HOST?.trim() || DEFAULT_HTTP_HOST;
  const dataDirectory = path.resolve(
    environment.MAPTOY_DATA_DIRECTORY?.trim() || DEFAULT_DATA_DIRECTORY,
  );

  return {
    host,
    port: parsePort(environment.MAPTOY_PORT),
    basePath: normalizeBasePath(
      environment.MAPTOY_BASE_PATH ?? DEFAULT_BASE_PATH,
    ),
    dataDirectory,
  };
}
