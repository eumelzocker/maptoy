import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("container persistence", () => {
  it("uses the configured host directory as a bind mount", async () => {
    const compose = await readFile("compose.yaml", "utf8");
    const hostDataDirectory = "$" + "{MAPTOY_DATA_DIR:-./.data}";

    expect(compose).toContain("type: bind");
    expect(compose).toContain(`source: ${hostDataDirectory}`);
    expect(compose).toContain("target: /data");
    expect(compose).not.toContain("maptoy-data:");
  });

  it("bind-mounts both rotating traffic log directories", async () => {
    const compose = await readFile("compose.yaml", "utf8");
    const apiLogDirectory =
      "$" +
      "{MAPTOY_API_TRAFFIC_LOG_DIR:-$" +
      "{MAPTOY_DATA_DIR:-./.data}/logs/api}";
    const providerLogDirectory =
      "$" +
      "{MAPTOY_PROVIDER_TRAFFIC_LOG_DIR:-$" +
      "{MAPTOY_DATA_DIR:-./.data}/logs/provider}";

    expect(compose).toContain(`source: ${apiLogDirectory}`);
    expect(compose).toContain("target: /logs/api");
    expect(compose).toContain(`source: ${providerLogDirectory}`);
    expect(compose).toContain("target: /logs/provider");
  });

  it("does not declare an implicit image volume", async () => {
    const dockerfile = await readFile("Dockerfile", "utf8");

    expect(dockerfile).not.toMatch(/^VOLUME\s/m);
  });
});
