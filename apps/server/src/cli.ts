import process from "node:process";
import { loadConfig } from "@maptoy/config";
import { buildServer } from "./server.js";

try {
  process.loadEnvFile();
} catch (error) {
  if (
    !(error instanceof Error) ||
    !("code" in error) ||
    error.code !== "ENOENT"
  ) {
    throw error;
  }
}

const config = loadConfig();
const server = await buildServer({
  config,
  logger: { level: config.logging.level },
});

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  server.log.info({ signal }, "Shutting down maptoy");
  await server.close();
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

await server.listen({ host: config.server.host, port: config.server.port });
