<script setup lang="ts">
import { leafletXyzZoomOptions } from "@maptoy/leaflet-xyz";
import type {
  CacheSnapshot,
  CacheSnapshotListResponse,
  CoverageCell,
  CoverageResponse,
  CoverageSelection,
  MapSetListItem,
} from "@maptoy/contracts";
import type { MapRendererInstance } from "@maptoy/map-adapter-sdk";
import {
  computed,
  inject,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from "vue";
import { useRoute, useRouter } from "vue-router";
import { apiRequest } from "../api.js";
// biome-ignore lint/correctness/noUnusedImports: referenced by the Vue template
import MapSetSelect from "../components/MapSetSelect.vue";
import {
  type CoveragePagePreferences,
  loadCoveragePagePreferences,
  saveCoveragePagePreferences,
} from "../coveragePreferences.js";
import {
  COVERAGE_LAYER_ID,
  // biome-ignore lint/correctness/noUnusedImports: referenced by the Vue template
  COVERAGE_STATUS_SCALES,
  type CoveragePreviewViewport,
  constrainedCoveragePreviewViewport,
  constrainedCoverageSourceZoom,
  coverageGridZoom,
  coverageLayer,
  coveragePreviewZoomRange,
  coverageSelection,
  coverageViewportZoom,
  hasCoveragePreviewZoomRange,
  visibleCoverageBounds,
} from "../coverageModel.js";
import { mapTileUrl } from "../mapTileUrl.js";
import { availableLocalStorage } from "../localStorage.js";
import { MAP_RENDERER_FACTORY_REGISTRY_KEY } from "../registries.js";
import { useMapSetsStore } from "../stores/mapSets.js";

const injectedFactories = inject(MAP_RENDERER_FACTORY_REGISTRY_KEY);
if (injectedFactories === undefined) {
  throw new Error("Map renderer factory registry is not available.");
}
const factories = injectedFactories;

const route = useRoute();
const router = useRouter();
const store = useMapSetsStore();
const browserStorage = availableLocalStorage();
const selectedId = ref<string | null>(null);
const selected = computed(
  () => store.items.find((mapSet) => mapSet.id === selectedId.value) ?? null,
);
const mapHost = ref<HTMLElement | null>(null);
const snapshots = ref<CacheSnapshot[]>([]);
const sourceZoom = ref(0);
const previewZoom = ref<number | null>(null);
const previewViewport = ref<CoveragePreviewViewport | null>(null);
const selectionMode = ref<CoverageSelection["kind"]>("current");
const selectionSnapshotId = ref("");
const selectionTimestamp = ref(new Date().toISOString().slice(0, 16));
const compareEnabled = ref(false);
const comparisonMode = ref<CoverageSelection["kind"]>("snapshot");
const comparisonSnapshotId = ref("");
const comparisonTimestamp = ref(new Date().toISOString().slice(0, 16));
const response = ref<CoverageResponse | null>(null);
const selectedCell = ref<CoverageCell | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);
const inspectingCell = ref(false);
const rendererReady = ref(false);
let renderer: MapRendererInstance | null = null;
let layerAttached = false;
let renderGeneration = 0;
let snapshotLoadGeneration = 0;
let queryGeneration = 0;
let refreshTimer: number | null = null;
let mounted = false;
let suppressViewportQuery = false;
let adjustingPreviewZoom = false;
let preferencesReady = false;
let rendererTransition: Promise<void> = Promise.resolve();

const selectionsReady = computed(
  () =>
    (selectionMode.value !== "snapshot" || selectionSnapshotId.value !== "") &&
    (!compareEnabled.value ||
      comparisonMode.value !== "snapshot" ||
      comparisonSnapshotId.value !== ""),
);
const canQuery = computed(
  () =>
    selected.value?.capabilities.tileArchive &&
    rendererReady.value &&
    selectionsReady.value,
);

// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
function formatNumber(value: number): string {
  return new Intl.NumberFormat().format(value);
}

// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  const units = ["KiB", "MiB", "GiB", "TiB"];
  let size = value / 1024;
  let unit = units[0] ?? "KiB";
  for (let index = 1; size >= 1024 && index < units.length; index += 1) {
    size /= 1024;
    unit = units[index] ?? unit;
  }
  return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(size)} ${unit}`;
}

// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
function formatDate(value: string | null): string {
  return value === null ? "—" : new Date(value).toLocaleString();
}

// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
function formatZoom(value: number | null): string {
  return value === null
    ? "—"
    : new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(
        value,
      );
}

function timestampInputNow(): string {
  return new Date().toISOString().slice(0, 16);
}

function validTimestampInput(value: string): boolean {
  return value !== "" && !Number.isNaN(new Date(value).getTime());
}

function defaultCoveragePreferences(
  mapSet: MapSetListItem | null,
): CoveragePagePreferences {
  const fallbackTimestamp = timestampInputNow();
  const minimumSourceZoom = (mapSet?.minZoom ?? 0) + 1;
  return {
    selectedMapSetId: mapSet?.id ?? null,
    previewViewport: null,
    sourceZoom:
      mapSet === null
        ? minimumSourceZoom
        : Math.min(
            mapSet.maxZoom,
            Math.max(minimumSourceZoom, Math.round(mapSet.defaultZoom)),
          ),
    selectionMode: "current",
    selectionSnapshotId: "",
    selectionTimestamp: fallbackTimestamp,
    compareEnabled: false,
    comparisonMode: "snapshot",
    comparisonSnapshotId: "",
    comparisonTimestamp: fallbackTimestamp,
  };
}

function applyCoveragePreferences(stored: CoveragePagePreferences): void {
  const fallbackTimestamp = timestampInputNow();
  sourceZoom.value = stored.sourceZoom;
  previewViewport.value = stored.previewViewport;
  selectionMode.value = stored.selectionMode;
  selectionSnapshotId.value = stored.selectionSnapshotId;
  selectionTimestamp.value = validTimestampInput(stored.selectionTimestamp)
    ? stored.selectionTimestamp
    : fallbackTimestamp;
  compareEnabled.value = stored.compareEnabled;
  comparisonMode.value = stored.comparisonMode;
  comparisonSnapshotId.value = stored.comparisonSnapshotId;
  comparisonTimestamp.value = validTimestampInput(stored.comparisonTimestamp)
    ? stored.comparisonTimestamp
    : fallbackTimestamp;
}

function constrainCoveragePreferences(mapSet: MapSetListItem): void {
  sourceZoom.value = constrainedCoverageSourceZoom(
    sourceZoom.value,
    mapSet.minZoom,
    mapSet.maxZoom,
  );
}

function saveCurrentCoveragePreferences(): void {
  if (!preferencesReady) return;
  saveCoveragePagePreferences(
    {
      selectedMapSetId: selectedId.value,
      previewViewport: previewViewport.value,
      sourceZoom: sourceZoom.value,
      selectionMode: selectionMode.value,
      selectionSnapshotId: selectionSnapshotId.value,
      selectionTimestamp: selectionTimestamp.value,
      compareEnabled: compareEnabled.value,
      comparisonMode: comparisonMode.value,
      comparisonSnapshotId: comparisonSnapshotId.value,
      comparisonTimestamp: comparisonTimestamp.value,
    },
    browserStorage,
  );
}

function activeSelection(): CoverageSelection {
  return coverageSelection(
    selectionMode.value,
    selectionSnapshotId.value,
    selectionTimestamp.value,
  );
}

function updatePreviewViewport(
  activeRenderer: MapRendererInstance,
  mapSet: MapSetListItem,
): number {
  const viewport = activeRenderer.getViewport();
  const zoomOffset = leafletXyzZoomOptions(mapSet).zoomOffset;
  const gridZoom = coverageGridZoom(viewport.zoom, zoomOffset);
  previewZoom.value = gridZoom;
  previewViewport.value = {
    center: { ...viewport.center },
    gridZoom,
  };
  return gridZoom;
}

function activeComparison(): CoverageSelection | undefined {
  return compareEnabled.value
    ? coverageSelection(
        comparisonMode.value,
        comparisonSnapshotId.value,
        comparisonTimestamp.value,
      )
    : undefined;
}

async function destroyRenderer(): Promise<void> {
  if (refreshTimer !== null) {
    window.clearTimeout(refreshTimer);
    refreshTimer = null;
  }
  if (renderer !== null) {
    await renderer.destroy();
    renderer = null;
  }
  rendererReady.value = false;
  previewZoom.value = null;
  layerAttached = false;
}

async function loadSnapshots(): Promise<boolean> {
  const generation = ++snapshotLoadGeneration;
  const mapSetId = selectedId.value;
  snapshots.value = [];
  if (mapSetId === null) return generation === snapshotLoadGeneration;
  const result = await apiRequest<CacheSnapshotListResponse>(
    `api/map-sets/${mapSetId}/snapshots`,
  );
  if (generation !== snapshotLoadGeneration || selectedId.value !== mapSetId) {
    return false;
  }
  snapshots.value = result.items;
  const firstSnapshotId = result.items[0]?.id ?? "";
  const hasSnapshot = (id: string): boolean =>
    result.items.some((snapshot) => snapshot.id === id);
  if (!hasSnapshot(selectionSnapshotId.value)) {
    selectionSnapshotId.value = firstSnapshotId;
  }
  if (!hasSnapshot(comparisonSnapshotId.value)) {
    comparisonSnapshotId.value = firstSnapshotId;
  }
  return true;
}

function renderMap(): Promise<void> {
  const generation = ++renderGeneration;
  const transition = rendererTransition.then(() =>
    renderMapGeneration(generation),
  );
  rendererTransition = transition.catch(() => undefined);
  return transition;
}

async function renderMapGeneration(generation: number): Promise<void> {
  await destroyRenderer();
  response.value = null;
  selectedCell.value = null;
  error.value = null;
  await nextTick();
  const mapSet = selected.value;
  if (
    generation !== renderGeneration ||
    mapSet === null ||
    mapHost.value === null
  ) {
    return;
  }
  if (!mapSet.capabilities.interactive || !mapSet.capabilities.tileArchive) {
    error.value =
      "Coverage requires interactive display and Tile Archive capabilities.";
    return;
  }
  if (!hasCoveragePreviewZoomRange(mapSet.minZoom, mapSet.maxZoom)) {
    error.value =
      "Coverage requires a Map Set with at least two configured source zoom levels.";
    return;
  }
  constrainCoveragePreferences(mapSet);
  const factory = factories.get(mapSet.rendererId);
  if (factory === undefined) {
    error.value = `Renderer adapter ${mapSet.rendererId} is unavailable.`;
    return;
  }
  try {
    const zoomOptions = leafletXyzZoomOptions(mapSet);
    const minimumSourceZoom = mapSet.minZoom + 1;
    const initialViewport = constrainedCoveragePreviewViewport(
      previewViewport.value ?? {
        center: mapSet.defaultCenter,
        gridZoom: mapSet.defaultZoom,
      },
      minimumSourceZoom - 1,
      sourceZoom.value - 1,
    );
    previewViewport.value = initialViewport;
    const nextRenderer = await factory.create({
      host: mapHost.value,
      initialViewport: {
        center: initialViewport.center,
        zoom: coverageViewportZoom(
          initialViewport.gridZoom,
          zoomOptions.zoomOffset,
        ),
      },
      configuration: {
        tileUrl: mapTileUrl({
          mapSetId: mapSet.id,
          cachedTilesOnly: true,
          displayGeneration: generation,
        }),
        attribution: mapSet.attribution,
        minZoom: mapSet.minZoom,
        maxZoom: mapSet.maxZoom,
        tileSize: mapSet.tileSize,
        showZoomLevelControl: true,
        shiftClickIntegerZoom: true,
      },
    });
    if (generation !== renderGeneration) {
      await nextRenderer.destroy();
      return;
    }
    renderer = nextRenderer;
    await applyPreviewZoomRange(sourceZoom.value);
    rendererReady.value = true;
    updatePreviewViewport(nextRenderer, mapSet);
    nextRenderer.subscribe("viewport", onViewportChanged);
    nextRenderer.subscribe("selection", (payload) => {
      if (
        typeof payload === "object" &&
        payload !== null &&
        "layerId" in payload &&
        payload.layerId === COVERAGE_LAYER_ID &&
        "featureId" in payload &&
        typeof payload.featureId === "string"
      ) {
        selectedCell.value =
          response.value?.cells.find(({ id }) => id === payload.featureId) ??
          null;
      }
    });
    await queryVisibleCoverage();
  } catch (cause) {
    error.value =
      cause instanceof Error
        ? cause.message
        : "Coverage could not be displayed.";
  }
}

function clearCoverageResult(): void {
  queryGeneration += 1;
  loading.value = false;
  response.value = null;
  selectedCell.value = null;
  if (renderer !== null && layerAttached) {
    layerAttached = false;
    void renderer.removeLayer(COVERAGE_LAYER_ID);
  }
}

function onViewportChanged(): void {
  const mapSet = selected.value;
  if (renderer !== null && mapSet !== null) {
    const gridZoom = updatePreviewViewport(renderer, mapSet);
    if (!adjustingPreviewZoom && gridZoom > sourceZoom.value - 1) {
      void applyPreviewZoomRange(sourceZoom.value);
      return;
    }
  }
  if (adjustingPreviewZoom) return;
  if (suppressViewportQuery) {
    suppressViewportQuery = false;
    return;
  }
  inspectingCell.value = false;
  if (refreshTimer !== null) window.clearTimeout(refreshTimer);
  refreshTimer = window.setTimeout(() => void queryVisibleCoverage(), 250);
}

async function applyPreviewZoomRange(value: number): Promise<void> {
  const activeRenderer = renderer;
  const mapSet = selected.value;
  if (activeRenderer === null || mapSet === null) return;
  const zoomOffset = leafletXyzZoomOptions(mapSet).zoomOffset;
  const range = coveragePreviewZoomRange(value, mapSet.minZoom + 1, zoomOffset);
  adjustingPreviewZoom = true;
  try {
    await activeRenderer.setZoomRange?.(range);
    const viewport = activeRenderer.getViewport();
    const constrainedZoom = Math.min(
      range.maximum,
      Math.max(range.minimum, viewport.zoom),
    );
    if (constrainedZoom !== viewport.zoom) {
      await activeRenderer.setViewport({
        center: viewport.center,
        zoom: constrainedZoom,
      });
    }
    if (renderer === activeRenderer) {
      updatePreviewViewport(activeRenderer, mapSet);
    }
  } finally {
    adjustingPreviewZoom = false;
  }
}

async function executeQuery(
  bounds: CoverageResponse["bounds"],
  maximumCells = 1024,
): Promise<void> {
  const mapSet = selected.value;
  const activeRenderer = renderer;
  if (mapSet === null || activeRenderer === null) return;
  const generation = ++queryGeneration;
  loading.value = true;
  error.value = null;
  try {
    const compareTo = activeComparison();
    const result = await apiRequest<CoverageResponse>(
      `api/map-sets/${mapSet.id}/coverage/query`,
      {
        method: "POST",
        body: JSON.stringify({
          bounds,
          zoom: sourceZoom.value,
          selection: activeSelection(),
          ...(compareTo === undefined ? {} : { compareTo }),
          maximumCells,
        }),
      },
    );
    if (generation !== queryGeneration || renderer !== activeRenderer) return;
    response.value = result;
    selectedCell.value = null;
    const layer = coverageLayer(result);
    if (layerAttached) {
      await activeRenderer.updateLayer(layer);
    } else {
      await activeRenderer.attachLayer(layer);
      layerAttached = true;
    }
  } catch (cause) {
    if (generation === queryGeneration) {
      error.value =
        cause instanceof Error ? cause.message : "Coverage query failed.";
    }
  } finally {
    if (generation === queryGeneration) loading.value = false;
  }
}

async function queryVisibleCoverage(): Promise<void> {
  inspectingCell.value = false;
  if (!canQuery.value || renderer === null || mapHost.value === null) return;
  await executeQuery(
    visibleCoverageBounds(
      renderer,
      mapHost.value.clientWidth,
      mapHost.value.clientHeight,
    ),
  );
}

async function onSourceZoomChanged(value: number): Promise<void> {
  const mapSet = selected.value;
  if (
    !mounted ||
    mapSet === null ||
    renderer === null ||
    !Number.isInteger(value) ||
    value < mapSet.minZoom + 1 ||
    value > mapSet.maxZoom
  ) {
    return;
  }
  if (refreshTimer !== null) {
    window.clearTimeout(refreshTimer);
    refreshTimer = null;
  }
  clearCoverageResult();
  await applyPreviewZoomRange(value);
  await queryVisibleCoverage();
}

// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
async function inspectTiles(cell: CoverageCell): Promise<void> {
  if (renderer === null || selected.value === null) return;
  inspectingCell.value = true;
  const center = {
    longitude: (cell.bounds.west + cell.bounds.east) / 2,
    latitude: (cell.bounds.south + cell.bounds.north) / 2,
  };
  const zoomOptions = leafletXyzZoomOptions(selected.value);
  const range = coveragePreviewZoomRange(
    sourceZoom.value,
    selected.value.minZoom + 1,
    zoomOptions.zoomOffset,
  );
  suppressViewportQuery = true;
  await renderer.setViewport({
    center,
    zoom: range.maximum,
  });
  updatePreviewViewport(renderer, selected.value);
  suppressViewportQuery = false;
  await executeQuery(cell.bounds, 4096);
}

async function onMapSetChanged(): Promise<void> {
  if (!mounted) return;
  const id = selectedId.value;
  await router.replace(id === null ? "/coverage" : `/coverage/${id}`);
  try {
    if (!(await loadSnapshots())) return;
    await renderMap();
  } catch (cause) {
    error.value =
      cause instanceof Error ? cause.message : "Coverage could not be loaded.";
  }
}

watch(selectedId, onMapSetChanged);
watch(sourceZoom, (value) => void onSourceZoomChanged(value));
watch(
  [
    selectedId,
    sourceZoom,
    previewViewport,
    selectionMode,
    selectionSnapshotId,
    selectionTimestamp,
    compareEnabled,
    comparisonMode,
    comparisonSnapshotId,
    comparisonTimestamp,
  ],
  saveCurrentCoveragePreferences,
);

onMounted(async () => {
  try {
    await store.load();
    const requestedMapSetId =
      typeof route.params.mapSetId === "string" &&
      store.items.some(({ id }) => id === route.params.mapSetId)
        ? route.params.mapSetId
        : null;
    const fallbackMapSet =
      store.items.find(({ id }) => id === requestedMapSetId) ??
      store.items.find(({ id }) => id === store.selectedId) ??
      store.items[0] ??
      null;
    const stored = loadCoveragePagePreferences(
      defaultCoveragePreferences(fallbackMapSet),
      browserStorage,
    );
    const storedMapSetId = store.items.some(
      ({ id }) => id === stored.selectedMapSetId,
    )
      ? stored.selectedMapSetId
      : null;
    selectedId.value =
      requestedMapSetId ?? storedMapSetId ?? fallbackMapSet?.id ?? null;
    applyCoveragePreferences(stored);
    if (!(await loadSnapshots())) return;
    await renderMap();
    mounted = true;
    preferencesReady = true;
    saveCurrentCoveragePreferences();
  } catch (cause) {
    error.value =
      cause instanceof Error ? cause.message : "Coverage could not be loaded.";
  }
});

onBeforeUnmount(destroyRenderer);
</script>

<template>
  <main class="coverage-page">
    <aside class="coverage-sidebar">
      <header>
        <div>
          <p class="eyebrow">Tile Archive</p>
          <h1>Coverage</h1>
        </div>
        <button type="button" class="icon-button" :disabled="loading || !canQuery" title="Refresh visible area" @click="queryVisibleCoverage">
          <i class="mdi mdi-refresh" aria-hidden="true"></i>
        </button>
      </header>

      <label class="field">
        <span>Map Set</span>
        <MapSetSelect v-model="selectedId" :items="store.items" />
      </label>
      <div v-if="selected" class="map-set-meta">
        <RouterLink
          class="map-set-meta-button"
          :to="`/cache/${selected.id}`"
          title="View cache details"
          aria-label="View cache details"
        >
          <i class="mdi mdi-eye-outline" aria-hidden="true"></i>
        </RouterLink>
        <RouterLink
          class="map-set-meta-button"
          :to="`/map-sets/${selected.id}`"
          title="Edit Map Set"
          aria-label="Edit Map Set"
        >
          <i class="mdi mdi-pencil-outline" aria-hidden="true"></i>
        </RouterLink>
        <span class="map-set-meta-details">
          {{ selected.tileSize }} <span aria-hidden="true">●</span>
          {{ selected.tileFormat.toUpperCase() }} <span aria-hidden="true">●</span>
          Zoom {{ selected.minZoom }}–{{ selected.maxZoom }}
        </span>
      </div>

      <label
        v-if="selected && hasCoveragePreviewZoomRange(selected.minZoom, selected.maxZoom)"
        class="field"
      >
        <span>Source zoom</span>
        <input v-model.number="sourceZoom" type="number" :min="selected.minZoom + 1" :max="selected.maxZoom" />
      </label>

      <fieldset>
        <legend>Cache state</legend>
        <label class="field">
          <span>Selection</span>
          <select v-model="selectionMode">
            <option value="current">Current</option>
            <option value="snapshot" :disabled="snapshots.length === 0">Snapshot</option>
            <option value="asOf">Point in time</option>
          </select>
        </label>
        <label v-if="selectionMode === 'snapshot'" class="field">
          <span>Snapshot</span>
          <select v-model="selectionSnapshotId">
            <option v-for="snapshot in snapshots" :key="snapshot.id" :value="snapshot.id">{{ snapshot.name }}</option>
          </select>
        </label>
        <label v-if="selectionMode === 'asOf'" class="field">
          <span>At</span>
          <input v-model="selectionTimestamp" type="datetime-local" />
        </label>
      </fieldset>

      <fieldset>
        <legend><label class="check-field"><input v-model="compareEnabled" type="checkbox" /> Compare with</label></legend>
        <template v-if="compareEnabled">
          <label class="field">
            <span>Comparison state</span>
            <select v-model="comparisonMode">
              <option value="current">Current</option>
              <option value="snapshot" :disabled="snapshots.length === 0">Snapshot</option>
              <option value="asOf">Point in time</option>
            </select>
          </label>
          <label v-if="comparisonMode === 'snapshot'" class="field">
            <span>Snapshot</span>
            <select v-model="comparisonSnapshotId">
              <option v-for="snapshot in snapshots" :key="snapshot.id" :value="snapshot.id">{{ snapshot.name }}</option>
            </select>
          </label>
          <label v-if="comparisonMode === 'asOf'" class="field">
            <span>At</span>
            <input v-model="comparisonTimestamp" type="datetime-local" />
          </label>
        </template>
      </fieldset>

      <button class="primary-button" type="button" :disabled="loading || !canQuery" @click="queryVisibleCoverage">
        {{ loading ? "Querying…" : "Apply to visible area" }}
      </button>

      <section class="legend" aria-label="Coverage legend">
        <div
          v-for="scale in COVERAGE_STATUS_SCALES"
          :key="scale.label"
          class="status-scale"
        >
          <span>{{ scale.label }}</span>
          <span class="status-scale-bar" :aria-label="`${scale.label} percentage`">
            <i
              v-for="step in scale.steps"
              :key="step.minimumPercent"
              :style="{ backgroundColor: step.color }"
              :title="step.label"
            ></i>
          </span>
        </div>
        <template v-if="compareEnabled">
          <span><i class="changed"></i>Changed</span>
          <span><i class="added"></i>Added</span>
          <span><i class="removed"></i>Removed</span>
        </template>
      </section>

      <section v-if="response" class="summary" aria-label="Coverage summary">
        <header>
          <strong>Visible result</strong>
          <span>source z{{ response.sourceZoom }} → grid z{{ formatZoom(previewZoom) }}</span>
        </header>
        <dl>
          <div><dt>Tiles</dt><dd>{{ formatNumber(response.totals.tileCount) }}</dd></div>
          <div><dt>Aggregation</dt><dd>z{{ response.aggregationZoom }}</dd></div>
          <div><dt>Available</dt><dd>{{ formatNumber(response.totals.statuses.available) }}</dd></div>
          <div><dt>Stale</dt><dd>{{ formatNumber(response.totals.statuses.stale) }}</dd></div>
          <div><dt>Missing</dt><dd>{{ formatNumber(response.totals.statuses.missing) }}</dd></div>
          <div><dt>Revisions</dt><dd>{{ formatNumber(response.totals.revisionCount) }}</dd></div>
          <div><dt>Selected bytes</dt><dd>{{ formatBytes(response.totals.byteLength) }}</dd></div>
          <template v-if="response.totals.comparison">
            <div><dt>Changed</dt><dd>{{ formatNumber(response.totals.comparison.changed) }}</dd></div>
            <div><dt>Added</dt><dd>{{ formatNumber(response.totals.comparison.added) }}</dd></div>
            <div><dt>Removed</dt><dd>{{ formatNumber(response.totals.comparison.missing) }}</dd></div>
          </template>
        </dl>
      </section>

      <section v-if="selectedCell" class="cell-detail">
        <header><strong>{{ selectedCell.id }}</strong><span>{{ formatNumber(selectedCell.tileCount) }} tiles</span></header>
        <dl>
          <div><dt>Revisions</dt><dd>{{ formatNumber(selectedCell.revisionCount) }}</dd></div>
          <div><dt>Bytes</dt><dd>{{ formatBytes(selectedCell.byteLength) }}</dd></div>
          <div><dt>Oldest validation</dt><dd>{{ formatDate(selectedCell.oldestValidatedAt) }}</dd></div>
          <div><dt>Newest validation</dt><dd>{{ formatDate(selectedCell.newestValidatedAt) }}</dd></div>
        </dl>
        <button
          v-if="response && response.aggregationZoom < response.sourceZoom"
          type="button"
          @click="inspectTiles(selectedCell)"
        >Inspect individual tiles</button>
      </section>

      <p v-if="error" class="error-message" role="alert">{{ error }}</p>
      <p v-if="inspectingCell" class="muted">Showing a drilled-down aggregate cell. Move the map or refresh to return to the visible area.</p>
    </aside>

    <section class="coverage-map" aria-label="Cache Coverage map">
      <div ref="mapHost" class="map-host"></div>
      <div v-if="store.loading" class="map-message">Loading Map Sets…</div>
      <div v-else-if="store.loaded && store.items.length === 0" class="map-message">Create a Map Set to inspect Coverage.</div>
    </section>
  </main>
</template>

<style scoped>
.coverage-page { display: grid; grid-template-columns: minmax(19rem, 24rem) minmax(0, 1fr); height: 100%; min-height: 0; }
.coverage-sidebar { min-height: 0; overflow-y: auto; padding: 1.25rem; border-right: 1px solid #b6c6bc; background: #f4f7f4; }
.coverage-sidebar > header, .summary header, .cell-detail header { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
.coverage-sidebar h1 { margin: 0; font-size: 1.8rem; }
.eyebrow { margin: 0 0 0.2rem; color: #617870; font-size: 0.72rem; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; }
.icon-button { width: 2.3rem; height: 2.3rem; border: 1px solid #b6c6bc; border-radius: 50%; color: #17453c; background: white; cursor: pointer; }
.field { display: grid; gap: 0.35rem; margin-top: 1rem; font-size: 0.85rem; font-weight: 700; }
.map-set-meta { display: flex; align-items: center; gap: 0.35rem; margin: 0.4rem 0 0; color: #617870; font-size: 0.78rem; font-weight: 700; }
.map-set-meta-button { display: inline-flex; flex: 0 0 auto; align-items: center; justify-content: center; width: 1.25rem; height: 1.25rem; border: 0; border-radius: 0.25rem; color: #17453c; background: transparent; text-decoration: none; }
.map-set-meta-button:hover { color: #2f7563; }
.map-set-meta-button:focus-visible { outline: 2px solid #68877b; outline-offset: 1px; }
.map-set-meta-details { display: inline-flex; flex-wrap: wrap; gap: 0.4rem; align-items: center; min-width: 0; }
.field input, .field select { width: 100%; min-height: 2.35rem; padding: 0.45rem 0.55rem; border: 1px solid #9db0a6; border-radius: 0.4rem; background: white; font: inherit; }
fieldset { margin: 1rem 0 0; padding: 0 0.8rem 0.8rem; border: 1px solid #c8d4cd; border-radius: 0.55rem; }
legend { padding: 0 0.35rem; color: #314f47; font-weight: 800; }
.check-field { display: inline-flex; gap: 0.4rem; align-items: center; }
.primary-button { width: 100%; margin-top: 1rem; padding: 0.7rem 1rem; border: 0; border-radius: 0.45rem; color: white; background: #17453c; font: inherit; font-weight: 800; cursor: pointer; }
button:disabled { cursor: not-allowed; opacity: 0.55; }
.legend { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; margin-top: 1rem; font-size: 0.78rem; }
.legend span { display: flex; gap: 0.4rem; align-items: center; }
.legend i { width: 0.75rem; height: 0.75rem; border-radius: 0.15rem; background: #4e9b79; }
.legend .status-scale { display: grid; grid-column: 1 / -1; grid-template-columns: 4.5rem 1fr; gap: 0.55rem; align-items: center; }
.legend .status-scale-bar { display: grid; grid-template-columns: repeat(5, 1fr); gap: 0; width: min(100%, 10rem); height: 0.75rem; overflow: hidden; border: 1px solid #9db0a6; border-radius: 0.2rem; }
.legend .status-scale-bar i { width: auto; height: 100%; border-radius: 0; cursor: help; }
.legend .changed { background: #d8792d; } .legend .added { background: #3188a8; } .legend .removed { background: #c94d46; }
.summary, .cell-detail { margin-top: 1rem; padding: 0.85rem; border: 1px solid #c8d4cd; border-radius: 0.55rem; background: white; }
.summary header span, .cell-detail header span, .muted { color: #617870; font-size: 0.78rem; }
dl { display: grid; gap: 0.35rem; margin: 0.75rem 0 0; }
dl div { display: flex; justify-content: space-between; gap: 0.75rem; }
dt { color: #617870; } dd { margin: 0; font-weight: 750; text-align: right; }
.cell-detail button { margin-top: 0.75rem; padding: 0.45rem 0.65rem; border: 1px solid #8da398; border-radius: 0.4rem; color: #17453c; background: #eef4f0; font: inherit; font-weight: 700; cursor: pointer; }
.error-message { padding: 0.65rem; border-left: 0.2rem solid #b64030; color: #812d25; background: #ffe9e5; }
.coverage-map { position: relative; min-width: 0; min-height: 0; background: #a6c4b5; }
.map-host { width: 100%; height: 100%; }
.map-message { position: absolute; top: 1rem; left: 50%; z-index: 500; padding: 0.75rem 1rem; border-radius: 0.55rem; background: rgb(255 255 255 / 94%); box-shadow: 0 0.5rem 1.5rem rgb(24 54 45 / 18%); transform: translateX(-50%); }
@media (max-width: 800px) { .coverage-page { grid-template-columns: 1fr; grid-template-rows: minmax(18rem, 48%) minmax(20rem, 52%); } .coverage-sidebar { border-right: 0; border-bottom: 1px solid #b6c6bc; } }
</style>
