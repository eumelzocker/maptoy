import type { ExtensionConfig } from "./types.js";
import { DEFAULT_MAX_RESPONSE_BYTES } from "./response.js";

const STORAGE_KEY = "config";

export const DEFAULT_CONFIG: ExtensionConfig = {
  enabled: true,
  logging: false,
  maxResponseBytes: DEFAULT_MAX_RESPONSE_BYTES,
  rules: [],
};

export async function loadConfig(): Promise<ExtensionConfig> {
  const stored = await browser.storage.local.get(STORAGE_KEY);
  const config = stored[STORAGE_KEY] as ExtensionConfig | undefined;
  return config === undefined
    ? DEFAULT_CONFIG
    : { ...DEFAULT_CONFIG, ...config };
}

export async function saveConfig(config: ExtensionConfig): Promise<void> {
  await browser.storage.local.set({ [STORAGE_KEY]: config });
}
