import type { ExtensionConfig, RuleConfig } from "./types.js";

export const DEFAULT_MAX_RESPONSE_BYTES = 10 * 1024 * 1024;
const HEADER_NAME_PATTERN = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;

export interface ResponseHeader {
  name: string;
  value?: string | undefined;
}

export function responseHeaderMapping(
  rule: RuleConfig,
): Readonly<Record<string, string>> {
  const configured = rule.forwardResponseHeaders;
  if (configured === undefined) return {};
  if (
    configured === null ||
    typeof configured !== "object" ||
    Array.isArray(configured)
  ) {
    throw new Error("forwardResponseHeaders must be an object");
  }
  const mapping: Array<readonly [string, string]> = [];
  const sourceNames = new Set<string>();
  const targetNames = new Set<string>();
  for (const [sourceName, targetName] of Object.entries(configured)) {
    if (!HEADER_NAME_PATTERN.test(sourceName)) {
      throw new Error(`Invalid source response header name: ${sourceName}`);
    }
    if (
      typeof targetName !== "string" ||
      !HEADER_NAME_PATTERN.test(targetName)
    ) {
      throw new Error(`Invalid target request header name: ${targetName}`);
    }
    const normalizedSource = sourceName.toLowerCase();
    const normalizedTarget = targetName.toLowerCase();
    if (sourceNames.has(normalizedSource)) {
      throw new Error(
        `Source response header is mapped more than once: ${sourceName}`,
      );
    }
    if (targetNames.has(normalizedTarget)) {
      throw new Error(
        `Target request header is mapped more than once: ${targetName}`,
      );
    }
    if (normalizedTarget === "content-type") {
      throw new Error(
        "Content-Type is forwarded automatically and cannot be a mapped target header",
      );
    }
    mapping.push([normalizedSource, targetName]);
    sourceNames.add(normalizedSource);
    targetNames.add(normalizedTarget);
  }
  return Object.fromEntries(mapping);
}

export function mappedResponseHeaders(
  headers: readonly ResponseHeader[],
  mapping: Readonly<Record<string, string>>,
): Readonly<Record<string, string>> {
  const forwarded = new Map<string, readonly [string, string]>();
  for (const header of headers) {
    const targetName = mapping[header.name.toLowerCase()];
    if (targetName !== undefined && header.value !== undefined) {
      forwarded.set(targetName.toLowerCase(), [targetName, header.value]);
    }
  }
  return Object.fromEntries(forwarded.values());
}

export function maximumResponseBytes(
  config: ExtensionConfig,
  rule: RuleConfig,
): number | null {
  const maximum =
    rule.maxResponseBytes === undefined
      ? config.maxResponseBytes === undefined
        ? DEFAULT_MAX_RESPONSE_BYTES
        : config.maxResponseBytes
      : rule.maxResponseBytes;

  if (maximum === null) return null;
  if (!Number.isSafeInteger(maximum) || maximum < 1) {
    throw new Error("maxResponseBytes must be a positive integer or null");
  }
  return maximum;
}

export function acceptsResponseStatus(
  statusCode: number | undefined,
  rule: RuleConfig,
): boolean {
  if (statusCode === undefined) return false;
  if (rule.responseStatusCodes === undefined) {
    return statusCode >= 200 && statusCode < 300;
  }
  if (
    rule.responseStatusCodes.some(
      (status) => !Number.isInteger(status) || status < 100 || status > 599,
    )
  ) {
    throw new Error("responseStatusCodes must contain valid HTTP status codes");
  }
  return rule.responseStatusCodes.includes(statusCode);
}

export class ResponseBodyCollector {
  readonly #maximumBytes: number | null;
  #chunks: ArrayBuffer[] = [];
  #receivedBytes = 0;
  #tooLarge = false;

  constructor(maximumBytes: number | null) {
    this.#maximumBytes = maximumBytes;
  }

  add(chunk: ArrayBuffer): void {
    this.#receivedBytes += chunk.byteLength;
    if (
      this.#maximumBytes !== null &&
      this.#receivedBytes > this.#maximumBytes
    ) {
      this.#tooLarge = true;
      this.#chunks = [];
      return;
    }
    if (!this.#tooLarge) this.#chunks.push(chunk);
  }

  get receivedBytes(): number {
    return this.#receivedBytes;
  }

  get tooLarge(): boolean {
    return this.#tooLarge;
  }

  body(): ArrayBuffer | undefined {
    if (this.#tooLarge) return undefined;
    const merged = new Uint8Array(this.#receivedBytes);
    let offset = 0;
    for (const chunk of this.#chunks) {
      merged.set(new Uint8Array(chunk), offset);
      offset += chunk.byteLength;
    }
    return merged.buffer;
  }
}
