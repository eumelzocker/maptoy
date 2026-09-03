import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

describe("Map view architecture", () => {
  it("publishes the Coverage source Zoom in the browser title", async () => {
    const [app, coverageView, mapViewState] = await Promise.all([
      readFile(fileURLToPath(new URL("./App.vue", import.meta.url)), "utf8"),
      readFile(
        fileURLToPath(new URL("./views/CoverageView.vue", import.meta.url)),
        "utf8",
      ),
      readFile(
        fileURLToPath(new URL("./stores/mapViewState.ts", import.meta.url)),
        "utf8",
      ),
    ]);

    expect(app).toContain('activeView.value?.id === "coverage"');
    expect(app).toContain("mapViewState.coverageSourceZoom");
    expect(app).toContain("mapViewState.coverageMapSetName");
    expect(coverageView).toContain("setCoverageSourceZoom");
    expect(coverageView).toContain("setCoverageMapSetName");
    expect(mapViewState).toContain("coverageSourceZoom");
    expect(mapViewState).toContain("coverageMapSetName");
  });

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
    expect(mapView).toContain("MapZoomControl");
    expect(mapView).toContain("zoomControl: false");
    expect(mapView).not.toContain("formatLeafletZoomLevel(zoom.value)");
    expect(mapView).not.toContain("Zoom {{ displayedZoom }}");
    expect(mapView).toContain('aria-label="Map coordinates"');
    expect(mapView).not.toContain(
      'v-if="pointer"\n          class="viewport-status"',
    );
    expect(mapView).toContain("showCoordinates && pointer");
    expect(mapView).not.toContain("Math.round(zoom)");
    expect(tileUrl).not.toContain("https://");
  });

  it("keeps layer tools inside the standard Map view", async () => {
    const [
      mapView,
      main,
      coverageView,
      layerPanel,
      layerEditor,
      layerEditorRegistry,
      schemaLayerEditor,
      trackLayerEditor,
      photoLayerEditor,
      photoMetadataPresentation,
      treeSelectDropdown,
      checkboxTree,
      layerStore,
    ] = await Promise.all([
      readFile(
        fileURLToPath(new URL("./views/MapView.vue", import.meta.url)),
        "utf8",
      ),
      readFile(fileURLToPath(new URL("./main.ts", import.meta.url)), "utf8"),
      readFile(
        fileURLToPath(new URL("./views/CoverageView.vue", import.meta.url)),
        "utf8",
      ),
      readFile(
        fileURLToPath(new URL("./components/LayerPanel.vue", import.meta.url)),
        "utf8",
      ),
      readFile(
        fileURLToPath(new URL("./components/LayerEditor.vue", import.meta.url)),
        "utf8",
      ),
      readFile(
        fileURLToPath(new URL("./layerEditorRegistry.ts", import.meta.url)),
        "utf8",
      ),
      readFile(
        fileURLToPath(
          new URL("./components/SchemaLayerEditor.vue", import.meta.url),
        ),
        "utf8",
      ),
      readFile(
        fileURLToPath(
          new URL("./components/TrackLayerEditor.vue", import.meta.url),
        ),
        "utf8",
      ),
      readFile(
        fileURLToPath(
          new URL("./components/PhotoLayerEditor.vue", import.meta.url),
        ),
        "utf8",
      ),
      readFile(
        fileURLToPath(
          new URL("./photoMetadataPresentation.ts", import.meta.url),
        ),
        "utf8",
      ),
      readFile(
        fileURLToPath(
          new URL("./components/TreeSelectDropdown.vue", import.meta.url),
        ),
        "utf8",
      ),
      readFile(
        fileURLToPath(
          new URL("./components/CheckboxTree.vue", import.meta.url),
        ),
        "utf8",
      ),
      readFile(
        fileURLToPath(new URL("./stores/layers.ts", import.meta.url)),
        "utf8",
      ),
    ]);

    expect(mapView).toContain("<LayerPanel");
    expect(mapView).toContain("LAYER_PLUGIN_REGISTRY_KEY");
    expect(mapView).toContain("renderPluginLayers");
    expect(layerPanel).toContain("TreeSelectDropdown");
    expect(layerPanel).toContain("LayerEditor");
    expect(layerPanel).toContain('v-if="selectedLayer"');
    expect(layerPanel).toContain("loadSelectedLayerId");
    expect(layerPanel).toContain("resolveSelectedLayerId");
    expect(layerPanel).toContain("buildLayerHierarchyRows");
    expect(layerPanel).toContain("Name or folder/name");
    expect(layerPanel).toContain("loadCollapsedLayerHierarchy");
    expect(layerPanel).toContain('class="layer-type-option"');
    expect(layerPanel).toContain(':placeholder="suggestedLayerName"');
    expect(layerPanel).toContain("focusPrimaryLayerAction");
    expect(layerPanel).toContain('title="Layers"');
    expect(layerPanel).toContain(':is-modal="false"');
    expect(layerPanel).toContain('initial-position="map-controls"');
    expect(layerPanel).toContain(':content-scrollable="false"');
    expect(layerPanel).toContain("fit-content");
    expect(layerPanel).toContain("<template #header-actions>");
    expect(mapView).toContain('title="Display Options"');
    expect(mapView).toContain(':open="displayOptionsOpen"');
    expect(mapView).toContain('initial-position="map-controls"');
    expect(mapView).toContain("function openDisplayOptionsTool");
    expect(mapView).toContain("displayOptionsOpen.value = false;");
    expect(mapView).toContain(
      '@click="openDisplayOptionsTool(openGotoCoordinates)"',
    );
    expect(mapView).toContain(
      '@click="openDisplayOptionsTool(openTileCalculator)"',
    );
    expect(mapView).toContain(
      '@click="openDisplayOptionsTool(openComparisonOptions)"',
    );
    expect(mapView).not.toContain("<TogglePanel");
    expect(layerEditor).toContain(':is="pluginEditor"');
    expect(layerEditor).not.toContain("layer.pluginId ===");
    expect(layerEditorRegistry).toContain("TrackLayerPluginEditor");
    expect(layerEditorRegistry).toContain("PhotoLayerPluginEditor");
    expect(layerEditorRegistry).toContain('"tile-grid-layer"');
    expect(schemaLayerEditor).toContain("configurationSchema.properties");
    expect(schemaLayerEditor).toContain('class="color-fields"');
    expect(schemaLayerEditor).toContain("colorAlphaPercent");
    expect(schemaLayerEditor).toContain("field.property.uiControl === 'range'");
    expect(layerEditor).toContain('class="layer-state-fields"');
    expect(layerEditor).not.toContain('title="Move layer up"');
    expect(layerEditor).not.toContain('title="Move layer down"');
    expect(layerEditor).toContain("move: [direction: -1 | 1]");
    expect(trackLayerEditor).toContain("Import track…");
    expect(trackLayerEditor).toContain("Replace track…");
    expect(trackLayerEditor).toContain(':class="{ primary: !hasTrack }"');
    expect(trackLayerEditor).toContain("GPX or GeoJSON");
    expect(trackLayerEditor).not.toContain("lineOpacity");
    expect(trackLayerEditor).not.toContain("Line opacity");
    expect(photoLayerEditor).toContain("Scan directory");
    expect(photoLayerEditor).toContain("data-layer-primary-action");
    expect(photoLayerEditor).toContain("browseDirectory");
    expect(photoLayerEditor).toContain("skipped (no location)");
    expect(photoLayerEditor).toContain("Relative to MAPTOY_PHOTOS_DIR");
    expect(photoLayerEditor).toContain('class="selected-directory"');
    expect(layerPanel).toContain("visibleScanResultJobIds.value = new Set()");
    expect(layerPanel).toContain("restorePhotoScanSettings");
    expect(photoLayerEditor).toContain("Fit photos on map");
    expect(photoLayerEditor).toContain("Cluster nearby photos");
    expect(layerPanel).toContain("Center map here");
    expect(layerPanel).toContain("editingPhotoMetadataRows");
    expect(photoMetadataPresentation).toContain('label: "IPTC caption"');
    expect(mapView).toContain('@center-map="centerMapOnPhoto"');
    expect(mapView).toContain('@fit-photo-layer="fitPhotoLayer"');
    expect(mapView).toContain("loadAssetExtent");
    expect(photoLayerEditor).not.toContain("update:scanDirectory");
    expect(layerPanel).toContain("PhotoDirectoryBrowser");
    expect(layerPanel).toContain(
      "Choose a photo subdirectory before starting a scan.",
    );
    expect(treeSelectDropdown).toContain("CheckboxTree");
    expect(treeSelectDropdown).toContain("Search layers…");
    expect(checkboxTree).toContain("emit('check'");
    expect(checkboxTree).toContain("emit('select'");
    expect(mapView).toContain("if (!layers.loaded)");
    expect(mapView).not.toContain("layers.load(mapSet.id)");
    expect(layerStore).toContain('apiRequest<LayerListResponse>("api/layers")');
    expect(layerStore).not.toContain("mapSetId");
    expect(layerPanel).not.toContain("Detach and keep reusable");
    expect(main).not.toContain('path: "/layers"');
    expect(coverageView).not.toContain("LayerPanel");
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
    expect(coverageView).toContain("MapZoomControl");
    expect(coverageView).toContain('class="coverage-sidebar-head"');
    expect(coverageView).toContain("(min-height: 720px)");
    expect(coverageView).toContain("position: sticky");
    expect(coverageView).toContain("top: -1.25rem");
    expect(coverageView).toContain("zoomControl: false");
    expect(coverageView).toContain("cachedTilesOnly: false");
    expect(coverageView).toContain("onSelectionChanged");
    expect(coverageView).toContain('<details class="cache-state" open>');
    expect(coverageView).toContain("scrollIntoView");
    expect(coverageView).toContain("coverageGridCellTileCapacity");
    expect(coverageView).toContain("About the Aggregation Grid");
    expect(coverageView).toContain('class="mdi mdi-information-outline"');
    expect(coverageView).not.toContain("Cell:");
    expect(coverageView).not.toContain("Compare with");
    expect(coverageView).not.toContain("Apply to visible area");
    expect(coverageView).not.toContain("compareTo");
    expect(coverageView).not.toContain("inspectTiles");
    expect(coverageView).not.toContain("Inspect individual tiles");
    expect(coverageModel).not.toContain("cell.comparison");
    const selectionHandler = coverageView.slice(
      coverageView.indexOf("function onSelectionChanged"),
      coverageView.indexOf("watch(selectedId"),
    );
    expect(selectionHandler).toContain("queryVisibleCoverage");
    expect(coverageView).toContain(':min="selected.minZoom + 1"');
    expect(coverageView).toContain("{{ selected.tileSize }}");
    expect(coverageView).toContain(
      "Zoom {{ selected.minZoom }}–{{ selected.maxZoom }}",
    );
    expect(coverageView).toContain(
      "source z{{ response.sourceZoom }} → map z{{ formatZoom(previewZoom) }}",
    );
    expect(coverageView).toContain('<dt class="summary-label">');
    expect(coverageView).toContain("Aggregation-Grid");
    expect(coverageView).toContain("<dd>z{{ response.aggregationZoom }}</dd>");
    const sourceZoomHandler = coverageView.slice(
      coverageView.indexOf("async function onSourceZoomChanged"),
      coverageView.indexOf("async function onMapSetChanged"),
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

  it("shares a deferred-apply zoom slider between map views", async () => {
    const [zoomControl, mapView, coverageView] = await Promise.all([
      readFile(
        fileURLToPath(
          new URL("./components/MapZoomControl.vue", import.meta.url),
        ),
        "utf8",
      ),
      readFile(
        fileURLToPath(new URL("./views/MapView.vue", import.meta.url)),
        "utf8",
      ),
      readFile(
        fileURLToPath(new URL("./views/CoverageView.vue", import.meta.url)),
        "utf8",
      ),
    ]);

    expect(mapView).toContain("<MapZoomControl");
    expect(mapView).toContain(':minimum="controlMinimumZoom"');
    expect(mapView).toContain(':maximum="controlMaximumZoom"');
    expect(mapView).toContain("auto-close-on-change");
    expect(coverageView).toContain("<MapZoomControl");
    expect(coverageView).toContain("auto-close-on-change");
    expect(zoomControl).toContain('type="range"');
    expect(zoomControl).toContain('step="1"');
    expect(zoomControl).toContain('@input="updateSliderZoom"');
    expect(zoomControl).toContain('@change="applySliderZoom"');
    const previewHandler = zoomControl.slice(
      zoomControl.indexOf("function updateSliderZoom"),
      zoomControl.indexOf("function applySliderZoom"),
    );
    const applyHandler = zoomControl.slice(
      zoomControl.indexOf("function applySliderZoom"),
      zoomControl.indexOf("function closeSlider"),
    );
    expect(previewHandler).not.toContain('emit("change"');
    expect(applyHandler).toContain('emit("change"');
    expect(applyHandler).toContain("props.autoCloseOnChange");
    expect(applyHandler).toContain("closeSlider()");
    expect(zoomControl).toContain("{ autoCloseOnChange: false }");
  });

  it("coordinates two or four renderer instances through the Compare Maps dialog", async () => {
    const [
      mapView,
      comparisonLayout,
      comparisonOptions,
      comparisonPreferences,
      adapter,
    ] = await Promise.all([
      readFile(
        fileURLToPath(new URL("./views/MapView.vue", import.meta.url)),
        "utf8",
      ),
      readFile(
        fileURLToPath(
          new URL("./components/MapComparisonLayout.vue", import.meta.url),
        ),
        "utf8",
      ),
      readFile(
        fileURLToPath(
          new URL("./components/MapComparisonOptions.vue", import.meta.url),
        ),
        "utf8",
      ),
      readFile(
        fileURLToPath(
          new URL("./mapComparisonPreferences.ts", import.meta.url),
        ),
        "utf8",
      ),
      readFile(
        fileURLToPath(
          new URL(
            "../../../adapters/leaflet-xyz/src/index.ts",
            import.meta.url,
          ),
        ),
        "utf8",
      ),
    ]);

    expect(mapView).toContain("<MapComparisonOptions");
    expect(mapView).toContain('title="Compare Maps"');
    expect(mapView).toContain('initial-position="center"');
    expect(mapView).toContain(':can-activate="comparisonCanActivate"');
    expect(mapView).toContain('aria-label="Enable Compare Maps"');
    expect(comparisonOptions).toContain("<span>Active</span>");
    expect(comparisonOptions).toContain(':disabled="!canActivate"');
    expect(mapView).toContain("activeRenderers");
    expect(mapView).toContain("synchronizeViewport");
    expect(mapView).toContain(
      "renderOperation.then(() => renderSelectedMaps(generation))",
    );
    expect(mapView).toContain('v-if="selected"');
    expect(mapView).not.toContain('v-if="selected && !comparisonActive"');
    expect(mapView).toContain(
      'v-if="store.items.length > 0 && !comparisonActive"',
    );
    expect(mapView).toContain("rendererTargets.map");
    expect(mapView).toContain("target.instance.attachLayer");
    expect(mapView).toContain("layerIsVisibleForRenderer");
    expect(mapView).toContain("comparisonAttributions");
    expect(mapView).toContain(':show-attribution="showAttribution"');
    expect(comparisonLayout).toContain('role="separator"');
    expect(comparisonLayout).toContain("map-comparison-attribution-region");
    expect(comparisonLayout).toContain("clipPath");
    expect(comparisonLayout).toContain('props.mode === "synchronized"');
    expect(comparisonPreferences).toContain(
      '{ kind: "snapshot"; snapshotId: string }',
    );
    expect(comparisonPreferences).toContain(
      '{ kind: "asOf"; timestamp: string }',
    );
    expect(adapter).toContain('event === "viewport-live"');
    expect(adapter).toContain("map.invalidateSize");
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

  it("keeps Batch Downloads inside Coverage without a separate main view", async () => {
    const [coverageView, downloadPanel, mapSetsView, main] = await Promise.all([
      readFile(
        fileURLToPath(new URL("./views/CoverageView.vue", import.meta.url)),
        "utf8",
      ),
      readFile(
        fileURLToPath(
          new URL("./components/TileDownloadPanel.vue", import.meta.url),
        ),
        "utf8",
      ),
      readFile(
        fileURLToPath(new URL("./views/MapSetsView.vue", import.meta.url)),
        "utf8",
      ),
      readFile(fileURLToPath(new URL("./main.ts", import.meta.url)), "utf8"),
    ]);

    expect(coverageView).toContain("<TileDownloadPanel");
    expect(coverageView).toContain('class="download-area-selector"');
    expect(coverageView).toContain("screenRectangleBounds(renderer");
    expect(coverageView).toContain("!event.ctrlKey");
    expect(coverageView).toContain(
      '@pointerdown.capture="startDownloadAreaDrag"',
    );
    expect(downloadPanel).toContain("Use visible area");
    expect(downloadPanel).toContain("Select area on map");
    expect(downloadPanel).toContain("Ctrl+click or Ctrl+drag on map");
    expect(downloadPanel).toContain('emit("requestAreaSelection")');
    expect(downloadPanel).toContain("mdi-chevron-right");
    expect(downloadPanel).toContain("mdi-chevron-down");
    expect(downloadPanel).toContain("Queue download");
    expect(downloadPanel).toContain("defaultInput(props.mapSet, true)");
    expect(downloadPanel).toContain("input?.bounds ?? null");
    expect(coverageView).toContain('v-model="showSelection"');
    expect(coverageView).toContain(
      "showSelection.value ? downloadSelection.value : null",
    );
    expect(downloadPanel).toContain("Finished downloads");
    expect(downloadPanel).toContain("finishedJobsOpen");
    expect(downloadPanel).toContain("jobMapSetName(job)");
    expect(downloadPanel).toContain("jobZoomRange(job)");
    expect(downloadPanel).toContain("skipped ·");
    const startHandler = downloadPanel.slice(
      downloadPanel.indexOf("async function start"),
      downloadPanel.indexOf("async function control"),
    );
    expect(startHandler).not.toContain("acceptedResponsibility.value = false");
    expect(mapSetsView).toContain("openTileDownload");
    expect(mapSetsView).toContain('query: { download: "open" }');
    expect(main).not.toMatch(/path:\s*["']\/(?:downloads|jobs)/);
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
