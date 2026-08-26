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
    expect(mapView).not.toContain("showZoomLevelControl");
    expect(mapView).toContain("shiftClickIntegerZoom: true");
    expect(mapView).toContain("formatLeafletZoomLevel(zoom.value)");
    expect(mapView).not.toContain("Math.round(zoom)");
    expect(tileUrl).not.toContain("https://");
  });

  it("renders Coverage through a neutral rectangle-grid Layer", async () => {
    const [coverageView, coverageModel] = await Promise.all([
      readFile(
        fileURLToPath(new URL("./views/CoverageView.vue", import.meta.url)),
        "utf8",
      ),
      readFile(
        fileURLToPath(new URL("./coverageModel.ts", import.meta.url)),
        "utf8",
      ),
    ]);

    expect(coverageView).toContain("MAP_RENDERER_FACTORY_REGISTRY_KEY");
    expect(coverageView).toContain("attachLayer");
    expect(coverageView).toContain(
      "const selectedId = ref<string | null>(null)",
    );
    expect(coverageView).toContain("watch(sourceZoom");
    expect(coverageView).toContain("coverageGridZoom(");
    expect(coverageView).toContain("applyPreviewZoomRange(sourceZoom.value)");
    expect(coverageView).toContain("rendererTransition.then");
    expect(coverageView).toContain("showZoomLevelControl: true");
    expect(coverageView).toContain("shiftClickIntegerZoom: true");
    expect(coverageView).toContain(':min="selected.minZoom + 1"');
    expect(coverageView).toContain("{{ selected.tileSize }}");
    expect(coverageView).toContain(
      "Zoom {{ selected.minZoom }}–{{ selected.maxZoom }}",
    );
    expect(coverageView).toContain(
      "source z{{ response.sourceZoom }} → grid z{{ formatZoom(previewZoom) }}",
    );
    const sourceZoomHandler = coverageView.slice(
      coverageView.indexOf("async function onSourceZoomChanged"),
      coverageView.indexOf("async function inspectTiles"),
    );
    expect(sourceZoomHandler).toContain("queryVisibleCoverage");
    expect(sourceZoomHandler).toContain("applyPreviewZoomRange");
    const mapSetHandler = coverageView.slice(
      coverageView.indexOf("async function onMapSetChanged"),
      coverageView.indexOf("watch(selectedId"),
    );
    expect(mapSetHandler).not.toContain("store.select");
    const mountedHandler = coverageView.slice(
      coverageView.indexOf("onMounted(async () =>"),
      coverageView.indexOf("onBeforeUnmount(destroyRenderer)"),
    );
    expect(mountedHandler).toContain("await renderMap()");
    expect(mountedHandler).toContain("mounted = true");
    expect(mountedHandler.indexOf("await renderMap()")).toBeLessThan(
      mountedHandler.indexOf("mounted = true"),
    );
    expect(coverageModel).toContain('type: "rectangle-grid"');
    expect(coverageView).not.toMatch(/from ["']leaflet["']/);
    expect(coverageModel).not.toMatch(/from ["']leaflet["']/);
  });

  it("deep-links from Coverage to Cache details and the Map Set editor", async () => {
    const [coverageView, tileCacheView, mapSetsView, main] = await Promise.all([
      readFile(
        fileURLToPath(new URL("./views/CoverageView.vue", import.meta.url)),
        "utf8",
      ),
      readFile(
        fileURLToPath(new URL("./views/TileCacheView.vue", import.meta.url)),
        "utf8",
      ),
      readFile(
        fileURLToPath(new URL("./views/MapSetsView.vue", import.meta.url)),
        "utf8",
      ),
      readFile(fileURLToPath(new URL("./main.ts", import.meta.url)), "utf8"),
    ]);

    expect(coverageView).toContain(':to="`/cache/$' + '{selected.id}`"');
    expect(coverageView).toContain(':to="`/map-sets/$' + '{selected.id}`"');
    expect(coverageView).toContain('title="View cache details"');
    expect(coverageView).toContain('title="Edit Map Set"');
    expect(tileCacheView).toContain(
      ':to="`/map-sets/$' + '{selectedMapSet.id}`"',
    );
    expect(tileCacheView).toContain(':to="`/map-sets/$' + '{row.mapSet.id}`"');
    expect(tileCacheView).toContain('title="Edit Map Set"');
    expect(main).toContain('path: "/map-sets/:mapSetId?"');
    expect(mapSetsView).toContain("await openRequestedEditor()");
    expect(mapSetsView).toContain("await scrollEditorIntoView()");
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
