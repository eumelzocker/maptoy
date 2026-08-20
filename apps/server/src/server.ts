import { randomUUID } from "node:crypto";
import { access, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import fastifyStatic from "@fastify/static";
import { loadConfig, type MaptoyConfig } from "@maptoy/config";
import type {
  HealthResponse,
  PublicConfig,
  ReadyResponse,
} from "@maptoy/contracts";
import Fastify, {
  type FastifyInstance,
  type FastifyServerOptions,
} from "fastify";

export interface BuildServerOptions {
  config?: MaptoyConfig;
  logger?: FastifyServerOptions["logger"];
  serveWeb?: boolean;
  staticDirectory?: string;
}

function applicationPrefix(basePath: string): string {
  return basePath === "/" ? "" : basePath;
}

function staticPrefix(basePath: string): string {
  return basePath === "/" ? "/" : `${basePath}/`;
}

function injectBaseHref(indexHtml: string, basePath: string): string {
  const baseElement = `<base href="${staticPrefix(basePath)}" />`;
  if (!indexHtml.includes("<head>")) {
    throw new Error("The web index does not contain a head element.");
  }
  return indexHtml.replace("<head>", `<head>\n    ${baseElement}`);
}

async function assertWritableDirectory(directory: string): Promise<void> {
  await mkdir(directory, { recursive: true });
  await access(directory);
  const probePath = path.join(directory, `.maptoy-ready-${randomUUID()}`);
  await writeFile(probePath, "ready", { flag: "wx" });
  await unlink(probePath);
}

function defaultStaticDirectory(): string {
  return path.resolve(import.meta.dirname, "../../web/dist");
}

export async function buildServer(
  options: BuildServerOptions = {},
): Promise<FastifyInstance> {
  const config = options.config ?? loadConfig();
  const server = Fastify({ logger: options.logger ?? false });
  const prefix = applicationPrefix(config.basePath);

  server.get<{ Reply: HealthResponse }>(`${prefix}/api/health`, async () => ({
    status: "ok",
  }));

  server.get<{ Reply: ReadyResponse }>(
    `${prefix}/api/ready`,
    async (_request, reply) => {
      try {
        await assertWritableDirectory(config.dataDirectory);
        return { status: "ready" };
      } catch (error) {
        server.log.error({ error }, "Readiness check failed");
        return reply.code(503).send({ status: "not-ready" });
      }
    },
  );

  server.get<{ Reply: PublicConfig }>(
    `${prefix}/api/config/public`,
    async () => ({
      basePath: config.basePath,
    }),
  );

  if (options.serveWeb ?? true) {
    const root = options.staticDirectory ?? defaultStaticDirectory();
    const indexPath = path.join(root, "index.html");
    const indexHtml = injectBaseHref(
      await readFile(indexPath, "utf8"),
      config.basePath,
    );

    await server.register(fastifyStatic, {
      root,
      prefix: staticPrefix(config.basePath),
      index: false,
      wildcard: false,
    });

    server.setNotFoundHandler((request, reply) => {
      const pathname = new URL(request.url, "http://maptoy.invalid").pathname;
      const apiPrefix = `${prefix}/api/`;
      const insideApplication =
        config.basePath === "/" ||
        pathname === config.basePath ||
        pathname.startsWith(`${config.basePath}/`);

      if (
        request.method === "GET" &&
        insideApplication &&
        !pathname.startsWith(apiPrefix)
      ) {
        return reply.type("text/html; charset=utf-8").send(indexHtml);
      }
      return reply.code(404).send({ error: "Not Found" });
    });
  }

  return server;
}
