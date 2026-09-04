<script setup lang="ts">
import { leafletXyzZoomOptions } from "@maptoy/leaflet-xyz";
import type {
  CacheSnapshot,
  CacheSnapshotListResponse,
  CoverageCell,
  CoverageBounds,
  CoverageResponse,
  CoverageSelection,
  Job,
  MapSetListItem,
} from "@maptoy/contracts";
import type { MapRendererInstance, ScreenPoint } from "@maptoy/map-adapter-sdk";
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
import HtmlTooltip from "../components/HtmlTooltip.vue";
// biome-ignore lint/correctness/noUnusedImports: referenced by the Vue template
import TileDownloadPanel from "../components/TileDownloadPanel.vue";
// biome-ignore lint/correctness/noUnusedImports: referenced by the Vue template
import MapSetSelect from "../components/MapSetSelect.vue";
// biome-ignore lint/correctness/noUnusedImports: referenced by the Vue template
import MapZoomControl from "../components/MapZoomControl.vue";
import {
  type CoveragePagePreferences,
  loadCoveragePagePreferences,
  resolvedCoverageMapSetIds,
  saveCoveragePagePreferences,
} from "../coveragePreferences.js";
import {
  COVERAGE_LAYER_ID,
  // biome-ignore lint/correctness/noUnusedImports: referenced by the Vue template
  COVERAGE_STATUS_SCALES,
  TILE_DOWNLOAD_LAYER_ID,
  type CoveragePreviewViewport,
  constrainedCoveragePreviewViewport,
  constrainedCoverageSourceZoom,
  coverageCellIsColored,
  coverageGridCellTileCapacity,
  coverageGridZoom,
  coverageLayer,
  coveragePreviewGridZoomRange,
  tileDownloadLayer,
  coverageSelection,
  coverageViewportZoom,
  hasCoveragePreviewZoomRange,
  intersectedCoveragePreviewZoomRange,
  screenRectangleBounds,
  visibleCoverageBounds,
} from "../coverageModel.js";
// biome-ignore lint/correctness/noUnusedImports: referenced by the Vue template
import { formatDurationMinutes } from "../durationFormat.js";
import { mapTileUrl } from "../mapTileUrl.js";
import { availableLocalStorage } from "../localStorage.js";
import { MAP_RENDERER_FACTORY_REGISTRY_KEY } from "../registries.js";
import { useMapSetsStore } from "../stores/mapSets.js";
import { useMapViewStateStore } from "../stores/mapViewState.js";

const injectedFactories = inject(MAP_RENDERER_FACTORY_REGISTRY_KEY);
if (injectedFactories === undefined) {
  throw new Error("Map renderer factory registry is not available.");
}
const factories = injectedFactories;

const route = useRoute();
const router = useRouter();
const store = useMapSetsStore();
const mapViewState = useMapViewStateStore();
const browserStorage = availableLocalStorage();
const selectedId = ref<string | null>(null);
const selected = computed(
  () => store.items.find((mapSet) => mapSet.id === selectedId.value) ?? null,
);
const previewMapSetId = ref<string | null>(null);
const previewMapSet = computed(
  () =>
    store.items.find((mapSet) => mapSet.id === previewMapSetId.value) ?? null,
);
const mapHost = ref<HTMLElement | null>(null);
const downloadAreaSurface = ref<HTMLElement | null>(null);
const cellDetail = ref<HTMLElement | null>(null);
const snapshots = ref<CacheSnapshot[]>([]);
const sourceZoom = ref(0);
const previewZoom = ref<number | null>(null);
const previewViewport = ref<CoveragePreviewViewport | null>(null);
const selectionMode = ref<CoverageSelection["kind"]>("current");
const selectionSnapshotId = ref("");
const selectionTimestamp = ref(new Date().toISOString().slice(0, 16));
const showGrid = ref(true);
const showSelection = ref(true);
const dimmed = ref(true);
const response = ref<CoverageResponse | null>(null);
const selectedCell = ref<CoverageCell | null>(null);
const downloadJobs = ref<Job[]>([]);
const downloadSelection = ref<CoverageBounds | null>(null);
const drawnDownloadBounds = ref<CoverageBounds | null>(null);
const selectingDownloadArea = ref(false);
const downloadDragStart = ref<ScreenPoint | null>(null);
const downloadDragCurrent = ref<ScreenPoint | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);
const rendererReady = ref(false);
let renderer: MapRendererInstance | null = null;
let layerAttached = false;
let downloadLayerAttached = false;
let renderGeneration = 0;
let snapshotLoadGeneration = 0;
let queryGeneration = 0;
let refreshTimer: number | null = null;
let mounted = false;
let adjustingPreviewZoom = false;
let mapSetChangesInFlight = 0;
let preferencesReady = false;
let rendererTransition: Promise<void> = Promise.resolve();
let downloadDragPointerId: number | null = null;

const selectionReady = computed(
  () =>
    (selectionMode.value !== "snapshot" || selectionSnapshotId.value !== "") &&
    (selectionMode.value !== "asOf" ||
      validTimestampInput(selectionTimestamp.value)),
);
const previewGridZoomRange = computed(() => {
  const coverageMapSet = selected.value;
  const mapSet = previewMapSet.value;
  return coverageMapSet === null || mapSet === null
    ? null
    : coveragePreviewGridZoomRange(
        sourceZoom.value,
        coverageMapSet.minZoom + 1,
        mapSet.minZoom,
        mapSet.maxZoom,
      );
});
const canQuery = computed(
  () =>
    selected.value?.capabilities.tileArchive &&
    previewGridZoomRange.value !== null &&
    rendererReady.value &&
    selectionReady.value,
);
// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
const aggregationGridTileCapacity = computed(() =>
  response.value === null
    ? null
    : coverageGridCellTileCapacity(
        response.value.sourceZoom,
        response.value.aggregationZoom,
      ),
);
// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
const downloadDragStyle = computed(() => {
  const start = downloadDragStart.value;
  const current = downloadDragCurrent.value;
  if (start === null || current === null) return {};
  return {
    left: `${Math.min(start.x, current.x)}px`,
    top: `${Math.min(start.y, current.y)}px`,
    width: `${Math.abs(start.x - current.x)}px`,
    height: `${Math.abs(start.y - current.y)}px`,
  };
});

// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
function formatNumber(value: number): string {
  return new Intl.NumberFormat().format(value);
}

// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
function formatCoverageShare(cached: number, total: number): string {
  if (total <= 0 || cached <= 0) return "0%";
  const percentage = (cached / total) * 100;
  if (percentage < 0.00001) {
    return `${percentage.toExponential(2).replace("e", "E")}%`;
  }
  return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(percentage)}%`;
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
    previewMapSetId: mapSet?.id ?? null,
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
    showGrid: true,
    showSelection: true,
    dimmed: true,
  };
}

function applyCoveragePreferences(stored: CoveragePagePreferences): void {
  const fallbackTimestamp = timestampInputNow();
  sourceZoom.value = stored.sourceZoom;
  previewViewport.value = stored.previewViewport;
  selectionMode.value = stored.selectionMode;
  selectionSnapshotId.value = stored.selectionSnapshotId;
  showGrid.value = stored.showGrid;
  showSelection.value = stored.showSelection;
  dimmed.value = stored.dimmed;
  selectionTimestamp.value = validTimestampInput(stored.selectionTimestamp)
    ? stored.selectionTimestamp
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
      previewMapSetId: previewMapSetId.value,
      previewViewport: previewViewport.value,
      sourceZoom: sourceZoom.value,
      selectionMode: selectionMode.value,
      selectionSnapshotId: selectionSnapshotId.value,
      selectionTimestamp: selectionTimestamp.value,
      showGrid: showGrid.value,
      showSelection: showSelection.value,
      dimmed: dimmed.value,
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

async function showCellDetails(featureId: string): Promise<void> {
  selectedCell.value =
    response.value?.cells.find(({ id }) => id === featureId) ?? null;
  if (selectedCell.value === null) return;
  await nextTick();
  cellDetail.value?.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function destroyRenderer(): Promise<void> {
  cancelDownloadAreaSelection();
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
  downloadLayerAttached = false;
}

async function renderDownloadLayer(): Promise<void> {
  const activeRenderer = renderer;
  if (activeRenderer === null) return;
  const layer = tileDownloadLayer(
    showSelection.value ? downloadSelection.value : null,
    downloadJobs.value,
  );
  if (downloadLayerAttached) {
    await activeRenderer.updateLayer(layer);
  } else {
    await activeRenderer.attachLayer(layer);
    downloadLayerAttached = true;
  }
  if (layerAttached) {
    await activeRenderer.reorderLayers([
      COVERAGE_LAYER_ID,
      TILE_DOWNLOAD_LAYER_ID,
    ]);
  }
}

// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
function updateDownloadJobs(value: Job[]): void {
  downloadJobs.value = value;
  void renderDownloadLayer();
}

// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
function updateDownloadSelection(value: CoverageBounds | null): void {
  downloadSelection.value = value;
  void renderDownloadLayer();
}

// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
function startDownloadAreaSelection(): void {
  if (renderer === null) return;
  selectingDownloadArea.value = true;
  downloadDragStart.value = null;
  downloadDragCurrent.value = null;
  downloadDragPointerId = null;
}

function cancelDownloadAreaSelection(): void {
  const surface = downloadAreaSurface.value;
  if (
    surface !== null &&
    downloadDragPointerId !== null &&
    surface.hasPointerCapture(downloadDragPointerId)
  ) {
    surface.releasePointerCapture(downloadDragPointerId);
  }
  selectingDownloadArea.value = false;
  downloadDragStart.value = null;
  downloadDragCurrent.value = null;
  downloadDragPointerId = null;
}

function downloadAreaScreenPoint(
  event: PointerEvent,
  overlay: HTMLElement,
): ScreenPoint {
  const rectangle = overlay.getBoundingClientRect();
  return {
    x: Math.max(
      0,
      Math.min(overlay.clientWidth, event.clientX - rectangle.left),
    ),
    y: Math.max(
      0,
      Math.min(overlay.clientHeight, event.clientY - rectangle.top),
    ),
  };
}

// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
function startDownloadAreaDrag(event: PointerEvent): void {
  if (
    (!selectingDownloadArea.value && !event.ctrlKey) ||
    (event.pointerType === "mouse" && event.button !== 0)
  ) {
    return;
  }
  if (
    !selectingDownloadArea.value &&
    event.target instanceof Element &&
    event.target.closest("button, input, select, textarea, a") !== null
  ) {
    return;
  }
  if (renderer === null) return;
  selectingDownloadArea.value = true;
  const surface = event.currentTarget as HTMLElement;
  const point = downloadAreaScreenPoint(event, surface);
  downloadDragPointerId = event.pointerId;
  downloadDragStart.value = point;
  downloadDragCurrent.value = point;
  surface.setPointerCapture(event.pointerId);
  event.preventDefault();
  event.stopPropagation();
}

// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
function moveDownloadAreaDrag(event: PointerEvent): void {
  if (downloadDragPointerId !== event.pointerId) return;
  downloadDragCurrent.value = downloadAreaScreenPoint(
    event,
    event.currentTarget as HTMLElement,
  );
  event.preventDefault();
  event.stopPropagation();
}

// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
function finishDownloadAreaDrag(event: PointerEvent): void {
  if (downloadDragPointerId !== event.pointerId) return;
  const surface = event.currentTarget as HTMLElement;
  const start = downloadDragStart.value;
  const end = downloadAreaScreenPoint(event, surface);
  if (surface.hasPointerCapture(event.pointerId)) {
    surface.releasePointerCapture(event.pointerId);
  }
  downloadDragPointerId = null;
  downloadDragCurrent.value = end;
  if (
    start === null ||
    Math.abs(start.x - end.x) < 4 ||
    Math.abs(start.y - end.y) < 4 ||
    renderer === null
  ) {
    downloadDragStart.value = null;
    downloadDragCurrent.value = null;
    event.preventDefault();
    event.stopPropagation();
    return;
  }
  const bounds = screenRectangleBounds(renderer, start, end);
  drawnDownloadBounds.value = bounds;
  downloadSelection.value = bounds;
  void renderDownloadLayer();
  cancelDownloadAreaSelection();
  event.preventDefault();
  event.stopPropagation();
}

// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
function cancelDownloadAreaDrag(event: PointerEvent): void {
  if (downloadDragPointerId !== event.pointerId) return;
  const surface = event.currentTarget as HTMLElement;
  if (surface.hasPointerCapture(event.pointerId)) {
    surface.releasePointerCapture(event.pointerId);
  }
  downloadDragPointerId = null;
  downloadDragStart.value = null;
  downloadDragCurrent.value = null;
  event.preventDefault();
  event.stopPropagation();
}

function onDocumentKeydown(event: KeyboardEvent): void {
  if (event.key === "Escape" && selectingDownloadArea.value) {
    cancelDownloadAreaSelection();
  }
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
  const mapSet = previewMapSet.value;
  const coverageMapSet = selected.value;
  if (
    generation !== renderGeneration ||
    mapSet === null ||
    coverageMapSet === null ||
    mapHost.value === null
  ) {
    return;
  }
  if (!coverageMapSet.capabilities.tileArchive) {
    error.value = "Coverage requires a Map Set with Tile Archive capability.";
    return;
  }
  if (!mapSet.capabilities.interactive) {
    error.value = "The Preview Map Set does not support interactive display.";
    return;
  }
  if (
    !hasCoveragePreviewZoomRange(coverageMapSet.minZoom, coverageMapSet.maxZoom)
  ) {
    error.value =
      "Coverage requires a Map Set with at least two configured source zoom levels.";
    return;
  }
  constrainCoveragePreferences(coverageMapSet);
  const gridZoomRange = previewGridZoomRange.value;
  if (gridZoomRange === null) {
    error.value =
      "The Coverage and Preview Map Sets do not share a usable preview zoom range.";
    return;
  }
  const factory = factories.get(mapSet.rendererId);
  if (factory === undefined) {
    error.value = `Renderer adapter ${mapSet.rendererId} is unavailable.`;
    return;
  }
  try {
    const zoomOptions = leafletXyzZoomOptions(mapSet);
    const initialViewport = constrainedCoveragePreviewViewport(
      previewViewport.value ?? {
        center: mapSet.defaultCenter,
        gridZoom: mapSet.defaultZoom,
      },
      gridZoomRange.minimum,
      gridZoomRange.maximum,
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
          cachedTilesOnly: false,
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
        const cell = response.value?.cells.find(
          ({ id }) => id === payload.featureId,
        );
        if (
          (showGrid.value && dimmed.value) ||
          (cell !== undefined && coverageCellIsColored(cell))
        ) {
          void showCellDetails(payload.featureId);
        }
      }
    });
    await queryVisibleCoverage();
    await renderDownloadLayer();
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
  const mapSet = previewMapSet.value;
  if (renderer !== null && mapSet !== null) {
    const gridZoom = updatePreviewViewport(renderer, mapSet);
    if (!adjustingPreviewZoom && gridZoom > sourceZoom.value - 1) {
      void applyPreviewZoomRange(sourceZoom.value);
      return;
    }
  }
  if (adjustingPreviewZoom) return;
  if (refreshTimer !== null) window.clearTimeout(refreshTimer);
  refreshTimer = window.setTimeout(() => void queryVisibleCoverage(), 250);
}

async function applyPreviewZoomRange(value: number): Promise<boolean> {
  const activeRenderer = renderer;
  const mapSet = previewMapSet.value;
  const coverageMapSet = selected.value;
  if (activeRenderer === null || mapSet === null || coverageMapSet === null) {
    return false;
  }
  const zoomOffset = leafletXyzZoomOptions(mapSet).zoomOffset;
  const range = intersectedCoveragePreviewZoomRange(
    value,
    coverageMapSet.minZoom + 1,
    mapSet.minZoom,
    mapSet.maxZoom,
    zoomOffset,
  );
  if (range === null) {
    error.value =
      "The Coverage and Preview Map Sets do not share a usable preview zoom range.";
    return false;
  }
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
  return true;
}

// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
async function applyPreviewMapZoom(gridZoom: number): Promise<void> {
  const activeRenderer = renderer;
  const mapSet = previewMapSet.value;
  if (activeRenderer === null || mapSet === null) return;
  const viewport = activeRenderer.getViewport();
  const zoomOffset = leafletXyzZoomOptions(mapSet).zoomOffset;
  await activeRenderer.setViewport({
    center: viewport.center,
    zoom: coverageViewportZoom(gridZoom, zoomOffset),
  });
  if (renderer === activeRenderer) {
    updatePreviewViewport(activeRenderer, mapSet);
  }
}

async function executeQuery(bounds: CoverageResponse["bounds"]): Promise<void> {
  const mapSet = selected.value;
  const activeRenderer = renderer;
  if (mapSet === null || activeRenderer === null) return;
  const generation = ++queryGeneration;
  loading.value = true;
  error.value = null;
  try {
    const result = await apiRequest<CoverageResponse>(
      `api/map-sets/${mapSet.id}/coverage/query`,
      {
        method: "POST",
        body: JSON.stringify({
          bounds,
          zoom: sourceZoom.value,
          selection: activeSelection(),
          maximumCells: 1024,
        }),
      },
    );
    if (generation !== queryGeneration || renderer !== activeRenderer) return;
    response.value = result;
    selectedCell.value = null;
    const layer = coverageLayer(result, {
      showGrid: showGrid.value,
      dimmed: dimmed.value,
    });
    if (layerAttached) {
      await activeRenderer.updateLayer(layer);
    } else {
      await activeRenderer.attachLayer(layer);
      layerAttached = true;
    }
    await renderDownloadLayer();
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
  if (!(await applyPreviewZoomRange(value))) return;
  await queryVisibleCoverage();
}

async function onMapSetChanged(): Promise<void> {
  cancelDownloadAreaSelection();
  drawnDownloadBounds.value = null;
  if (!mounted) return;
  previewMapSetId.value = selectedId.value;
  mapSetChangesInFlight += 1;
  const id = selectedId.value;
  try {
    await router.replace(id === null ? "/coverage" : `/coverage/${id}`);
    if (!(await loadSnapshots())) return;
    await renderMap();
  } catch (cause) {
    error.value =
      cause instanceof Error ? cause.message : "Coverage could not be loaded.";
  } finally {
    mapSetChangesInFlight -= 1;
  }
}

// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
async function onPreviewMapSetChanged(id: string): Promise<void> {
  if (previewMapSetId.value === id) return;
  previewMapSetId.value = id;
  if (!mounted) return;
  await renderMap();
}

function onSelectionChanged(): void {
  if (!mounted || mapSetChangesInFlight > 0) return;
  if (!selectionReady.value) {
    clearCoverageResult();
    return;
  }
  void queryVisibleCoverage();
}

watch(selectedId, onMapSetChanged);
watch(sourceZoom, (value) => void onSourceZoomChanged(value));
watch(
  [selected, sourceZoom],
  ([mapSet, zoom]) => {
    mapViewState.setCoverageMapSetName(mapSet?.name ?? null);
    mapViewState.setCoverageSourceZoom(
      mapSet !== null &&
        hasCoveragePreviewZoomRange(mapSet.minZoom, mapSet.maxZoom) &&
        Number.isInteger(zoom) &&
        zoom >= mapSet.minZoom + 1 &&
        zoom <= mapSet.maxZoom
        ? zoom
        : null,
    );
  },
  { immediate: true },
);
watch(
  [selectionMode, selectionSnapshotId, selectionTimestamp],
  onSelectionChanged,
);
watch(
  [
    selectedId,
    previewMapSetId,
    sourceZoom,
    previewViewport,
    selectionMode,
    selectionSnapshotId,
    selectionTimestamp,
    showGrid,
    showSelection,
    dimmed,
  ],
  saveCurrentCoveragePreferences,
);

watch([showGrid, dimmed], ([showGridValue, dimmedValue]) => {
  if (
    (!showGridValue || !dimmedValue) &&
    selectedCell.value !== null &&
    !coverageCellIsColored(selectedCell.value)
  ) {
    selectedCell.value = null;
  }
  if (response.value !== null && renderer !== null && layerAttached) {
    void renderer.updateLayer(
      coverageLayer(response.value, {
        showGrid: showGridValue,
        dimmed: dimmedValue,
      }),
    );
  }
});

watch(showSelection, () => void renderDownloadLayer());

onMounted(async () => {
  document.addEventListener("keydown", onDocumentKeydown);
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
    const storedPreviewMapSetId = store.items.some(
      ({ id }) => id === stored.previewMapSetId,
    )
      ? stored.previewMapSetId
      : null;
    const resolvedMapSetIds = resolvedCoverageMapSetIds(
      requestedMapSetId,
      storedMapSetId,
      storedPreviewMapSetId,
      fallbackMapSet?.id ?? null,
    );
    selectedId.value = resolvedMapSetIds.mapSetId;
    previewMapSetId.value = resolvedMapSetIds.previewMapSetId;
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

onBeforeUnmount(async () => {
  document.removeEventListener("keydown", onDocumentKeydown);
  mapViewState.setCoverageMapSetName(null);
  mapViewState.setCoverageSourceZoom(null);
  await destroyRenderer();
});
</script>

<template>
  <main class="coverage-page">
    <aside class="coverage-sidebar">
      <div class="coverage-sidebar-head">
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
      </div>

      <details class="cache-state" open>
        <summary>Cache state</summary>
        <div class="cache-state-fields">
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
        </div>
      </details>

      <section class="legend" aria-label="Coverage legend">
        <div class="legend-options">
          <label>
          <input v-model="showGrid" type="checkbox" />
          <span>Show grid</span>
          </label>
          <label>
            <input v-model="dimmed" type="checkbox" />
            <span>Dimmed</span>
          </label>
          <label>
            <input v-model="showSelection" type="checkbox" />
            <span>Selection</span>
          </label>
        </div>
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
        <p v-if="selected" class="stale-limit">
          Stale limit:
          {{ formatDurationMinutes(Math.round(selected.cachePolicy.maximumAgeSeconds / 60)) }}
        </p>
      </section>

      <section v-if="response" class="summary" aria-label="Coverage summary">
        <header>
          <strong>Visible result</strong>
          <span>source z{{ response.sourceZoom }} → map z{{ formatZoom(previewZoom) }}</span>
        </header>
        <dl>
          <div><dt>Tiles</dt><dd>{{ formatNumber(response.totals.tileCount) }}</dd></div>
          <div>
            <dt class="summary-label">
              Aggregation-Grid
              <HtmlTooltip
                v-if="aggregationGridTileCapacity !== null"
                label="About the Aggregation Grid"
                fixed
                unstyled-trigger
              >
                <i class="mdi mdi-information-outline" aria-hidden="true"></i>
                {{ formatNumber(aggregationGridTileCapacity) }} source
                {{ aggregationGridTileCapacity === 1 ? "tile" : "tiles" }} at z{{ response.sourceZoom }} per grid cell.
              </HtmlTooltip>
            </dt>
            <dd>z{{ response.aggregationZoom }}</dd>
          </div>
          <div><dt>Fresh</dt><dd>{{ formatNumber(response.totals.statuses.fresh) }}</dd></div>
          <div><dt>Stale</dt><dd>{{ formatNumber(response.totals.statuses.stale) }}</dd></div>
          <div><dt>Missing</dt><dd>{{ formatNumber(response.totals.statuses.missing) }}</dd></div>
          <div><dt>Revisions</dt><dd>{{ formatNumber(response.totals.revisionCount) }}</dd></div>
          <div><dt>Cached bytes</dt><dd>{{ formatBytes(response.totals.byteLength) }}</dd></div>
        </dl>
      </section>

      <section v-if="selectedCell" ref="cellDetail" class="cell-detail">
        <header><strong>{{ selectedCell.id }}</strong><span>grid z{{ selectedCell.zoom }}</span></header>
        <dl>
          <div>
            <dt>Tiles</dt>
            <dd>
              {{ formatNumber(selectedCell.statuses.fresh + selectedCell.statuses.stale) }} /
              {{ formatNumber(selectedCell.tileCount) }} :
              {{ formatCoverageShare(selectedCell.statuses.fresh + selectedCell.statuses.stale, selectedCell.tileCount) }}
            </dd>
          </div>
          <div><dt>Revisions</dt><dd>{{ formatNumber(selectedCell.revisionCount) }}</dd></div>
          <div><dt>Bytes</dt><dd>{{ formatBytes(selectedCell.byteLength) }}</dd></div>
          <div><dt>Oldest validation</dt><dd>{{ formatDate(selectedCell.oldestValidatedAt) }}</dd></div>
          <div><dt>Newest validation</dt><dd>{{ formatDate(selectedCell.newestValidatedAt) }}</dd></div>
        </dl>
      </section>

      <p v-if="error" class="error-message" role="alert">{{ error }}</p>

      <TileDownloadPanel
        :map-set="selected"
        :visible-bounds="response?.bounds ?? null"
        :default-maximum-zoom="sourceZoom"
        :drawn-bounds="drawnDownloadBounds"
        :area-selection-active="selectingDownloadArea"
        :area-selection-available="rendererReady"
        :initially-open="route.query.download === 'open'"
        @jobs-updated="updateDownloadJobs"
        @selection-updated="updateDownloadSelection"
        @request-area-selection="startDownloadAreaSelection"
        @cancel-area-selection="cancelDownloadAreaSelection"
        @refresh-coverage="queryVisibleCoverage"
      />
    </aside>

    <section
      ref="downloadAreaSurface"
      class="coverage-map"
      aria-label="Cache Coverage map"
      @pointerdown.capture="startDownloadAreaDrag"
      @pointermove.capture="moveDownloadAreaDrag"
      @pointerup.capture="finishDownloadAreaDrag"
      @pointercancel.capture="cancelDownloadAreaDrag"
    >
      <div ref="mapHost" class="map-host"></div>
      <div
        v-if="selectingDownloadArea"
        class="download-area-selector"
        aria-label="Drag on the map to select a Tile Download area"
      >
        <span class="download-area-instruction">Drag to select · Esc to cancel</span>
        <span
          v-if="downloadDragStart && downloadDragCurrent"
          class="download-area-draft"
          :style="downloadDragStyle"
        ></span>
      </div>
      <MapZoomControl
        v-if="previewGridZoomRange"
        :zoom="previewZoom"
        :minimum="previewGridZoomRange.minimum"
        :maximum="previewGridZoomRange.maximum"
        auto-close-on-change
        @change="applyPreviewMapZoom"
      />
      <div v-if="store.items.length > 0" class="map-controls">
        <MapSetSelect
          class="preview-map-set-picker"
          :model-value="previewMapSetId"
          :items="store.items"
          variant="plain"
          aria-label="Preview Map Set"
          @update:model-value="onPreviewMapSetChanged"
        />
      </div>
      <div v-if="store.loading" class="map-message">Loading Map Sets…</div>
      <div v-else-if="store.loaded && store.items.length === 0" class="map-message">Create a Map Set to inspect Coverage.</div>
    </section>
  </main>
</template>

<style scoped>
.coverage-page { display: grid; grid-template-columns: minmax(19rem, 24rem) minmax(0, 1fr); height: 100%; min-height: 0; }
.coverage-sidebar { min-height: 0; overflow-y: auto; padding: 1.25rem; border-right: 1px solid #b6c6bc; background: #f4f7f4; }
.coverage-sidebar-head > header, .summary header, .cell-detail header { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
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
.cache-state { margin-top: 1rem; border: 1px solid #c8d4cd; border-radius: 0.55rem; }
.cache-state > summary { padding: 0.55rem 0.8rem; color: #314f47; font-weight: 800; cursor: pointer; }
.cache-state[open] > summary { padding-bottom: 0; }
.cache-state-fields { padding: 0 0.8rem 0.8rem; }
button:disabled { cursor: not-allowed; opacity: 0.55; }
.legend { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; margin-top: 1rem; font-size: 0.78rem; }
.legend .legend-options { display: flex; grid-column: 1 / -1; gap: 0.9rem; align-items: center; }
.legend .legend-options label { display: inline-flex; gap: 0.4rem; align-items: center; }
.legend .legend-options input { margin: 0; }
.legend span { display: flex; gap: 0.4rem; align-items: center; }
.legend i { width: 0.75rem; height: 0.75rem; border-radius: 0.15rem; background: #4e9b79; }
.legend .status-scale { display: grid; grid-column: 1 / -1; grid-template-columns: 4.5rem 1fr; gap: 0.55rem; align-items: center; }
.legend .status-scale-bar { display: grid; grid-template-columns: repeat(5, 1fr); gap: 0; width: min(100%, 10rem); height: 0.75rem; overflow: hidden; border: 1px solid #9db0a6; border-radius: 0.2rem; }
.legend .status-scale-bar i { width: auto; height: 100%; border-radius: 0; cursor: help; }
.legend .stale-limit { grid-column: 1 / -1; margin: 0.1rem 0 0; color: #617870; font-size: 0.72rem; }
.summary, .cell-detail { margin-top: 1rem; padding: 0.85rem; border: 1px solid #c8d4cd; border-radius: 0.55rem; background: white; }
.cell-detail { scroll-margin-block: 1rem; }
.summary header span, .cell-detail header span { color: #617870; font-size: 0.78rem; }
.summary-label { display: inline-flex; gap: 0.3rem; align-items: center; }
dl { display: grid; gap: 0.35rem; margin: 0.75rem 0 0; }
dl div { display: flex; justify-content: space-between; gap: 0.75rem; }
dt { color: #617870; } dd { margin: 0; font-weight: 750; text-align: right; }
.error-message { padding: 0.65rem; border-left: 0.2rem solid #b64030; color: #812d25; background: #ffe9e5; }
.coverage-map { position: relative; min-width: 0; min-height: 0; background: #a6c4b5; }
.map-host { width: 100%; height: 100%; }
.map-controls { position: absolute; top: 0.75rem; right: 0.75rem; z-index: 1000; display: flex; align-items: center; padding: 0.35rem; border: 1px solid rgb(103 125 116 / 45%); border-radius: 0.55rem; background: rgb(255 255 255 / 92%); box-shadow: 0 0.35rem 1rem rgb(24 54 45 / 18%); backdrop-filter: blur(0.3rem); }
.preview-map-set-picker { width: min(18rem, 58vw); }
.download-area-selector { position: absolute; inset: 0; z-index: 1100; overflow: hidden; cursor: crosshair; touch-action: none; }
.download-area-instruction { position: absolute; top: 1rem; left: 50%; z-index: 1; padding: 0.5rem 0.7rem; border-radius: 0.4rem; color: white; background: rgb(49 31 89 / 88%); box-shadow: 0 0.3rem 1rem rgb(24 14 48 / 25%); font-size: 0.78rem; font-weight: 800; pointer-events: none; transform: translateX(-50%); }
.download-area-draft { position: absolute; border: 4px solid #6d00d9; background: rgb(180 76 255 / 25%); box-shadow: 0 0 0 2px white, 0 0 1rem rgb(70 0 130 / 35%); pointer-events: none; }
.map-message { position: absolute; top: 1rem; left: 50%; z-index: 500; padding: 0.75rem 1rem; border-radius: 0.55rem; background: rgb(255 255 255 / 94%); box-shadow: 0 0.5rem 1.5rem rgb(24 54 45 / 18%); transform: translateX(-50%); }
@media (min-width: 801px) and (min-height: 720px) { .coverage-sidebar-head { position: sticky; top: -1.25rem; z-index: 600; margin: -1.25rem -1.25rem 0; padding: 1.25rem 1.25rem 0.85rem; background: #f4f7f4; } }
@media (max-width: 800px) { .coverage-page { grid-template-columns: 1fr; grid-template-rows: minmax(18rem, 48%) minmax(20rem, 52%); } .coverage-sidebar { border-right: 0; border-bottom: 1px solid #b6c6bc; } }
</style>
