import type { IncomingHttpHeaders } from "node:http";
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { ProviderClient, ProviderResponse } from "./providerClient.js";
import type { TrafficLog } from "./trafficLog.js";

const sensitiveHeaderPattern =
  /(authorization|cookie|api[-_]?key|token|secret|signature|credential|session)/i;
const sensitiveQueryPattern =
  /(api[-_]?key|key|access[-_]?token|token|secret|signature|credential|session)/i;

function elapsedMilliseconds(startedAt: bigint): number {
  return Number(process.hrtime.bigint() - startedAt) / 1_000_000;
}

function redactKnownValues(
  value: string,
  redactedValues: readonly string[],
): string {
  let redacted = value;
  for (const secret of redactedValues) {
    redacted = redacted
      .replaceAll(secret, "[REDACTED]")
      .replaceAll(encodeURIComponent(secret), "[REDACTED]");
  }
  return redacted;
}

function sanitizedHeaders(
  headers: Readonly<Record<string, unknown>> | IncomingHttpHeaders,
  redactedValues: readonly string[] = [],
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(headers).map(([name, value]) => {
      if (sensitiveHeaderPattern.test(name)) {
        return [name, "[REDACTED]"];
      }
      if (name.toLowerCase() === "location" && typeof value === "string") {
        return [name, sanitizedUrl(value, redactedValues)];
      }
      if (typeof value === "string") {
        return [name, redactKnownValues(value, redactedValues)];
      }
      if (Array.isArray(value)) {
        return [
          name,
          value.map((item) => redactKnownValues(item, redactedValues)),
        ];
      }
      return [name, value];
    }),
  );
}

function sanitizedUrl(
  value: string | URL,
  redactedValues: readonly string[] = [],
): string {
  const input = redactKnownValues(value.toString(), redactedValues);
  const url = new URL(input, "http://maptoy.invalid");
  if (url.username !== "") {
    url.username = "[REDACTED]";
  }
  if (url.password !== "") {
    url.password = "[REDACTED]";
  }
  for (const name of url.searchParams.keys()) {
    if (sensitiveQueryPattern.test(name)) {
      url.searchParams.set(name, "[REDACTED]");
    }
  }
  return typeof value === "string" && value.startsWith("/")
    ? `${url.pathname}${url.search}${url.hash}`
    : url.toString();
}

function apiRequestDetails(request: FastifyRequest): Record<string, unknown> {
  return {
    id: request.id,
    method: request.method,
    url: sanitizedUrl(request.url),
    route: request.routeOptions.url,
    remoteAddress: request.ip,
    remotePort: request.socket.remotePort,
    httpVersion: request.raw.httpVersion,
    headers: sanitizedHeaders(request.headers),
  };
}

export function registerApiTrafficLogging(
  server: FastifyInstance,
  trafficLog: TrafficLog,
): void {
  const startedAt = new WeakMap<FastifyRequest, bigint>();
  const completed = new WeakSet<FastifyRequest>();

  server.addHook("onRequest", async (request) => {
    if (
      request.routeOptions.url !== "/api/health" &&
      (request.url.startsWith("/api/") || request.url === "/api")
    ) {
      startedAt.set(request, process.hrtime.bigint());
    }
  });

  server.addHook("onResponse", async (request, reply) => {
    const started = startedAt.get(request);
    if (started === undefined) {
      return;
    }
    completed.add(request);
    trafficLog.write({
      event: "api.response",
      request: apiRequestDetails(request),
      response: {
        statusCode: reply.statusCode,
        headers: sanitizedHeaders(reply.getHeaders()),
      },
      durationMilliseconds: elapsedMilliseconds(started),
    });
  });

  server.addHook("onRequestAbort", async (request) => {
    const started = startedAt.get(request);
    if (started === undefined || completed.has(request)) {
      return;
    }
    trafficLog.write({
      event: "api.aborted",
      request: apiRequestDetails(request),
      durationMilliseconds: elapsedMilliseconds(started),
    });
  });
}

export class TrafficLoggingProviderClient implements ProviderClient {
  constructor(
    private readonly providerClient: ProviderClient,
    private readonly trafficLog: TrafficLog,
    private readonly redactedValues: readonly string[] = [],
  ) {}

  async request(
    url: URL,
    headers: Readonly<Record<string, string>>,
  ): Promise<ProviderResponse> {
    const startedAt = process.hrtime.bigint();
    const request = {
      method: "GET",
      url: sanitizedUrl(url, this.redactedValues),
      headers: sanitizedHeaders(headers, this.redactedValues),
    };
    try {
      const response = await this.providerClient.request(url, headers);
      this.trafficLog.write({
        event: "provider.response",
        request,
        response: {
          statusCode: response.statusCode,
          headers: sanitizedHeaders(response.headers, this.redactedValues),
          bodyBytes: response.body.byteLength,
        },
        durationMilliseconds: elapsedMilliseconds(startedAt),
      });
      return response;
    } catch (error) {
      this.trafficLog.write({
        event: "provider.error",
        request,
        error: {
          name: error instanceof Error ? error.name : "UnknownError",
          code:
            error instanceof Error && "code" in error ? error.code : undefined,
          message:
            error instanceof Error
              ? redactKnownValues(error.message, this.redactedValues)
              : "Unknown provider error",
        },
        durationMilliseconds: elapsedMilliseconds(startedAt),
      });
      throw error;
    }
  }
}
