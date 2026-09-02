<script setup lang="ts">
import { leafletXyzZoomOptions } from "@maptoy/leaflet-xyz";
import type {
  GeographicCoordinate,
  MapLayerDescriptor,
  MapLayerType,
  MapRendererInstance,
} from "@maptoy/map-adapter-sdk";
import type { LayerPluginFrontendHandle } from "@maptoy/layer-plugin-sdk";
import { TILE_GRID_LAYER_PLUGIN_ID } from "@maptoy/tile-grid-layer";
import { documentation } from "virtual:maptoy-docs";
import { storeToRefs } from "pinia";
import {
  computed,
  inject,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from "vue";
import { useRouter } from "vue-router";
// biome-ignore lint/correctness/noUnusedImports: referenced by the Vue template
import AppContextMenu from "../components/AppContextMenu.vue";
// biome-ignore lint/correctness/noUnusedImports: referenced by the Vue template
import AppMenuSelect from "../components/AppMenuSelect.vue";
// biome-ignore lint/correctness/noUnusedImports: referenced by the Vue template
import DialogWindow from "../components/DialogWindow.vue";
// biome-ignore lint/correctness/noUnusedImports: referenced by the Vue template
import GotoCoordinatesDialog from "../components/GotoCoordinatesDialog.vue";
// biome-ignore lint/correctness/noUnusedImports: referenced by the Vue template
import HtmlTooltip from "../components/HtmlTooltip.vue";
// biome-ignore lint/correctness/noUnusedImports: referenced by the Vue template
import LayerPanel from "../components/LayerPanel.vue";
// biome-ignore lint/correctness/noUnusedImports: referenced by the Vue template
import MapComparisonLayout from "../components/MapComparisonLayout.vue";
// biome-ignore lint/correctness/noUnusedImports: referenced by the Vue template
import MapComparisonOptions from "../components/MapComparisonOptions.vue";
// biome-ignore lint/correctness/noUnusedImports: referenced by the Vue template
import MapSetSelect from "../components/MapSetSelect.vue";
// biome-ignore lint/correctness/noUnusedImports: referenced by the Vue template
import MapZoomControl from "../components/MapZoomControl.vue";
// biome-ignore lint/correctness/noUnusedImports: referenced by the Vue template
import MapSideControlButton from "../components/MapSideControlButton.vue";
// biome-ignore lint/correctness/noUnusedImports: referenced by the Vue template
import TileCalculatorDialog from "../components/TileCalculatorDialog.vue";
import { loadDocumentationLanguage } from "../documentationLanguage.js";
import {
  type CoordinateFormat,
  coordinateFormats,
  formatLatitude,
  formatLongitude,
  isCoordinateFormat,
} from "../coordinateFormat.js";
import {
  loadCachedTilesOnly,
  loadCoordinateFormat,
  loadShowAttribution,
  loadShowCoordinates,
  loadShowMapSelector,
  loadShowTileGrid,
  saveCachedTilesOnly,
  saveCoordinateFormat,
  saveShowAttribution,
  saveShowCoordinates,
  saveShowMapSelector,
  saveShowTileGrid,
} from "../mapDisplayPreferences.js";
import {
  createMapContextMenuItems,
  mapContextMenuIds,
} from "../mapContextMenuItems.js";
import type { MenuItem } from "../menuModels.js";
import { mapTileUrl } from "../mapTileUrl.js";
import { availableLocalStorage } from "../localStorage.js";
import {
  type MapComparisonMode,
  type MapComparisonPreferences,
  loadMapComparisonPreferences,
  saveMapComparisonPreferences,
} from "../mapComparisonPreferences.js";
import { mapComparisonZoomRange } from "../mapComparisonModel.js";
import { applyMapCenter } from "../mapViewportActions.js";
import { loadMapViewport, saveMapViewport } from "../mapViewportStorage.js";
import {
  LAYER_PLUGIN_REGISTRY_KEY,
  MAP_RENDERER_FACTORY_REGISTRY_KEY,
} from "../registries.js";
import { useLayersStore } from "../stores/layers.js";
import { useMapSetsStore } from "../stores/mapSets.js";
import { useMapViewStateStore } from "../stores/mapViewState.js";
import { useUiPreferencesStore } from "../stores/uiPreferences.js";

const injectedFactories = inject(MAP_RENDERER_FACTORY_REGISTRY_KEY);
if (injectedFactories === undefined) {
  throw new Error("Map renderer factory registry is not available.");
}
const factories = injectedFactories;
const injectedLayerPlugins = inject(LAYER_PLUGIN_REGISTRY_KEY);
if (injectedLayerPlugins === undefined) {
  throw new Error("Layer plugin registry is not available.");
}
const layerPlugins = injectedLayerPlugins;

const router = useRouter();
const store = useMapSetsStore();
const mapViewState = useMapViewStateStore();
const layers = useLayersStore();
const { selected, selectedId } = storeToRefs(store);
const comparisonLayout = ref<{ getHosts(): readonly HTMLElement[] } | null>(
  null,
);
const mapError = ref<string | null>(null);
const pointer = ref<{ longitude: number; latitude: number } | null>(null);
const zoom = ref<number | null>(null);
const browserStorage = availableLocalStorage();
const comparison = ref<MapComparisonPreferences>(
  loadMapComparisonPreferences(browserStorage),
);
const cachedTilesOnly = ref(loadCachedTilesOnly(browserStorage));
const showCoordinates = ref(loadShowCoordinates(browserStorage));
const coordinateFormat = ref<CoordinateFormat>(
  loadCoordinateFormat(browserStorage),
);
const showAttribution = ref(loadShowAttribution(browserStorage));
const showMapSelector = ref(loadShowMapSelector(browserStorage));
const storedShowTileGrid = ref(loadShowTileGrid(browserStorage));
const defaultGridBusy = ref(false);
const comparisonActive = computed(
  () => comparison.value.enabled && store.items.length > 0,
);
const activeComparisonSources = computed(() =>
  comparison.value.sources.slice(0, comparison.value.count),
);
const comparisonMapSets = computed(() =>
  activeComparisonSources.value.map(
    (source) => store.items.find(({ id }) => id === source.mapSetId) ?? null,
  ),
);
// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
const comparisonLabels = computed(() =>
  comparisonMapSets.value.map((mapSet, index) => {
    if (mapSet === null) return `Map ${index + 1}`;
    const selection = activeComparisonSources.value[index]?.tileSelection;
    if (selection?.kind === "snapshot") return `${mapSet.name} · Snapshot`;
    if (selection?.kind === "asOf") return `${mapSet.name} · Point in time`;
    return mapSet.name;
  }),
);
// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
const comparisonAttributions = computed(() => {
  const unique = new Map<string, { name: string; attribution: string }>();
  for (const mapSet of comparisonMapSets.value) {
    if (mapSet !== null && !unique.has(mapSet.attribution)) {
      unique.set(mapSet.attribution, {
        name: mapSet.name,
        attribution: mapSet.attribution,
      });
    }
  }
  return [...unique.values()];
});
const supportedLayerTypes = computed<readonly MapLayerType[]>(() =>
  selected.value === null
    ? []
    : (factories.get(selected.value.rendererId)?.manifest.supportedLayerTypes ??
      []),
);
const tileGridAvailable = computed(() => {
  if (
    comparisonActive.value ||
    selected.value?.capabilities.layerRendering !== true
  ) {
    return false;
  }
  const supportedTypes = new Set(supportedLayerTypes.value);
  const plugin = layerPlugins.get(TILE_GRID_LAYER_PLUGIN_ID);
  return (
    plugin?.frontend !== undefined &&
    plugin.manifest.requiredRendererLayerTypes.every((type) =>
      supportedTypes.has(type),
    )
  );
});
const showTileGrid = computed(() =>
  layers.loaded
    ? layers.defaultGridLayer?.visible === true
    : storedShowTileGrid.value,
);
const layerPanel = ref<{ open(layerId?: string): void } | null>(null);
const displayOptionsOpen = ref(false);
const displayOptionsDialog = ref<{ activate(): void } | null>(null);
const gotoCoordinatesOpen = ref(false);
const gotoInitialCoordinate = ref<GeographicCoordinate>({
  longitude: 0,
  latitude: 0,
});
const gotoInitialZoom = ref(0);
const tileCalculatorOpen = ref(false);
const tileCalculatorInitialInput = ref({
  zoom: 0,
  longitude: 0,
  latitude: 0,
});
const uiPreferences = useUiPreferencesStore();
const documentationLanguage = loadDocumentationLanguage(
  documentation.languages.map(({ code }) => code),
  documentation.defaultLanguage,
);
const mapContextMenu = ref<{ openAt(x: number, y: number): void } | null>(null);
// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
const coordinateFormatOptions: readonly MenuItem[] = coordinateFormats.map(
  (format) => ({ id: format, label: format.toUpperCase() }),
);
// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
const formattedPointer = computed(() =>
  pointer.value === null
    ? ""
    : `${formatLatitude(pointer.value.latitude, coordinateFormat.value)}, ${formatLongitude(pointer.value.longitude, coordinateFormat.value)}`,
);
const showTitleBar = computed({
  get: () => uiPreferences.showTitleBar,
  set: (value) => uiPreferences.setShowTitleBar(value),
});
const controlZoom = computed(() =>
  selected.value === null || zoom.value === null
    ? null
    : comparisonActive.value
      ? zoom.value
      : zoom.value + leafletXyzZoomOptions(selected.value).zoomOffset,
);
const comparisonZoomRange = computed(() => {
  const mapSets = comparisonMapSets.value.filter((mapSet) => mapSet !== null);
  return comparisonActive.value ? mapComparisonZoomRange(mapSets) : null;
});
const controlMinimumZoom = computed(
  () => comparisonZoomRange.value?.minimum ?? selected.value?.minZoom ?? 0,
);
const controlMaximumZoom = computed(
  () => comparisonZoomRange.value?.maximum ?? selected.value?.maxZoom ?? 0,
);
// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
const toolMinimumZoom = computed(() => {
  const mapSet = selected.value;
  if (!comparisonActive.value || mapSet === null) return mapSet?.minZoom ?? 0;
  return controlMinimumZoom.value + leafletXyzZoomOptions(mapSet).zoomOffset;
});
// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
const toolMaximumZoom = computed(() => {
  const mapSet = selected.value;
  if (!comparisonActive.value || mapSet === null) return mapSet?.maxZoom ?? 0;
  return controlMaximumZoom.value + leafletXyzZoomOptions(mapSet).zoomOffset;
});
// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
const mapContextMenuItems = computed(() =>
  createMapContextMenuItems({
    mapSets: store.items,
    selectedMapSetId: selectedId.value,
    minimumZoom: selected.value === null ? null : controlMinimumZoom.value,
    maximumZoom: selected.value === null ? null : controlMaximumZoom.value,
    currentZoom:
      selected.value === null || zoom.value === null
        ? null
        : Math.round(controlZoom.value ?? zoom.value),
    documentationLanguage,
    documentationPages: documentation.pages.filter(
      ({ requestedLanguage }) => requestedLanguage === documentationLanguage,
    ),
    toolsEnabled: selected.value !== null && zoom.value !== null,
    layersEnabled: selected.value !== null && !comparisonActive.value,
    cachedTilesOnly: cachedTilesOnly.value,
    showTitleBar: showTitleBar.value,
    showMapSelector: showMapSelector.value,
    mapSelectorAvailable: !comparisonActive.value,
    showCoordinates: showCoordinates.value,
    showAttribution: showAttribution.value,
    showTileGrid: !comparisonActive.value && showTileGrid.value,
    tileGridAvailable: tileGridAvailable.value && !defaultGridBusy.value,
  }),
);
interface ActiveRenderer {
  instance: MapRendererInstance;
}

let renderer: MapRendererInstance | null = null;
let activeRenderers: ActiveRenderer[] = [];
let renderGeneration = 0;
let renderOperation = Promise.resolve();
let synchronizingViewport = false;
const layerHandles = new Map<string, LayerPluginFrontendHandle>();
const attachedLayerIds = new Set<string>();
const publishedLayers = new Map<string, MapLayerDescriptor>();
let layerOperation: Promise<void> = Promise.resolve();

watch(showCoordinates, (value) => saveShowCoordinates(value, browserStorage));
watch(coordinateFormat, (value) => saveCoordinateFormat(value, browserStorage));
watch(showMapSelector, (value) => saveShowMapSelector(value, browserStorage));
watch(showTileGrid, (value) => {
  storedShowTileGrid.value = value;
  saveShowTileGrid(value, browserStorage);
});
watch(
  comparison,
  (value) => saveMapComparisonPreferences(value, browserStorage),
  { deep: true },
);
watch(controlZoom, (value) => mapViewState.setSourceZoom(value), {
  immediate: true,
});
watch(cachedTilesOnly, (value) => {
  saveCachedTilesOnly(value, browserStorage);
  void queueSelectedMapsRender();
});
watch(showAttribution, (value) => {
  saveShowAttribution(value, browserStorage);
  if (!comparisonActive.value) {
    void renderer?.setAttributionVisible(value);
  }
});

async function destroyRenderer(): Promise<void> {
  const renderers = activeRenderers;
  const primaryRenderer = renderer;
  renderer = null;
  activeRenderers = [];
  synchronizingViewport = false;
  for (const handle of layerHandles.values()) {
    await handle.destroy();
  }
  layerHandles.clear();
  attachedLayerIds.clear();
  publishedLayers.clear();
  layerOperation = Promise.resolve();
  if (primaryRenderer !== null) {
    saveMapViewport(browserStorage, primaryRenderer.getViewport());
  }
  await Promise.all(renderers.map(({ instance }) => instance.destroy()));
}

async function renderPluginLayers(): Promise<void> {
  const activeRenderer = renderer;
  const mapSet = selected.value;
  if (
    activeRenderer === null ||
    mapSet === null ||
    !mapSet.capabilities.layerRendering
  ) {
    return;
  }

  await Promise.all(
    layers.items
      .filter((layer) => layer.pluginId === "photo-layer" && layer.visible)
      .map((layer) => layers.loadAllAssets(layer.id)),
  );

  for (const handle of layerHandles.values()) {
    await handle.destroy();
  }
  layerHandles.clear();
  await layerOperation;

  for (const layer of layers.items) {
    if (layer.status !== "ready") {
      continue;
    }
    const plugin = layerPlugins.get(layer.pluginId);
    if (plugin?.frontend === undefined) {
      continue;
    }
    const supportedTypes = new Set(supportedLayerTypes.value);
    if (
      plugin.manifest.requiredRendererLayerTypes.some(
        (type) => !supportedTypes.has(type),
      )
    ) {
      continue;
    }
    const assets = (layers.assetsByLayer[layer.id] ?? []).map((asset) => ({
      id: asset.id,
      status: asset.status,
      fileName: asset.fileName,
      ...(asset.previewAvailable
        ? { previewUrl: `api/layers/${layer.id}/assets/${asset.id}` }
        : {}),
      longitude: asset.longitude,
      latitude: asset.latitude,
      ...(asset.photoMetadata === undefined
        ? {}
        : { metadata: asset.photoMetadata }),
    }));
    const handle = await plugin.frontend.mount(
      {
        instanceId: layer.id,
        publishLayer: (descriptor) => {
          const mapLayer: MapLayerDescriptor = {
            id: layer.id,
            type: descriptor.type,
            visible: layerIsVisibleAtCurrentZoom(layer),
            opacity: layer.opacity,
            data: descriptor.data,
          };
          publishedLayers.set(layer.id, mapLayer);
          layerOperation = layerOperation.then(async () => {
            if (renderer !== activeRenderer) {
              return;
            }
            if (attachedLayerIds.has(layer.id)) {
              await activeRenderer.updateLayer(mapLayer);
            } else {
              await activeRenderer.attachLayer(mapLayer);
              attachedLayerIds.add(layer.id);
            }
          });
        },
        clearLayer: () => {
          layerOperation = layerOperation.then(async () => {
            if (
              renderer === activeRenderer &&
              attachedLayerIds.delete(layer.id)
            ) {
              await activeRenderer.removeLayer(layer.id);
              publishedLayers.delete(layer.id);
            }
          });
        },
        resolveAssetUrl: (assetId) =>
          `api/layers/${layer.id}/assets/${encodeURIComponent(assetId)}`,
      },
      {
        configuration: layer.configuration,
        data: layer.data,
        assets,
        opacity: layer.opacity,
        visible: layer.visible,
      },
    );
    layerHandles.set(layer.id, handle);
  }
  await layerOperation;
  if (renderer === activeRenderer) {
    await activeRenderer.reorderLayers(
      layers.items
        .filter((layer) => attachedLayerIds.has(layer.id))
        .map(({ id }) => id),
    );
  }
}

function layerIsVisibleAtCurrentZoom(
  layer: (typeof layers.items)[number],
): boolean {
  const mapSet = selected.value;
  if (!layer.visible || zoom.value === null || mapSet === null) {
    return false;
  }
  const sourceZoom = zoom.value + leafletXyzZoomOptions(mapSet).zoomOffset;
  return (
    (layer.minimumZoom === null || sourceZoom >= layer.minimumZoom) &&
    (layer.maximumZoom === null || sourceZoom <= layer.maximumZoom)
  );
}

async function refreshLayerZoomVisibility(): Promise<void> {
  const activeRenderer = renderer;
  if (activeRenderer === null) {
    return;
  }
  await Promise.all(
    layers.items.map(async (layer) => {
      const published = publishedLayers.get(layer.id);
      if (published === undefined) {
        return;
      }
      const visible = layerIsVisibleAtCurrentZoom(layer);
      if (published.visible === visible) {
        return;
      }
      const next = {
        ...published,
        visible,
      };
      publishedLayers.set(layer.id, next);
      await activeRenderer.updateLayer(next);
    }),
  );
}

async function synchronizeViewport(source: MapRendererInstance): Promise<void> {
  if (
    synchronizingViewport ||
    !activeRenderers.some(({ instance }) => instance === source)
  ) {
    return;
  }
  synchronizingViewport = true;
  try {
    const viewport = source.getViewport();
    zoom.value = viewport.zoom;
    await Promise.all(
      activeRenderers
        .filter(({ instance }) => instance !== source)
        .map(({ instance }) => instance.setViewport(viewport)),
    );
    saveMapViewport(browserStorage, viewport);
    if (!comparisonActive.value) {
      await refreshLayerZoomVisibility();
    }
  } finally {
    synchronizingViewport = false;
  }
}

async function applyViewportToAll(
  viewport: ReturnType<MapRendererInstance["getViewport"]>,
): Promise<void> {
  if (activeRenderers.length === 0) return;
  synchronizingViewport = true;
  try {
    await Promise.all(
      activeRenderers.map(({ instance }) => instance.setViewport(viewport)),
    );
    zoom.value = viewport.zoom;
    saveMapViewport(browserStorage, viewport);
    if (!comparisonActive.value) {
      await refreshLayerZoomVisibility();
    }
  } finally {
    synchronizingViewport = false;
  }
}

// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
function resizeRenderers(): void {
  for (const { instance } of activeRenderers) {
    void instance.resize?.();
  }
}

function queueSelectedMapsRender(): Promise<void> {
  const generation = ++renderGeneration;
  const operation = renderOperation.then(() => renderSelectedMaps(generation));
  renderOperation = operation.catch(() => undefined);
  return operation;
}

async function renderSelectedMaps(generation: number): Promise<void> {
  zoom.value = null;
  await destroyRenderer();
  mapError.value = null;
  pointer.value = null;
  await nextTick();
  if (generation !== renderGeneration) {
    return;
  }
  const hosts = comparisonLayout.value?.getHosts() ?? [];
  const sources = comparisonActive.value
    ? activeComparisonSources.value
    : [
        {
          mapSetId: selected.value?.id ?? null,
          tileSelection: { kind: "current" as const },
        },
      ];
  const mapSets = sources.map(
    ({ mapSetId }) => store.items.find(({ id }) => id === mapSetId) ?? null,
  );
  const mapSet = mapSets[0] ?? null;
  if (mapSet === null || hosts.length !== sources.length) {
    return;
  }
  if (mapSets.some((candidate) => candidate === null)) {
    mapError.value = "Select a Map Set for every comparison area.";
    return;
  }
  const resolvedMapSets = mapSets.filter((candidate) => candidate !== null);
  const nonInteractive = resolvedMapSets.find(
    (candidate) => !candidate.capabilities.interactive,
  );
  if (nonInteractive !== undefined) {
    mapError.value = `Interactive display is disabled for ${nonInteractive.name}.`;
    return;
  }
  const commonRange = mapComparisonZoomRange(resolvedMapSets);
  if (commonRange === null) return;
  const { minimum: commonMinimumZoom, maximum: commonMaximumZoom } =
    commonRange;
  if (commonMinimumZoom > commonMaximumZoom) {
    mapError.value = "The selected Map Sets do not share a visual zoom range.";
    return;
  }
  const primaryZoomOptions = leafletXyzZoomOptions(mapSet);
  const initialViewport = loadMapViewport(
    browserStorage,
    {
      center: mapSet.defaultCenter,
      zoom: mapSet.defaultZoom - primaryZoomOptions.zoomOffset,
    },
    commonMinimumZoom,
    commonMaximumZoom,
  );
  const created: ActiveRenderer[] = [];
  try {
    for (const [index, candidate] of resolvedMapSets.entries()) {
      const factory = factories.get(candidate.rendererId);
      if (factory === undefined) {
        throw new Error(
          `Renderer adapter ${candidate.rendererId} is unavailable.`,
        );
      }
      const nextRenderer = await factory.create({
        host: hosts[index] as HTMLElement,
        initialViewport,
        configuration: {
          tileUrl: mapTileUrl({
            mapSetId: candidate.id,
            cachedTilesOnly: cachedTilesOnly.value,
            displayGeneration: generation,
            tileSelection: sources[index]?.tileSelection ?? { kind: "current" },
          }),
          attribution: candidate.attribution,
          minZoom: candidate.minZoom,
          maxZoom: candidate.maxZoom,
          tileSize: candidate.tileSize,
          zoomControl: false,
        },
      });
      created.push({ instance: nextRenderer });
      await nextRenderer.setZoomRange?.({
        minimum: commonMinimumZoom,
        maximum: commonMaximumZoom,
      });
      if (generation !== renderGeneration) {
        await Promise.all(created.map(({ instance }) => instance.destroy()));
        return;
      }
    }
    if (generation !== renderGeneration) {
      await Promise.all(created.map(({ instance }) => instance.destroy()));
      return;
    }
    activeRenderers = created;
    renderer = created[0]?.instance ?? null;
    zoom.value = renderer?.getViewport().zoom ?? null;
    for (const { instance } of created) {
      await instance.setAttributionVisible(
        !comparisonActive.value && showAttribution.value,
      );
      instance.subscribe("pointer", (payload) => {
        if (
          typeof payload === "object" &&
          payload !== null &&
          "coordinate" in payload
        ) {
          pointer.value = payload.coordinate as {
            longitude: number;
            latitude: number;
          };
        }
      });
      instance.subscribe(
        comparisonActive.value ? "viewport-live" : "viewport",
        () => {
          void synchronizeViewport(instance);
        },
      );
      await instance.resize?.();
    }
    if (!comparisonActive.value && mapSet.capabilities.layerRendering) {
      if (!layers.loaded) {
        await layers.load();
      }
      if (generation === renderGeneration && renderer !== null) {
        await renderPluginLayers();
      }
    }
  } catch (error) {
    mapError.value =
      error instanceof Error
        ? error.message
        : "The map renderer failed to start.";
    if (activeRenderers === created) {
      await destroyRenderer();
    } else {
      await Promise.all(created.map(({ instance }) => instance.destroy()));
    }
  }
}

const rendererConfigurationKey = computed(() =>
  JSON.stringify(
    comparisonActive.value
      ? {
          enabled: true,
          count: comparison.value.count,
          mode: comparison.value.mode,
          sources: activeComparisonSources.value,
        }
      : { enabled: false, selectedId: selectedId.value },
  ),
);

watch(rendererConfigurationKey, () => void queueSelectedMapsRender());
watch(selectedId, (id) => {
  store.select(id);
  if (comparisonActive.value && comparison.value.sources[0]?.mapSetId !== id) {
    updateComparisonSource(0, id);
  }
});

onMounted(async () => {
  try {
    await store.load();
    repairComparisonSources();
    await nextTick();
    await queueSelectedMapsRender();
  } catch {
    mapError.value = store.error;
  }
});

onBeforeUnmount(destroyRenderer);
onBeforeUnmount(() => mapViewState.setSourceZoom(null));

// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
function openMapContextMenu(event: MouseEvent): void {
  event.preventDefault();
  mapContextMenu.value?.openAt(event.clientX, event.clientY);
}

// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
function onMapContextMenuKeydown(event: KeyboardEvent): void {
  if (event.key !== "ContextMenu" && !(event.shiftKey && event.key === "F10")) {
    return;
  }
  event.preventDefault();
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }
  const box = target.getBoundingClientRect();
  mapContextMenu.value?.openAt(
    box.left + Math.min(box.width / 2, 160),
    box.top + Math.min(box.height / 2, 120),
  );
}

// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
function selectMapContextMenuItem(item: MenuItem): void {
  if (item.id.startsWith(mapContextMenuIds.mapSetPrefix)) {
    selectedId.value = item.id.slice(mapContextMenuIds.mapSetPrefix.length);
  } else if (item.id.startsWith(mapContextMenuIds.zoomPrefix)) {
    const requestedZoom = Number(
      item.id.slice(mapContextMenuIds.zoomPrefix.length),
    );
    if (Number.isInteger(requestedZoom)) {
      void applyMapZoom(requestedZoom);
    }
  } else if (item.id === mapContextMenuIds.mapSets) {
    void router.push("/map-sets");
  } else if (item.id === mapContextMenuIds.tileCache) {
    void router.push("/cache");
  } else if (item.id === mapContextMenuIds.coverage) {
    void router.push(
      selectedId.value === null ? "/coverage" : `/coverage/${selectedId.value}`,
    );
  } else if (item.id.startsWith(mapContextMenuIds.documentationPrefix)) {
    const pageId = item.id.slice(mapContextMenuIds.documentationPrefix.length);
    void router.push(`/docs/${documentationLanguage}/${pageId}`);
  } else if (item.id === mapContextMenuIds.gotoCoordinates) {
    openGotoCoordinates();
  } else if (item.id === mapContextMenuIds.tileCalculator) {
    openTileCalculator();
  } else if (item.id === mapContextMenuIds.layers) {
    layerPanel.value?.open();
  } else if (item.id === mapContextMenuIds.displayOptions) {
    if (displayOptionsOpen.value) {
      displayOptionsDialog.value?.activate();
    } else {
      displayOptionsOpen.value = true;
    }
  } else if (item.id === mapContextMenuIds.cachedTilesOnly) {
    cachedTilesOnly.value = !cachedTilesOnly.value;
  } else if (item.id === mapContextMenuIds.showTileGrid) {
    void setDefaultGridVisible(!showTileGrid.value);
  } else if (item.id === mapContextMenuIds.showTitleBar) {
    showTitleBar.value = !showTitleBar.value;
  } else if (
    item.id === mapContextMenuIds.showMapSelector &&
    !comparisonActive.value
  ) {
    showMapSelector.value = !showMapSelector.value;
  } else if (item.id === mapContextMenuIds.showCoordinates) {
    showCoordinates.value = !showCoordinates.value;
  } else if (item.id === mapContextMenuIds.showAttribution) {
    showAttribution.value = !showAttribution.value;
  }
}

async function setDefaultGridVisible(visible: boolean): Promise<void> {
  if (!tileGridAvailable.value || defaultGridBusy.value) {
    return;
  }
  defaultGridBusy.value = true;
  try {
    if (!layers.loaded) {
      await layers.load();
    }
    await layers.setDefaultGridVisible(visible);
    await renderPluginLayers();
  } catch (error) {
    mapError.value =
      error instanceof Error
        ? error.message
        : "The default Tile Grid could not be updated.";
  } finally {
    defaultGridBusy.value = false;
  }
}

async function applyMapZoom(requestedZoom: number): Promise<void> {
  const mapSet = selected.value;
  const minimum = comparisonActive.value
    ? controlMinimumZoom.value
    : mapSet?.minZoom;
  const maximum = comparisonActive.value
    ? controlMaximumZoom.value
    : mapSet?.maxZoom;
  if (
    renderer === null ||
    mapSet === null ||
    minimum === undefined ||
    maximum === undefined ||
    requestedZoom < minimum ||
    requestedZoom > maximum
  ) {
    return;
  }
  const viewport = renderer.getViewport();
  const zoomOptions = leafletXyzZoomOptions(mapSet);
  await applyViewportToAll({
    center: viewport.center,
    zoom: comparisonActive.value
      ? requestedZoom
      : requestedZoom - zoomOptions.zoomOffset,
  });
}

// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
async function centerMapOnPhoto(
  coordinate: GeographicCoordinate,
): Promise<void> {
  if (renderer === null) {
    return;
  }
  mapError.value = null;
  await applyMapCenter(renderer, coordinate);
  const viewport = renderer.getViewport();
  await applyViewportToAll(viewport);
}

// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
async function fitPhotoLayer(layerId: string): Promise<void> {
  const activeRenderer = renderer;
  const mapSet = selected.value;
  const layer = layers.items.find(({ id }) => id === layerId);
  if (activeRenderer === null || mapSet === null || layer === undefined) {
    return;
  }
  mapError.value = null;
  try {
    const extent = await layers.loadAssetExtent(layerId);
    if (extent.bounds === null || extent.coordinateCount === 0) {
      mapError.value = "This Photo Layer has no positioned Photos.";
      return;
    }
    if (
      extent.bounds.west === extent.bounds.east &&
      extent.bounds.south === extent.bounds.north
    ) {
      await applyMapCenter(activeRenderer, {
        longitude: extent.bounds.west,
        latitude: extent.bounds.south,
      });
    } else if (activeRenderer.fitBounds !== undefined) {
      const zoomOptions = leafletXyzZoomOptions(mapSet);
      await activeRenderer.fitBounds(extent.bounds, {
        paddingPixels: 32,
        maximumZoom:
          Math.min(mapSet.maxZoom, layer.maximumZoom ?? mapSet.maxZoom) -
          zoomOptions.zoomOffset,
      });
    } else {
      mapError.value = "This Map renderer cannot fit a Layer extent.";
      return;
    }
    const viewport = activeRenderer.getViewport();
    await applyViewportToAll(viewport);
    const sourceZoom = viewport.zoom + leafletXyzZoomOptions(mapSet).zoomOffset;
    if (layer.minimumZoom !== null && sourceZoom < layer.minimumZoom) {
      mapError.value =
        "All Photos fit the viewport, but this Layer is hidden below its configured minimum zoom.";
    }
  } catch (error) {
    mapError.value =
      error instanceof Error
        ? error.message
        : "The Photo Layer extent could not be loaded.";
  }
}

// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
function resetToInitialViewport(): void {
  const mapSet = selected.value;
  if (mapSet === null || renderer === null) {
    return;
  }
  const zoomOptions = leafletXyzZoomOptions(mapSet);
  const defaultDisplayZoom = mapSet.defaultZoom - zoomOptions.zoomOffset;
  void applyViewportToAll({
    center: mapSet.defaultCenter,
    zoom: comparisonActive.value
      ? Math.min(
          controlMaximumZoom.value,
          Math.max(controlMinimumZoom.value, defaultDisplayZoom),
        )
      : defaultDisplayZoom,
  });
}

function openGotoCoordinates(): void {
  const mapSet = selected.value;
  if (renderer === null || mapSet === null) {
    return;
  }
  const viewport = renderer.getViewport();
  const zoomOptions = leafletXyzZoomOptions(mapSet);
  gotoInitialCoordinate.value = viewport.center;
  gotoInitialZoom.value = Math.min(
    mapSet.maxZoom,
    Math.max(
      mapSet.minZoom,
      Math.round(viewport.zoom + zoomOptions.zoomOffset),
    ),
  );
  gotoCoordinatesOpen.value = true;
}

// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
async function applyGotoCoordinates(
  coordinate: GeographicCoordinate,
  sourceZoom: number,
): Promise<void> {
  const mapSet = selected.value;
  if (
    renderer === null ||
    mapSet === null ||
    !Number.isInteger(sourceZoom) ||
    sourceZoom < mapSet.minZoom ||
    sourceZoom > mapSet.maxZoom
  ) {
    return;
  }
  const zoomOptions = leafletXyzZoomOptions(mapSet);
  const displayZoom = sourceZoom - zoomOptions.zoomOffset;
  if (
    comparisonActive.value &&
    (displayZoom < controlMinimumZoom.value ||
      displayZoom > controlMaximumZoom.value)
  ) {
    return;
  }
  await applyMapCenter(renderer, coordinate, displayZoom);
  await applyViewportToAll(renderer.getViewport());
  gotoCoordinatesOpen.value = false;
}

function openTileCalculator(): void {
  const mapSet = selected.value;
  if (renderer === null || mapSet === null) {
    return;
  }
  const viewport = renderer.getViewport();
  const zoomOptions = leafletXyzZoomOptions(mapSet);
  tileCalculatorInitialInput.value = {
    longitude: viewport.center.longitude,
    latitude: viewport.center.latitude,
    zoom: Math.min(
      mapSet.maxZoom,
      Math.max(
        mapSet.minZoom,
        Math.round(viewport.zoom + zoomOptions.zoomOffset),
      ),
    ),
  };
  tileCalculatorOpen.value = true;
}

// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
function selectCoordinateFormat(value: string): void {
  if (isCoordinateFormat(value)) {
    coordinateFormat.value = value;
  }
}

function updateComparison(
  patch: Partial<Omit<MapComparisonPreferences, "sources">> & {
    sources?: MapComparisonPreferences["sources"];
  },
): void {
  comparison.value = { ...comparison.value, ...patch };
}

function repairComparisonSources(
  selectPrimary = comparison.value.enabled,
): void {
  if (store.items.length === 0) return;
  const validIds = new Set(store.items.map(({ id }) => id));
  const storedPrimary = comparison.value.sources[0]?.mapSetId;
  const primaryId =
    (storedPrimary !== null &&
    storedPrimary !== undefined &&
    validIds.has(storedPrimary)
      ? storedPrimary
      : null) ??
    (selectedId.value !== null && validIds.has(selectedId.value)
      ? selectedId.value
      : (store.items[0]?.id ?? null));
  const sources = Array.from({ length: 4 }, (_, index) => {
    const existing = comparison.value.sources[index];
    const fallbackId = store.items[index]?.id ?? primaryId;
    return {
      mapSetId:
        existing?.mapSetId !== null &&
        existing?.mapSetId !== undefined &&
        validIds.has(existing.mapSetId)
          ? existing.mapSetId
          : fallbackId,
      tileSelection: existing?.tileSelection ?? { kind: "current" as const },
    };
  });
  updateComparison({ sources });
  if (
    selectPrimary &&
    primaryId !== null &&
    selectedId.value !== sources[0]?.mapSetId
  ) {
    selectedId.value = sources[0]?.mapSetId ?? primaryId;
  }
}

// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
function setComparisonEnabled(enabled: boolean): void {
  if (enabled) repairComparisonSources(true);
  updateComparison({ enabled });
}

// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
function setComparisonCount(count: MapComparisonPreferences["count"]): void {
  updateComparison({ count });
}

// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
function setComparisonMode(mode: MapComparisonMode): void {
  updateComparison({ mode });
}

function updateComparisonSource(index: number, mapSetId: string | null): void {
  const sources = [...comparison.value.sources];
  sources[index] = {
    mapSetId,
    tileSelection: sources[index]?.tileSelection ?? { kind: "current" },
  };
  updateComparison({ sources });
  if (index === 0 && mapSetId !== null && selectedId.value !== mapSetId) {
    selectedId.value = mapSetId;
  }
}

// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
function setVerticalSplit(value: number): void {
  updateComparison({ verticalSplit: value });
}

// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
function setHorizontalSplit(value: number): void {
  updateComparison({ horizontalSplit: value });
}
</script>

<template>
  <main class="map-page">
    <section
      class="map-stage"
      aria-label="Interactive map"
      @contextmenu="openMapContextMenu"
      @keydown="onMapContextMenuKeydown"
    >
      <MapComparisonLayout
        ref="comparisonLayout"
        :active="comparisonActive"
        :count="comparison.count"
        :mode="comparison.mode"
        :vertical-split="comparison.verticalSplit"
        :horizontal-split="comparison.horizontalSplit"
        :labels="comparisonLabels"
        @update:vertical-split="setVerticalSplit"
        @update:horizontal-split="setHorizontalSplit"
        @resize="resizeRenderers"
      />

      <MapZoomControl
        v-if="selected"
        :zoom="controlZoom"
        :minimum="controlMinimumZoom"
        :maximum="controlMaximumZoom"
        auto-close-on-change
        @change="applyMapZoom"
      />

      <div
        v-if="store.items.length > 0 && !comparisonActive"
        class="map-controls"
      >
        <MapSetSelect
          v-if="showMapSelector"
          v-model="selectedId"
          class="map-set-picker"
          :items="store.items"
          variant="plain"
          aria-label="Map Set"
        />
        <HtmlTooltip v-if="selected" label="Map Set information" align="end">
          <template #trigger>
            <i class="mdi mdi-information-outline" aria-hidden="true"></i>
          </template>
          <article class="map-set-card">
            <strong>{{ selected.name }}</strong>
            <dl>
              <div><dt>Renderer</dt><dd>{{ selected.rendererId }}</dd></div>
              <div><dt>Projection</dt><dd>{{ selected.sourceProjection }}</dd></div>
              <div><dt>Source zoom</dt><dd>{{ selected.minZoom }}–{{ selected.maxZoom }}</dd></div>
              <div><dt>Tiles</dt><dd>{{ selected.tileSize }} · {{ selected.tileFormat.toUpperCase() }}</dd></div>
            </dl>
            <button type="button" class="map-set-reset" @click="resetToInitialViewport">
              <i class="mdi mdi-crosshairs-gps" aria-hidden="true"></i>
              Reset to initial view
            </button>
            <!-- Attribution is trusted, administrator-authored Map Set HTML. -->
            <div class="map-set-attribution" v-html="selected.attribution"></div>
            <a v-if="selected.termsUrl" :href="selected.termsUrl" target="_blank" rel="noopener noreferrer">
              Provider terms
              <i class="mdi mdi-open-in-new" aria-hidden="true"></i>
            </a>
          </article>
        </HtmlTooltip>
      </div>

      <div class="map-side-controls">
        <LayerPanel
          ref="layerPanel"
          v-if="selected && !comparisonActive"
          :enabled="selected.capabilities.layerRendering"
          :supported-layer-types="supportedLayerTypes"
          @changed="renderPluginLayers"
          @center-map="centerMapOnPhoto"
          @fit-photo-layer="fitPhotoLayer"
        />
        <MapSideControlButton
          label="Display Options"
          :expanded="displayOptionsOpen"
          @click="displayOptionsOpen = !displayOptionsOpen"
        >
          <i class="mdi mdi-tune" aria-hidden="true"></i>
        </MapSideControlButton>
      </div>

      <DialogWindow
        ref="displayOptionsDialog"
        :open="displayOptionsOpen"
        title="Display Options"
        :is-modal="false"
        initial-position="map-controls"
        @close="displayOptionsOpen = false"
      >
        <div class="display-options">
          <div class="display-tool-actions">
            <button
              type="button"
              class="display-tool-action"
              :disabled="!selected || zoom === null"
              @click="openGotoCoordinates"
            >
              <i class="mdi mdi-crosshairs-gps" aria-hidden="true"></i>
              <span>Goto Coordinates</span>
            </button>
            <button
              type="button"
              class="display-tool-action"
              :disabled="!selected || zoom === null"
              @click="openTileCalculator"
            >
              <i class="mdi mdi-grid" aria-hidden="true"></i>
              <span>Tile Calculator</span>
            </button>
          </div>
          <hr class="options-divider" />
          <MapComparisonOptions
            :value="comparison"
            :map-sets="store.items"
            @enabled="setComparisonEnabled"
            @count="setComparisonCount"
            @mode="setComparisonMode"
            @source="updateComparisonSource"
          />
          <hr class="options-divider" />
          <label class="check-field">
            <input v-model="cachedTilesOnly" type="checkbox" />
            <span>Cached Tiles Only</span>
          </label>
          <hr class="options-divider" />
          <label class="check-field">
            <input v-model="showTitleBar" type="checkbox" />
            <span>Show Title Bar</span>
          </label>
          <label class="check-field">
            <input
              v-model="showMapSelector"
              type="checkbox"
              :disabled="comparisonActive"
            />
            <span>Show Map Selector</span>
          </label>
          <label class="check-field">
            <input v-model="showCoordinates" type="checkbox" />
            <span>Show Coordinates</span>
          </label>
          <label class="check-field">
            <input v-model="showAttribution" type="checkbox" />
            <span>Show Attribution</span>
          </label>
          <label class="check-field">
            <input
              type="checkbox"
              :checked="showTileGrid"
              :disabled="!tileGridAvailable || defaultGridBusy"
              @change="setDefaultGridVisible(($event.target as HTMLInputElement).checked)"
            />
            <span>Show Tile Grid</span>
          </label>
        </div>
      </DialogWindow>

      <div
        class="coordinate-format-toggle"
        :style="{
          visibility: showCoordinates && pointer ? 'visible' : 'hidden',
        }"
      >
        <AppMenuSelect
          :model-value="coordinateFormat"
          :items="coordinateFormatOptions"
          aria-label="Map coordinates"
          align="start"
          variant="coordinates"
          @update:model-value="selectCoordinateFormat"
        >
          <template #selected>{{ formattedPointer }}</template>
        </AppMenuSelect>
      </div>

      <div
        v-if="comparisonActive && showAttribution && comparisonAttributions.length > 0"
        class="comparison-attribution"
        aria-label="Map attributions"
      >
        <span v-for="item in comparisonAttributions" :key="item.attribution">
          <strong>{{ item.name }}:</strong>
          <!-- Attribution is trusted, administrator-authored Map Set HTML. -->
          <span v-html="item.attribution"></span>
        </span>
      </div>

      <div v-if="store.loading" class="map-overlay">Loading Map Sets…</div>
      <div v-else-if="store.loaded && store.items.length === 0" class="map-overlay empty">
        <i class="mdi mdi-map-plus" aria-hidden="true"></i>
        <h2>Create a Map Set to begin</h2>
        <p>maptoy does not configure a public tile provider automatically.</p>
        <RouterLink to="/map-sets">Create Map Set</RouterLink>
      </div>
      <div v-if="mapError" class="map-overlay error" role="alert">{{ mapError }}</div>
    </section>

    <AppContextMenu
      ref="mapContextMenu"
      :items="mapContextMenuItems"
      aria-label="Map view context menu"
      @select="selectMapContextMenuItem"
    />

    <GotoCoordinatesDialog
      :open="gotoCoordinatesOpen"
      :initial-coordinate="gotoInitialCoordinate"
      :initial-zoom="gotoInitialZoom"
      :minimum-zoom="toolMinimumZoom"
      :maximum-zoom="toolMaximumZoom"
      @close="gotoCoordinatesOpen = false"
      @apply="applyGotoCoordinates"
    />

    <TileCalculatorDialog
      :open="tileCalculatorOpen"
      :map-set="selected"
      :initial-input="tileCalculatorInitialInput"
      :cached-tiles-only="cachedTilesOnly"
      @close="tileCalculatorOpen = false"
    />
  </main>
</template>

<style scoped>
.map-page {
  height: 100%;
  min-width: 400px;
  min-height: 400px;
}

.map-controls {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  z-index: 1000;
  display: flex;
  gap: 0.35rem;
  align-items: center;
  padding: 0.35rem;
  border: 1px solid rgb(103 125 116 / 45%);
  border-radius: 0.55rem;
  background: rgb(255 255 255 / 92%);
  box-shadow: 0 0.35rem 1rem rgb(24 54 45 / 18%);
  backdrop-filter: blur(0.3rem);
}

.map-set-picker {
  width: min(18rem, 58vw);
}

.map-set-card > strong {
  display: block;
  margin-bottom: 0.75rem;
  font-size: 1rem;
}

.map-set-card dl {
  display: grid;
  gap: 0.4rem;
  margin: 0;
}

.map-set-card dl div {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
}

.map-set-card dt {
  color: #617870;
}

.map-set-card dd {
  margin: 0;
  font-weight: 700;
}

.map-set-attribution {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid #d7e0db;
  color: #536b64;
  font-size: 0.78rem;
  line-height: 1.4;
}

.map-set-card > a {
  display: inline-flex;
  gap: 0.3rem;
  align-items: center;
  margin-top: 0.7rem;
  color: #17453c;
  font-size: 0.82rem;
  font-weight: 700;
}

.map-set-reset {
  display: inline-flex;
  gap: 0.3rem;
  align-items: center;
  margin-top: 0.7rem;
  padding: 0;
  border: 0;
  color: #17453c;
  background: transparent;
  font: inherit;
  font-size: 0.82rem;
  font-weight: 700;
  cursor: pointer;
}

.map-side-controls {
  position: absolute;
  top: 50%;
  left: 0.75rem;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  align-items: flex-start;
  transform: translateY(-50%);
}

.coordinate-format-toggle {
  position: absolute;
  bottom: 0.75rem;
  left: 0.75rem;
  z-index: 1000;
  display: inline-flex;
}

.comparison-attribution {
  position: absolute;
  right: 0;
  bottom: 0;
  z-index: 1000;
  display: flex;
  max-width: min(72vw, 58rem);
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.15rem 0.65rem;
  padding: 0.2rem 0.35rem;
  color: #2f403c;
  background: rgb(255 255 255 / 82%);
  font-size: 0.68rem;
  line-height: 1.25;
}

.comparison-attribution > span {
  display: inline-flex;
  gap: 0.2rem;
}

.check-field {
  display: flex;
  gap: 0.4rem;
  align-items: center;
  white-space: nowrap;
}

.check-field:has(input:disabled) {
  padding: 0.25rem 0.4rem;
  border-radius: 0.35rem;
  color: #72807a;
  background: #eef2f0;
  cursor: not-allowed;
}

.check-field:has(input:disabled)::after {
  margin-left: auto;
  padding: 0.1rem 0.35rem;
  border-radius: 999px;
  color: #5f6d67;
  background: #dce4e0;
  content: "Unavailable";
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}

.check-field input:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.options-divider {
  margin: 0;
  border: 0;
  border-top: 1px solid #d7e0db;
}

.display-options {
  display: grid;
  gap: 0.5rem;
}

.display-tool-actions {
  display: grid;
  gap: 0.1rem;
}

.display-tool-action {
  display: flex;
  width: 100%;
  min-height: 2rem;
  gap: 0.5rem;
  align-items: center;
  padding: 0.35rem 0.45rem;
  border: 0;
  border-radius: 0.35rem;
  color: #17453c;
  background: transparent;
  font: inherit;
  font-size: 0.85rem;
  font-weight: 700;
  text-align: left;
  cursor: pointer;
}

.display-tool-action:hover,
.display-tool-action:focus-visible {
  background: #dfe9e3;
}

.display-tool-action:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.map-stage {
  position: relative;
  height: 100%;
  min-width: 400px;
  min-height: 400px;
  background: #a6c4b5;
}

.map-overlay {
  position: absolute;
  top: 1rem;
  left: 50%;
  z-index: 500;
  max-width: min(28rem, calc(100% - 2rem));
  padding: 0.8rem 1rem;
  border-radius: 0.6rem;
  background: rgb(255 255 255 / 92%);
  box-shadow: 0 0.75rem 2rem rgb(39 68 57 / 18%);
  transform: translateX(-50%);
}

.map-overlay.empty {
  top: 50%;
  text-align: center;
  transform: translate(-50%, -50%);
}

.map-overlay.empty i {
  color: #a34521;
  font-size: 3rem;
}

.map-overlay.error {
  border-left: 0.25rem solid #b64030;
  background: #ffe9e5;
}

@media (max-width: 700px) {
  .map-controls {
    top: 0.5rem;
    right: 0.5rem;
  }

  .map-set-picker {
    width: min(15rem, 58vw);
  }

  .map-side-controls {
    left: 0.5rem;
  }

  .coordinate-format-toggle {
    bottom: 0.5rem;
    left: 0.5rem;
  }

}
</style>
