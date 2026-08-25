import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

describe("Map view architecture", () => {
  it("uses the neutral adapter and a relative maptoy tile URL", async () => {
    const [mapView, tileUrl] = await Promise.all([
      readFile(
        fileURLToPath(new URL("./views/MapView.vue", import.meta.url)),
        "utf8",
      ),
      readFile(
        fileURLToPath(new URL("./mapTileUrl.ts", import.meta.url)),
        "utf8",
      ),
    ]);
    expect(mapView).toContain("MAP_RENDERER_FACTORY_REGISTRY_KEY");
    expect(mapView).toContain("mapTileUrl");
    expect(tileUrl).toContain(
      "api/map-sets/$" + "{mapSetId}/tiles/{z}/{x}/{y}",
    );
    expect(mapView).not.toMatch(/from ["']leaflet["']/);
    expect(mapView).not.toContain("https://");
    expect(tileUrl).not.toContain("https://");
  });

  it("delegates generic context-menu overlay behavior to AppContextMenu", async () => {
    const mapView = await readFile(
      fileURLToPath(new URL("./views/MapView.vue", import.meta.url)),
      "utf8",
    );
    const contextMenu = await readFile(
      fileURLToPath(
        new URL("./components/AppContextMenu.vue", import.meta.url),
      ),
      "utf8",
    );

    expect(mapView).toContain("AppContextMenu");
    expect(mapView).not.toContain("positionMapContextMenu");
    expect(mapView).not.toContain("onMapContextMenuWheel");
    expect(mapView).not.toContain("mapContextMenuOverlay");
    expect(contextMenu).toContain("function openAt");
    expect(contextMenu).toContain("function onWheel");
    expect(contextMenu).toContain("function onDocumentKeydown");
  });

  it("uses the same tablet breakpoint for scrollable and nested menus", async () => {
    const [menu, contextMenu] = await Promise.all([
      readFile(
        fileURLToPath(new URL("./components/AppMenu.vue", import.meta.url)),
        "utf8",
      ),
      readFile(
        fileURLToPath(
          new URL("./components/AppContextMenu.vue", import.meta.url),
        ),
        "utf8",
      ),
    ]);

    expect(menu).toContain('matchMedia("(max-width: 700px)")');
    expect(menu).toContain("@media (max-width: 700px)");
    expect(contextMenu).toContain("@media (max-width: 700px)");
  });
});
