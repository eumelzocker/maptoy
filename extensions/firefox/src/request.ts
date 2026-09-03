import { maximumResponseBytes, responseHeaderMapping } from "./response.js";
import { buildTargetUrl, findMatchingRule } from "./rules.js";
import type { ExtensionConfig, RuleConfig } from "./types.js";

export interface ConfiguredRequest {
  maximumBytes: number | null;
  rule: RuleConfig;
  targetUrl: string;
  responseHeaderMapping: Readonly<Record<string, string>>;
}

export async function resolveConfiguredRequest(
  configReady: Promise<ExtensionConfig>,
  sourceUrl: string,
): Promise<ConfiguredRequest | undefined> {
  const config = await configReady;
  if (config.enabled === false) return undefined;

  const rule = findMatchingRule(sourceUrl, config.rules);
  if (rule === undefined) return undefined;
  return {
    maximumBytes: maximumResponseBytes(config, rule),
    rule,
    targetUrl: buildTargetUrl(sourceUrl, rule),
    responseHeaderMapping: responseHeaderMapping(rule),
  };
}
