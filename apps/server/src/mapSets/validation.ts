import { isIP } from "node:net";
import type { MapSetInput } from "@maptoy/contracts";

const secretReferencePattern = /\$\{([^}]+)\}/g;
const validSecretNamePattern = /^MAPTOY_[A-Z0-9_]+$/;
const templatePlaceholders = new Set(["z", "x", "y", "s"]);
const blockedHeaders = new Set([
  "connection",
  "content-length",
  "cookie",
  "host",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

export class MapSetValidationError extends Error {
  readonly code = "MAP_SET_INVALID";
  readonly statusCode = 400;

  constructor(message: string) {
    super(message);
    this.name = "MapSetValidationError";
  }
}

export function isPrivateOrLocalAddress(address: string): boolean {
  const unwrapped =
    address.startsWith("[") && address.endsWith("]")
      ? address.slice(1, -1)
      : address;
  if (isIP(unwrapped) === 4) {
    const octets = unwrapped.split(".").map(Number);
    const first = octets[0] ?? -1;
    const second = octets[1] ?? -1;
    return (
      first === 0 ||
      first === 10 ||
      first === 127 ||
      (first === 100 && second >= 64 && second <= 127) ||
      (first === 169 && second === 254) ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 168)
    );
  }
  if (isIP(unwrapped) === 6) {
    const normalized = unwrapped.toLowerCase();
    if (normalized === "::" || normalized === "::1") {
      return true;
    }
    if (normalized.startsWith("fc") || normalized.startsWith("fd")) {
      return true;
    }
    if (/^fe[89ab]/.test(normalized)) {
      return true;
    }
    const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
    if (mapped !== undefined) {
      return isPrivateOrLocalAddress(mapped);
    }
    const mappedHex = normalized.match(
      /^(?:::ffff:|0:0:0:0:0:ffff:)([0-9a-f]{1,4}):([0-9a-f]{1,4})$/,
    );
    if (mappedHex !== null) {
      const high = Number.parseInt(mappedHex[1] ?? "0", 16);
      const low = Number.parseInt(mappedHex[2] ?? "0", 16);
      return isPrivateOrLocalAddress(
        `${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`,
      );
    }
  }
  return false;
}

export function secretReferences(value: string): string[] {
  return [...value.matchAll(secretReferencePattern)].map(
    (match) => match[1] ?? "",
  );
}

function validateSecretReferences(
  value: string,
  environment: NodeJS.ProcessEnv,
): void {
  const references = secretReferences(value);
  if (value.includes("${") && references.length === 0) {
    throw new MapSetValidationError("A secret reference is malformed.");
  }
  for (const name of references) {
    if (!validSecretNamePattern.test(name)) {
      throw new MapSetValidationError(
        "Secret references must use MAPTOY_* environment variable names.",
      );
    }
    if (environment[name]?.length === 0 || environment[name] === undefined) {
      throw new MapSetValidationError(
        `The referenced provider secret ${name} is not configured.`,
      );
    }
  }
}

export function resolveSecretReferences(
  value: string,
  environment: NodeJS.ProcessEnv,
): string {
  validateSecretReferences(value, environment);
  return value.replace(secretReferencePattern, (_reference, name: string) => {
    const resolved = environment[name];
    if (resolved === undefined) {
      throw new MapSetValidationError("A provider secret is not configured.");
    }
    return resolved;
  });
}

function templateUrl(urlTemplate: string): URL {
  const templateWithoutSecrets = urlTemplate.replace(
    secretReferencePattern,
    "secret",
  );
  const placeholderNames = [
    ...templateWithoutSecrets.matchAll(/\{([^}]+)\}/g),
  ].map((match) => match[1] ?? "");
  if (
    !placeholderNames.includes("z") ||
    !placeholderNames.includes("x") ||
    !placeholderNames.includes("y")
  ) {
    throw new MapSetValidationError(
      "The URL template must contain {z}, {x}, and {y}.",
    );
  }
  const unknown = placeholderNames.find(
    (placeholder) => !templatePlaceholders.has(placeholder),
  );
  if (unknown !== undefined) {
    throw new MapSetValidationError(`Unknown URL placeholder {${unknown}}.`);
  }
  const candidate = templateWithoutSecrets
    .replaceAll("{z}", "0")
    .replaceAll("{x}", "0")
    .replaceAll("{y}", "0")
    .replaceAll("{s}", "a");
  try {
    return new URL(candidate);
  } catch {
    throw new MapSetValidationError(
      "The tile URL template is not a valid URL.",
    );
  }
}

export function validateMapSetSemantics(
  input: MapSetInput,
  options: {
    allowPrivateTileHosts: boolean;
    environment: NodeJS.ProcessEnv;
    rendererExists: (id: string) => boolean;
  },
): void {
  if (input.minZoom > input.maxZoom) {
    throw new MapSetValidationError(
      "Minimum zoom must not exceed maximum zoom.",
    );
  }
  if (input.defaultZoom < input.minZoom || input.defaultZoom > input.maxZoom) {
    throw new MapSetValidationError(
      "Default zoom must be between minimum and maximum zoom.",
    );
  }
  if (!options.rendererExists(input.rendererId)) {
    throw new MapSetValidationError(
      `Renderer adapter ${input.rendererId} is not registered.`,
    );
  }

  validateSecretReferences(input.urlTemplate, options.environment);
  const parsed = templateUrl(input.urlTemplate);
  const allowedProtocols = options.allowPrivateTileHosts
    ? new Set(["http:", "https:"])
    : new Set(["https:"]);
  if (!allowedProtocols.has(parsed.protocol)) {
    throw new MapSetValidationError(
      options.allowPrivateTileHosts
        ? "Tile URLs must use HTTP or HTTPS."
        : "Tile URLs must use HTTPS unless private tile hosts are explicitly enabled.",
    );
  }
  if (parsed.username !== "" || parsed.password !== "") {
    throw new MapSetValidationError(
      "Tile URL credentials must use environment references instead of URL user information.",
    );
  }
  if (parsed.hash !== "") {
    throw new MapSetValidationError(
      "Tile URL templates must not contain a fragment.",
    );
  }
  if (
    !options.allowPrivateTileHosts &&
    (parsed.hostname.toLowerCase() === "localhost" ||
      isPrivateOrLocalAddress(parsed.hostname))
  ) {
    throw new MapSetValidationError(
      "Private, local, and link-local tile hosts are disabled.",
    );
  }
  if (input.urlTemplate.includes("{s}") && input.subdomains.length === 0) {
    throw new MapSetValidationError(
      "At least one subdomain is required when the URL uses {s}.",
    );
  }

  for (const [name, value] of Object.entries(input.headers)) {
    const normalizedName = name.toLowerCase();
    if (!/^[!#$%&'*+.^_`|~0-9a-z-]+$/i.test(name)) {
      throw new MapSetValidationError(`Invalid provider header name: ${name}.`);
    }
    if (blockedHeaders.has(normalizedName)) {
      throw new MapSetValidationError(
        `Provider header ${name} is not allowed.`,
      );
    }
    if (value.includes("\r") || value.includes("\n")) {
      throw new MapSetValidationError(
        `Provider header ${name} must not contain line breaks.`,
      );
    }
    validateSecretReferences(value, options.environment);
  }

  if (input.termsUrl !== "") {
    let termsUrl: URL;
    try {
      termsUrl = new URL(input.termsUrl);
    } catch {
      throw new MapSetValidationError("The provider terms URL is not valid.");
    }
    if (termsUrl.protocol !== "https:" && termsUrl.protocol !== "http:") {
      throw new MapSetValidationError(
        "The provider terms URL must use HTTP or HTTPS.",
      );
    }
  }
  if (
    input.termsReviewedAt !== "" &&
    !/^\d{4}-\d{2}-\d{2}$/.test(input.termsReviewedAt)
  ) {
    throw new MapSetValidationError(
      "The terms review date must use YYYY-MM-DD.",
    );
  }
}

export function tileUrl(
  input: MapSetInput,
  coordinate: { zoom: number; x: number; y: number },
  environment: NodeJS.ProcessEnv,
): URL {
  const subdomain =
    input.subdomains[
      Math.abs(coordinate.x + coordinate.y) %
        Math.max(input.subdomains.length, 1)
    ] ?? "";
  return new URL(
    resolveSecretReferences(input.urlTemplate, environment)
      .replaceAll("{z}", String(coordinate.zoom))
      .replaceAll("{x}", String(coordinate.x))
      .replaceAll("{y}", String(coordinate.y))
      .replaceAll("{s}", subdomain),
  );
}

export function providerHeaders(
  input: MapSetInput,
  environment: NodeJS.ProcessEnv,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(input.headers).map(([name, value]) => [
      name,
      resolveSecretReferences(value, environment),
    ]),
  );
}
