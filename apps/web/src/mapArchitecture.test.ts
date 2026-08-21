import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

describe("Map view architecture", () => {
  it("uses the neutral adapter and a relative maptoy tile URL", async () => {
    const source = await readFile(
      fileURLToPath(new URL("./views/MapView.vue", import.meta.url)),
      "utf8",
    );
    expect(source).toContain("MAP_RENDERER_FACTORY_REGISTRY_KEY");
    expect(source).toContain(
      "api/map-sets/$" + "{mapSet.id}/tiles/{z}/{x}/{y}",
    );
    expect(source).not.toMatch(/from ["']leaflet["']/);
    expect(source).not.toContain("https://");
  });
});
