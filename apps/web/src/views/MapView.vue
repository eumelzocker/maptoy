<script setup lang="ts">
import { leafletXyzZoomOptions } from "@maptoy/leaflet-xyz";
import type { MapRendererInstance } from "@maptoy/map-adapter-sdk";
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
// biome-ignore lint/correctness/noUnusedImports: referenced by the Vue template
import HtmlTooltip from "../components/HtmlTooltip.vue";
// biome-ignore lint/correctness/noUnusedImports: referenced by the Vue template
import TogglePanel from "../components/TogglePanel.vue";
import {
  loadShowAttribution,
  loadShowCoordinates,
  saveShowAttribution,
  saveShowCoordinates,
} from "../mapDisplayPreferences.js";
import { loadMapViewport, saveMapViewport } from "../mapViewportStorage.js";
import { MAP_RENDERER_FACTORY_REGISTRY_KEY } from "../registries.js";
import { useMapSetsStore } from "../stores/mapSets.js";
import { useUiPreferencesStore } from "../stores/uiPreferences.js";

const injectedFactories = inject(MAP_RENDERER_FACTORY_REGISTRY_KEY);
if (injectedFactories === undefined) {
  throw new Error("Map renderer factory registry is not available.");
}
const factories = injectedFactories;

const store = useMapSetsStore();
const { selected, selectedId } = storeToRefs(store);
const mapHost = ref<HTMLElement | null>(null);
const mapError = ref<string | null>(null);
const pointer = ref<{ longitude: number; latitude: number } | null>(null);
const zoom = ref<number | null>(null);
const showCoordinates = ref(loadShowCoordinates(localStorage));
const showAttribution = ref(loadShowAttribution(localStorage));
const uiPreferences = useUiPreferencesStore();
// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
const showTitleBar = computed({
  get: () => uiPreferences.showTitleBar,
  set: (value) => uiPreferences.setShowTitleBar(value),
});
let renderer: MapRendererInstance | null = null;
let renderGeneration = 0;

watch(showCoordinates, (value) => saveShowCoordinates(value, localStorage));
watch(showAttribution, (value) => {
  saveShowAttribution(value, localStorage);
  void renderer?.setAttributionVisible(value);
});

async function destroyRenderer(): Promise<void> {
  if (renderer !== null) {
    saveMapViewport(localStorage, renderer.getViewport());
    await renderer.destroy();
    renderer = null;
  }
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
      localStorage,
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
        tileUrl: `api/map-sets/${mapSet.id}/tiles/{z}/{x}/{y}`,
        attribution: mapSet.attribution,
        minZoom: mapSet.minZoom,
        maxZoom: mapSet.maxZoom,
        tileSize: mapSet.tileSize,
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
      saveMapViewport(localStorage, viewport);
    });
  } catch (error) {
    mapError.value =
      error instanceof Error
        ? error.message
        : "The map renderer failed to start.";
  }
}

watch(selected, renderSelectedMap);
watch(selectedId, (id) => store.select(id));

onMounted(async () => {
  try {
    await store.load();
  } catch {
    mapError.value = store.error;
  }
});

onBeforeUnmount(destroyRenderer);

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
</script>

<template>
  <main class="map-page">
    <section class="map-stage" aria-label="Interactive map">
      <div ref="mapHost" class="map-host"></div>

      <div v-if="store.items.length > 0" class="map-controls">
        <label>
          <span class="visually-hidden">Map Set</span>
          <select v-model="selectedId" aria-label="Map Set">
            <option v-for="mapSet in store.items" :key="mapSet.id" :value="mapSet.id">
              {{ mapSet.name }}
            </option>
          </select>
        </label>
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
              <div><dt>Tiles</dt><dd>{{ selected.tileSize }} px · {{ selected.tileFormat.toUpperCase() }}</dd></div>
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
        <RouterLink class="manage-link" to="/map-sets" aria-label="Manage Map Sets" title="Manage Map Sets">
          <i class="mdi mdi-cog-outline" aria-hidden="true"></i>
        </RouterLink>
      </div>

      <div class="map-bottom-left">
        <TogglePanel label="Display Options" align="start">
          <template #trigger>
            <i class="mdi mdi-tune" aria-hidden="true"></i>
          </template>
          <strong class="options-heading">Display Options</strong>
          <hr class="options-divider" />
          <label class="check-field">
            <input v-model="showTitleBar" type="checkbox" />
            <span>Show title bar</span>
          </label>
          <label class="check-field">
            <input v-model="showCoordinates" type="checkbox" />
            <span>Show coordinates</span>
          </label>
          <label class="check-field">
            <input v-model="showAttribution" type="checkbox" />
            <span>Show attribution</span>
          </label>
        </TogglePanel>
        <p
          v-if="zoom !== null || pointer"
          class="viewport-status"
          :style="{ visibility: showCoordinates ? 'visible' : 'hidden' }"
          aria-label="Map viewport status"
        >
          <span v-if="zoom !== null">Zoom {{ Math.round(zoom) }}</span>
          <span v-if="pointer" class="coordinates">
            {{ pointer.latitude.toFixed(5) }}, {{ pointer.longitude.toFixed(5) }}
          </span>
        </p>
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

.map-controls select {
  min-width: min(15rem, 55vw);
  min-height: 2.35rem;
  padding: 0.4rem 0.6rem;
  border: 0;
  border-radius: 0.35rem;
  color: #142c28;
  background: transparent;
  font: inherit;
  font-weight: 700;
}

.manage-link {
  display: grid;
  width: 2.35rem;
  height: 2.35rem;
  place-items: center;
  border-radius: 0.35rem;
  color: #163832;
  font-size: 1.25rem;
  text-decoration: none;
}

.manage-link:hover,
.manage-link:focus-visible {
  background: #dfe9e3;
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

.viewport-status {
  display: flex;
  gap: 0.75rem;
  align-items: baseline;
  margin: 0;
  padding: 0.4rem 0.65rem;
  border-radius: 0.4rem;
  color: #f7faf8;
  background: rgb(20 44 40 / 86%);
  box-shadow: 0 0.25rem 0.8rem rgb(24 54 45 / 18%);
  font-size: 0.8rem;
  pointer-events: none;
  white-space: nowrap;
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
  margin: 0.5rem 0;
  border: 0;
  border-top: 1px solid #d7e0db;
}

.coordinates,
.viewport-status {
  font-family: ui-monospace, monospace;
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

  .map-controls select {
    min-width: min(12rem, 55vw);
  }

  .map-bottom-left {
    bottom: 0.5rem;
    left: 0.5rem;
  }
}
</style>
