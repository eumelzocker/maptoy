import type { ExtensionConfig, RuleConfig } from "./types.js";

export const DEFAULT_MAX_RESPONSE_BYTES = 10 * 1024 * 1024;

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
