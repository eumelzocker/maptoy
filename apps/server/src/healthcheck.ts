import { loadConfig } from "@maptoy/config";

const config = loadConfig();
const response = await fetch(`http://127.0.0.1:${config.port}/api/health`);

if (!response.ok) {
  throw new Error(`Health endpoint returned HTTP ${response.status}.`);
}
