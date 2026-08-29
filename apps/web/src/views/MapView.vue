<script setup lang="ts">
import { leafletXyzZoomOptions } from "@maptoy/leaflet-xyz";
import type {
  GeographicCoordinate,
  MapLayerDescriptor,
  MapRendererInstance,
} from "@maptoy/map-adapter-sdk";
import type { LayerPluginFrontendHandle } from "@maptoy/layer-plugin-sdk";
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
import GotoCoordinatesDialog from "../components/GotoCoordinatesDialog.vue";
// biome-ignore lint/correctness/noUnusedImports: referenced by the Vue template
import HtmlTooltip from "../components/HtmlTooltip.vue";
// biome-ignore lint/correctness/noUnusedImports: referenced by the Vue template
import LayerPanel from "../components/LayerPanel.vue";
// biome-ignore lint/correctness/noUnusedImports: referenced by the Vue template
import MapSetSelect from "../components/MapSetSelect.vue";
// biome-ignore lint/correctness/noUnusedImports: referenced by the Vue template
import MapZoomControl from "../components/MapZoomControl.vue";
// biome-ignore lint/correctness/noUnusedImports: referenced by the Vue template
import TileCalculatorDialog from "../components/TileCalculatorDialog.vue";
// biome-ignore lint/correctness/noUnusedImports: referenced by the Vue template
import TogglePanel from "../components/TogglePanel.vue";
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
  saveCachedTilesOnly,
  saveCoordinateFormat,
  saveShowAttribution,
  saveShowCoordinates,
  saveShowMapSelector,
} from "../mapDisplayPreferences.js";
import {
  createMapContextMenuItems,
  mapContextMenuIds,
} from "../mapContextMenuItems.js";
import type { MenuItem } from "../menuModels.js";
import { mapDocumentTitle } from "../mapDocumentTitle.js";
import { mapTileUrl } from "../mapTileUrl.js";
import { availableLocalStorage } from "../localStorage.js";
import { applyMapCenter } from "../mapViewportActions.js";
import { loadMapViewport, saveMapViewport } from "../mapViewportStorage.js";
import {
  LAYER_PLUGIN_REGISTRY_KEY,
  MAP_RENDERER_FACTORY_REGISTRY_KEY,
} from "../registries.js";
import { useLayersStore } from "../stores/layers.js";
import { useMapSetsStore } from "../stores/mapSets.js";
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
const layers = useLayersStore();
const { selected, selectedId } = storeToRefs(store);
const mapHost = ref<HTMLElement | null>(null);
const mapError = ref<string | null>(null);
const pointer = ref<{ longitude: number; latitude: number } | null>(null);
const zoom = ref<number | null>(null);
const browserStorage = availableLocalStorage();
const cachedTilesOnly = ref(loadCachedTilesOnly(browserStorage));
const showCoordinates = ref(loadShowCoordinates(browserStorage));
const coordinateFormat = ref<CoordinateFormat>(
  loadCoordinateFormat(browserStorage),
);
const showAttribution = ref(loadShowAttribution(browserStorage));
const showMapSelector = ref(loadShowMapSelector(browserStorage));
const displayOptionsPanel = ref<{ close: () => void } | null>(null);
const gotoCoordinatesOpen = ref(false);
const gotoInitialCoordinate = ref<GeographicCoordinate>({
  longitude: 0,
  latitude: 0,
});
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
// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
const controlZoom = computed(() =>
  selected.value === null || zoom.value === null
    ? null
    : zoom.value + leafletXyzZoomOptions(selected.value).zoomOffset,
);
// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
const mapContextMenuItems = computed(() =>
  createMapContextMenuItems({
    mapSets: store.items,
    selectedMapSetId: selectedId.value,
    minimumZoom: selected.value?.minZoom ?? null,
    maximumZoom: selected.value?.maxZoom ?? null,
    currentZoom:
      selected.value === null || zoom.value === null
        ? null
        : Math.round(
            zoom.value + leafletXyzZoomOptions(selected.value).zoomOffset,
          ),
    documentationLanguage,
    documentationPages: documentation.pages.filter(
      ({ requestedLanguage }) => requestedLanguage === documentationLanguage,
    ),
    toolsEnabled: selected.value !== null && zoom.value !== null,
    cachedTilesOnly: cachedTilesOnly.value,
    showTitleBar: showTitleBar.value,
    showMapSelector: showMapSelector.value,
    showCoordinates: showCoordinates.value,
    showAttribution: showAttribution.value,
  }),
);
let renderer: MapRendererInstance | null = null;
let renderGeneration = 0;
const layerHandles = new Map<string, LayerPluginFrontendHandle>();
const attachedLayerIds = new Set<string>();
const publishedLayers = new Map<string, MapLayerDescriptor>();
let layerOperation: Promise<void> = Promise.resolve();

watch(showCoordinates, (value) => saveShowCoordinates(value, browserStorage));
watch(coordinateFormat, (value) => saveCoordinateFormat(value, browserStorage));
watch(showMapSelector, (value) => saveShowMapSelector(value, browserStorage));
watch(cachedTilesOnly, (value) => {
  saveCachedTilesOnly(value, browserStorage);
  void renderSelectedMap();
});
watch(showAttribution, (value) => {
  saveShowAttribution(value, browserStorage);
  void renderer?.setAttributionVisible(value);
});

async function destroyRenderer(): Promise<void> {
  const activeRenderer = renderer;
  renderer = null;
  for (const handle of layerHandles.values()) {
    await handle.destroy();
  }
  layerHandles.clear();
  attachedLayerIds.clear();
  publishedLayers.clear();
  layerOperation = Promise.resolve();
  if (activeRenderer !== null) {
    saveMapViewport(browserStorage, activeRenderer.getViewport());
    await activeRenderer.destroy();
  }
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
    const assets = (layers.assetsByLayer[layer.id] ?? []).map((asset) => ({
      id: asset.id,
      status: asset.status,
      fileName: asset.fileName,
      ...(asset.previewAvailable
        ? { previewUrl: `api/layers/${layer.id}/assets/${asset.id}` }
        : {}),
      longitude: asset.longitude,
      latitude: asset.latitude,
      ...(asset.bounds === null ? {} : { bounds: asset.bounds }),
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
      const next = {
        ...published,
        visible: layerIsVisibleAtCurrentZoom(layer),
      };
      publishedLayers.set(layer.id, next);
      await activeRenderer.updateLayer(next);
    }),
  );
}

async function renderSelectedMap(): Promise<void> {
  const generation = ++renderGeneration;
  await destroyRenderer();
  mapError.value = null;
  pointer.value = null;
  zoom.value = null;
  await nextTick();
  if (generation !== renderGeneration) {
    return;
  }
  const mapSet = selected.value;
  if (mapSet === null || mapHost.value === null) {
    return;
  }
  if (!mapSet.capabilities.interactive) {
    mapError.value = "Interactive display is disabled for this Map Set.";
    return;
  }
  const factory = factories.get(mapSet.rendererId);
  if (factory === undefined) {
    mapError.value = `Renderer adapter ${mapSet.rendererId} is unavailable.`;
    return;
  }
  try {
    const zoomOptions = leafletXyzZoomOptions(mapSet);
    const initialViewport = loadMapViewport(
      browserStorage,
      {
        center: mapSet.defaultCenter,
        zoom: mapSet.defaultZoom - zoomOptions.zoomOffset,
      },
      zoomOptions.minZoom,
      zoomOptions.maxZoom,
    );
    const nextRenderer = await factory.create({
      host: mapHost.value,
      initialViewport,
      configuration: {
        tileUrl: mapTileUrl({
          mapSetId: mapSet.id,
          cachedTilesOnly: cachedTilesOnly.value,
          displayGeneration: generation,
        }),
        attribution: mapSet.attribution,
        minZoom: mapSet.minZoom,
        maxZoom: mapSet.maxZoom,
        tileSize: mapSet.tileSize,
        zoomControl: false,
      },
    });
    if (generation !== renderGeneration) {
      await nextRenderer.destroy();
      return;
    }
    renderer = nextRenderer;
    zoom.value = nextRenderer.getViewport().zoom;
    await nextRenderer.setAttributionVisible(showAttribution.value);
    nextRenderer.subscribe("pointer", (payload) => {
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
    nextRenderer.subscribe("viewport", () => {
      const viewport = nextRenderer.getViewport();
      zoom.value = viewport.zoom;
      saveMapViewport(browserStorage, viewport);
      void refreshLayerZoomVisibility();
    });
    if (mapSet.capabilities.layerRendering) {
      if (!layers.loaded) {
        await layers.load();
      }
      if (generation === renderGeneration && renderer === nextRenderer) {
        await renderPluginLayers();
      }
    }
  } catch (error) {
    mapError.value =
      error instanceof Error
        ? error.message
        : "The map renderer failed to start.";
  }
}

watch(selected, renderSelectedMap);
watch(
  selected,
  (mapSet) => {
    document.title = mapDocumentTitle(mapSet?.name ?? null);
  },
  { immediate: true },
);
watch(selectedId, (id) => store.select(id));

onMounted(async () => {
  try {
    await store.load();
  } catch {
    mapError.value = store.error;
  }
});

onBeforeUnmount(destroyRenderer);
onBeforeUnmount(() => {
  document.title = mapDocumentTitle(null);
});

// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
function openMapContextMenu(event: MouseEvent): void {
  event.preventDefault();
  displayOptionsPanel.value?.close();
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
  displayOptionsPanel.value?.close();
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
  } else if (item.id === mapContextMenuIds.cachedTilesOnly) {
    cachedTilesOnly.value = !cachedTilesOnly.value;
  } else if (item.id === mapContextMenuIds.showTitleBar) {
    showTitleBar.value = !showTitleBar.value;
  } else if (item.id === mapContextMenuIds.showMapSelector) {
    showMapSelector.value = !showMapSelector.value;
  } else if (item.id === mapContextMenuIds.showCoordinates) {
    showCoordinates.value = !showCoordinates.value;
  } else if (item.id === mapContextMenuIds.showAttribution) {
    showAttribution.value = !showAttribution.value;
  }
}

async function applyMapZoom(sourceZoom: number): Promise<void> {
  const mapSet = selected.value;
  if (
    renderer === null ||
    mapSet === null ||
    sourceZoom < mapSet.minZoom ||
    sourceZoom > mapSet.maxZoom
  ) {
    return;
  }
  const viewport = renderer.getViewport();
  const zoomOptions = leafletXyzZoomOptions(mapSet);
  await renderer.setViewport({
    center: viewport.center,
    zoom: sourceZoom - zoomOptions.zoomOffset,
  });
  zoom.value = renderer.getViewport().zoom;
  saveMapViewport(browserStorage, renderer.getViewport());
}

// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
function resetToInitialViewport(): void {
  const mapSet = selected.value;
  if (mapSet === null || renderer === null) {
    return;
  }
  const zoomOptions = leafletXyzZoomOptions(mapSet);
  void renderer.setViewport({
    center: mapSet.defaultCenter,
    zoom: mapSet.defaultZoom - zoomOptions.zoomOffset,
  });
}

function openGotoCoordinates(): void {
  if (renderer === null) {
    return;
  }
  const viewport = renderer.getViewport();
  gotoInitialCoordinate.value = viewport.center;
  displayOptionsPanel.value?.close();
  gotoCoordinatesOpen.value = true;
}

// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
async function applyGotoCoordinates(
  coordinate: GeographicCoordinate,
): Promise<void> {
  if (renderer === null) {
    return;
  }
  await applyMapCenter(renderer, coordinate);
  saveMapViewport(browserStorage, renderer.getViewport());
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
  displayOptionsPanel.value?.close();
  tileCalculatorOpen.value = true;
}

// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
function selectCoordinateFormat(value: string): void {
  if (isCoordinateFormat(value)) {
    coordinateFormat.value = value;
  }
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
      <div ref="mapHost" class="map-host"></div>

      <MapZoomControl
        v-if="selected"
        :zoom="controlZoom"
        :minimum="selected.minZoom"
        :maximum="selected.maxZoom"
        auto-close-on-change
        @change="applyMapZoom"
      />

      <div v-if="store.items.length > 0" class="map-controls">
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

      <div class="map-bottom-left">
        <LayerPanel
          v-if="selected"
          :enabled="selected.capabilities.layerRendering"
          @changed="renderPluginLayers"
        />
        <TogglePanel ref="displayOptionsPanel" label="Display Options" align="start">
          <template #trigger>
            <i class="mdi mdi-tune" aria-hidden="true"></i>
          </template>
          <strong class="options-heading">Display Options</strong>
          <hr class="options-divider" />
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
            <input v-model="showMapSelector" type="checkbox" />
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
        </TogglePanel>
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
      @close="gotoCoordinatesOpen = false"
      @apply="applyGotoCoordinates"
    />

    <TileCalculatorDialog
      :open="tileCalculatorOpen"
      :map-set="selected"
      :initial-input="tileCalculatorInitialInput"
      @close="tileCalculatorOpen = false"
    />
  </main>
</template>

<style scoped>
.map-page {
  height: 100%;
  min-height: 0;
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

.map-bottom-left {
  position: absolute;
  bottom: 0.75rem;
  left: 0.75rem;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  align-items: flex-start;
}

.coordinate-format-toggle {
  display: inline-flex;
}

.check-field {
  display: flex;
  gap: 0.4rem;
  align-items: center;
  white-space: nowrap;
}

.options-heading {
  display: block;
  font-size: 0.85rem;
}

.options-divider {
  margin: 0;
  border: 0;
  border-top: 1px solid #d7e0db;
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
  min-width: 0;
  min-height: 0;
  background: #a6c4b5;
}

.map-host {
  width: 100%;
  height: 100%;
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

  .map-bottom-left {
    bottom: 0.5rem;
    left: 0.5rem;
  }

}
</style>
