import { lookup } from "node:dns/promises";
import type { IncomingHttpHeaders } from "node:http";
import http from "node:http";
import https from "node:https";
import type { LookupFunction } from "node:net";
import { isPrivateOrLocalAddress } from "./mapSets/validation.js";

export interface ProviderResponse {
  statusCode: number;
  headers: IncomingHttpHeaders;
  body: Buffer;
}

export interface ProviderClient {
  request: (
    url: URL,
    headers: Readonly<Record<string, string>>,
  ) => Promise<ProviderResponse>;
}

export class ProviderRequestError extends Error {
  constructor(
    readonly code:
      | "PROVIDER_DNS_FAILED"
      | "PROVIDER_HOST_BLOCKED"
      | "PROVIDER_REDIRECT_INVALID"
      | "PROVIDER_RESPONSE_TOO_LARGE"
      | "PROVIDER_TIMEOUT"
      | "PROVIDER_UNAVAILABLE",
    message: string,
  ) {
    super(message);
    this.name = "ProviderRequestError";
  }
}

export interface NetworkAddress {
  address: string;
  family: 4 | 6;
}

export function createPinnedLookup(
  selectedAddress: NetworkAddress,
): LookupFunction {
  return (_hostname, options, callback) => {
    if (options.all === true) {
      callback(null, [selectedAddress]);
      return;
    }
    callback(null, selectedAddress.address, selectedAddress.family);
  };
}

export class SafeProviderClient implements ProviderClient {
  constructor(
    private readonly options: {
      allowPrivateHosts: boolean;
      timeoutMilliseconds: number;
      maximumResponseBytes: number;
      maximumRedirects?: number;
      resolve?: (hostname: string) => Promise<NetworkAddress[]>;
    },
  ) {}

  async request(
    url: URL,
    headers: Readonly<Record<string, string>>,
  ): Promise<ProviderResponse> {
    return this.requestWithRedirects(url, headers, 0);
  }

  private async resolveHost(hostname: string): Promise<NetworkAddress[]> {
    if (this.options.resolve !== undefined) {
      return this.options.resolve(hostname);
    }
    try {
      return (await lookup(hostname, { all: true, verbatim: true })).map(
        ({ address, family }) => ({ address, family: family as 4 | 6 }),
      );
    } catch {
      throw new ProviderRequestError(
        "PROVIDER_DNS_FAILED",
        "The provider hostname could not be resolved.",
      );
    }
  }

  private async requestWithRedirects(
    url: URL,
    headers: Readonly<Record<string, string>>,
    redirectCount: number,
  ): Promise<ProviderResponse> {
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      throw new ProviderRequestError(
        "PROVIDER_REDIRECT_INVALID",
        "The provider URL uses an unsupported protocol.",
      );
    }
    if (!this.options.allowPrivateHosts && url.protocol !== "https:") {
      throw new ProviderRequestError(
        "PROVIDER_HOST_BLOCKED",
        "Insecure provider URLs are disabled.",
      );
    }

    const addresses = await this.resolveHost(url.hostname);
    if (addresses.length === 0) {
      throw new ProviderRequestError(
        "PROVIDER_DNS_FAILED",
        "The provider hostname has no address.",
      );
    }
    if (
      !this.options.allowPrivateHosts &&
      addresses.some(({ address }) => isPrivateOrLocalAddress(address))
    ) {
      throw new ProviderRequestError(
        "PROVIDER_HOST_BLOCKED",
        "The provider hostname resolves to a private, local, or link-local address.",
      );
    }

    const selectedAddress = addresses[0];
    if (selectedAddress === undefined) {
      throw new ProviderRequestError(
        "PROVIDER_DNS_FAILED",
        "The provider hostname has no address.",
      );
    }
    const response = await this.requestAddress(url, headers, selectedAddress);
    if (
      response.statusCode >= 300 &&
      response.statusCode < 400 &&
      response.headers.location !== undefined
    ) {
      const maximumRedirects = this.options.maximumRedirects ?? 4;
      if (redirectCount >= maximumRedirects) {
        throw new ProviderRequestError(
          "PROVIDER_REDIRECT_INVALID",
          "The provider returned too many redirects.",
        );
      }
      let redirectUrl: URL;
      try {
        redirectUrl = new URL(response.headers.location, url);
      } catch {
        throw new ProviderRequestError(
          "PROVIDER_REDIRECT_INVALID",
          "The provider returned an invalid redirect.",
        );
      }
      const redirectHeaders =
        redirectUrl.origin === url.origin ? headers : Object.freeze({});
      return this.requestWithRedirects(
        redirectUrl,
        redirectHeaders,
        redirectCount + 1,
      );
    }
    return response;
  }

  private requestAddress(
    url: URL,
    headers: Readonly<Record<string, string>>,
    selectedAddress: NetworkAddress,
  ): Promise<ProviderResponse> {
    return new Promise((resolve, reject) => {
      const requestFunction =
        url.protocol === "https:" ? https.request : http.request;
      const request = requestFunction(
        url,
        {
          headers,
          lookup: createPinnedLookup(selectedAddress),
        },
        (response) => {
          const chunks: Buffer[] = [];
          let byteLength = 0;
          response.on("data", (chunk: Buffer) => {
            byteLength += chunk.byteLength;
            if (byteLength > this.options.maximumResponseBytes) {
              request.destroy(
                new ProviderRequestError(
                  "PROVIDER_RESPONSE_TOO_LARGE",
                  "The provider response exceeds the configured tile size limit.",
                ),
              );
              return;
            }
            chunks.push(chunk);
          });
          response.on("end", () => {
            resolve({
              statusCode: response.statusCode ?? 502,
              headers: response.headers,
              body: Buffer.concat(chunks),
            });
          });
        },
      );
      request.setTimeout(this.options.timeoutMilliseconds, () => {
        request.destroy(
          new ProviderRequestError(
            "PROVIDER_TIMEOUT",
            "The provider request timed out.",
          ),
        );
      });
      request.on("error", (error) => {
        reject(
          error instanceof ProviderRequestError
            ? error
            : new ProviderRequestError(
                "PROVIDER_UNAVAILABLE",
                "The provider request failed.",
              ),
        );
      });
      request.end();
    });
  }
}
