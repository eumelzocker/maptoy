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

  it("does not declare an implicit image volume", async () => {
    const dockerfile = await readFile("Dockerfile", "utf8");

    expect(dockerfile).not.toMatch(/^VOLUME\s/m);
  });
});
