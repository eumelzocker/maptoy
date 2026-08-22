<script setup lang="ts">
import type { MapRendererInstance } from "@maptoy/map-adapter-sdk";
import { storeToRefs } from "pinia";
import { inject, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { MAP_RENDERER_FACTORY_REGISTRY_KEY } from "../registries.js";
import { useMapSetsStore } from "../stores/mapSets.js";

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
let renderer: MapRendererInstance | null = null;
let renderGeneration = 0;

async function destroyRenderer(): Promise<void> {
  if (renderer !== null) {
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
    const nextRenderer = await factory.create({
      host: mapHost.value,
      initialViewport: {
        center: mapSet.defaultCenter,
        zoom: mapSet.defaultZoom,
      },
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
    nextRenderer.subscribe("viewport", (payload) => {
      if (
        typeof payload === "object" &&
        payload !== null &&
        "viewport" in payload &&
        typeof payload.viewport === "object" &&
        payload.viewport !== null &&
        "zoom" in payload.viewport &&
        typeof payload.viewport.zoom === "number"
      ) {
        zoom.value = payload.viewport.zoom;
      }
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
</script>

<template>
  <main class="map-page">
    <aside class="map-toolbar">
      <div>
        <p class="eyebrow">Interactive map</p>
        <h1>Map</h1>
      </div>
      <label v-if="store.items.length > 0">
        <span>Map Set</span>
        <select v-model="selectedId">
          <option v-for="mapSet in store.items" :key="mapSet.id" :value="mapSet.id">
            {{ mapSet.name }}
          </option>
        </select>
      </label>
      <RouterLink class="manage-link" to="/map-sets">
        <i class="mdi mdi-map-cog" aria-hidden="true"></i>
        Manage Map Sets
      </RouterLink>
      <dl v-if="selected" class="map-details">
        <div>
          <dt>Renderer</dt>
          <dd>{{ selected.rendererId }}</dd>
        </div>
        <div>
          <dt>Projection</dt>
          <dd>{{ selected.sourceProjection }}</dd>
        </div>
        <div>
          <dt>Zoom range</dt>
          <dd>{{ selected.minZoom }}–{{ selected.maxZoom }}</dd>
        </div>
      </dl>
      <p v-if="zoom !== null || pointer" class="viewport-status">
        <span v-if="zoom !== null">Zoom {{ Math.round(zoom) }}</span>
        <span v-if="pointer" class="coordinates">
          {{ pointer.latitude.toFixed(5) }}, {{ pointer.longitude.toFixed(5) }}
        </span>
      </p>
    </aside>

    <section class="map-stage" aria-label="Interactive map">
      <div v-if="store.loading" class="map-overlay">Loading Map Sets…</div>
      <div v-else-if="store.loaded && store.items.length === 0" class="map-overlay empty">
        <i class="mdi mdi-map-plus" aria-hidden="true"></i>
        <h2>Create a Map Set to begin</h2>
        <p>maptoy does not configure a public tile provider automatically.</p>
        <RouterLink to="/map-sets">Create Map Set</RouterLink>
      </div>
      <div v-if="mapError" class="map-overlay error" role="alert">{{ mapError }}</div>
      <div ref="mapHost" class="map-host"></div>
    </section>
  </main>
</template>

<style scoped>
.map-page {
  display: grid;
  grid-template-columns: minmax(13rem, 18rem) minmax(0, 1fr);
  height: 100%;
  min-height: 0;
}

.map-toolbar {
  z-index: 2;
  padding: 1.5rem;
  overflow-y: auto;
  border-right: 1px solid #b6c6bc;
  background: #edf2ee;
}

h1 {
  margin: 0 0 1.5rem;
  font-family: Georgia, "Times New Roman", serif;
  font-size: 2.5rem;
  font-weight: 500;
}

label {
  display: grid;
  gap: 0.4rem;
  color: #314f47;
  font-size: 0.82rem;
  font-weight: 800;
}

select {
  width: 100%;
  min-height: 2.6rem;
  padding: 0.5rem;
  border: 1px solid #9eb1a7;
  border-radius: 0.45rem;
  background: #fff;
  font: inherit;
}

.manage-link {
  display: inline-flex;
  gap: 0.4rem;
  margin-top: 1rem;
}

.map-details {
  display: grid;
  gap: 0.7rem;
  margin-top: 2rem;
}

.map-details div {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  padding-bottom: 0.45rem;
  border-bottom: 1px solid #c5d2ca;
}

.map-details dt {
  color: #597068;
}

.map-details dd {
  margin: 0;
  font-weight: 700;
}

.viewport-status {
  display: flex;
  gap: 0.75rem;
  align-items: baseline;
  font-size: 0.8rem;
}

.coordinates,
.viewport-status {
  font-family: ui-monospace, monospace;
}

.map-stage {
  position: relative;
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
  .map-page {
    grid-template-columns: 1fr;
    grid-template-rows: auto minmax(25rem, 1fr);
  }

  .map-toolbar {
    padding: 1rem;
    border-right: 0;
    border-bottom: 1px solid #b6c6bc;
  }

  .map-details {
    display: none;
  }
}
</style>
