<script setup lang="ts">
// biome-ignore-all lint/correctness/noUnusedImports: Vue template references are not detected by Biome.
// biome-ignore-all lint/correctness/noUnusedVariables: Vue template references are not detected by Biome.
import type { Layer, LayerAsset } from "@maptoy/contracts";
import type {
  GeographicCoordinate,
  MapLayerType,
} from "@maptoy/map-adapter-sdk";
import {
  MAP_SET_LAYER_PLUGIN_ID,
  validateMapSetLayerConfiguration,
} from "@maptoy/map-set-layer";
import {
  computed,
  inject,
  nextTick,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  watch,
} from "vue";
import {
  type CheckboxTreeNode,
  checkboxTreeBranchIds,
} from "../checkboxTree.js";
import {
  buildLayerHierarchyRows,
  type LayerCategoryDefinition,
  layerHierarchyAncestorKeys,
  layerNameSegments,
  layerParentPath,
  nextNumberedLayerName,
} from "../layerHierarchy.js";
import {
  loadCollapsedLayerHierarchy,
  loadSelectedLayerId,
  resolveSelectedLayerId,
  saveCollapsedLayerHierarchy,
  saveSelectedLayerId,
} from "../layerPanelPreferences.js";
import { availableLocalStorage } from "../localStorage.js";
import { photoMetadataRows } from "../photoMetadataPresentation.js";
import { layerTypePresentation } from "../layerEditorRegistry.js";
import { LAYER_PLUGIN_REGISTRY_KEY } from "../registries.js";
import { useLayersStore } from "../stores/layers.js";
import { useMapSetsStore } from "../stores/mapSets.js";
import DialogWindow from "./DialogWindow.vue";
import LayerEditor from "./LayerEditor.vue";
import MapSideControlButton from "./MapSideControlButton.vue";
import PhotoDirectoryBrowser from "./PhotoDirectoryBrowser.vue";
import TreeSelectDropdown from "./TreeSelectDropdown.vue";

const props = withDefaults(
  defineProps<{
    enabled: boolean;
    supportedLayerTypes?: readonly MapLayerType[];
  }>(),
  { supportedLayerTypes: () => [] },
);

const emit = defineEmits<{
  changed: [];
  centerMap: [coordinate: GeographicCoordinate];
  fitPhotoLayer: [layerId: string];
}>();
const store = useLayersStore();
const mapSets = useMapSetsStore();
const injectedLayerPlugins = inject(LAYER_PLUGIN_REGISTRY_KEY);
if (injectedLayerPlugins === undefined) {
  throw new Error("Layer plugin registry is not available.");
}
const layerPlugins = injectedLayerPlugins;
const browserStorage = availableLocalStorage();
const busy = ref(false);
const localError = ref<string | null>(null);
const panelOpen = ref(false);
const selectorOpen = ref(false);
const layerDialog = ref<{ activate(): void } | null>(null);
const addDialogOpen = ref(false);
const addDialogError = ref<string | null>(null);
const newLayerName = ref("");
const newLayerPluginId = ref("track-layer");
const newLayerMapSetId = ref("");
const assetSearch = ref("");
const scanDirectories = reactive<Record<string, string>>({});
const recursiveScans = reactive<Record<string, boolean>>({});
const editingAsset = ref<LayerAsset | null>(null);
const photoDirectoryBrowserLayerId = ref<string | null>(null);
const editLongitude = ref("");
const editLatitude = ref("");
const visibleScanResultJobIds = ref(new Set<string>());
const selectedLayerId = ref<string | null>(loadSelectedLayerId(browserStorage));
const collapsedHierarchyKeys = ref(loadCollapsedLayerHierarchy(browserStorage));
let jobPoll: number | null = null;
let previousRunningJobs = new Set<string>();
const restoredPhotoScanLayerIds = new Set<string>();

function openPanel(layerId?: string): void {
  if (store.loaded) {
    selectLayer(
      resolveSelectedLayerId(
        store.items,
        layerId ?? loadSelectedLayerId(browserStorage),
      ),
    );
  } else if (layerId !== undefined) {
    selectLayer(layerId);
  }
  if (panelOpen.value) {
    layerDialog.value?.activate();
    return;
  }
  panelOpen.value = true;
}

function closePanel(): void {
  panelOpen.value = false;
  selectorOpen.value = false;
  visibleScanResultJobIds.value = new Set();
}

function togglePanel(): void {
  if (panelOpen.value) {
    closePanel();
  } else {
    openPanel();
  }
}

defineExpose({ open: openPanel });

const categoryDefinitions: Array<
  LayerCategoryDefinition & { pluginIds: string[]; icon: string }
> = [];
for (const plugin of layerPlugins.list()) {
  let category = categoryDefinitions.find(
    ({ id }) => id === plugin.manifest.category.id,
  );
  if (category === undefined) {
    category = {
      id: plugin.manifest.category.id,
      label: plugin.manifest.category.displayName,
      pluginIds: [],
      icon: layerTypePresentation(plugin.manifest.id).icon,
    };
    categoryDefinitions.push(category);
  }
  category.pluginIds.push(plugin.manifest.id);
}
const categoryIdByPlugin = new Map(
  categoryDefinitions.flatMap((category) =>
    category.pluginIds.map((pluginId) => [pluginId, category.id] as const),
  ),
);
const categoryIconById = new Map(
  categoryDefinitions.map(({ id, icon }) => [id, icon]),
);

interface LayerSelectorModel {
  nodes: CheckboxTreeNode[];
  layerIdsByNode: Map<string, string[]>;
}

const hierarchyRows = computed(() =>
  buildLayerHierarchyRows(store.items, categoryDefinitions),
);
const selectorModel = computed<LayerSelectorModel>(() => {
  const nodes: CheckboxTreeNode[] = [];
  const stack: Array<{ depth: number; node: CheckboxTreeNode }> = [];
  const layerIdsByNode = new Map<string, string[]>();

  for (const row of hierarchyRows.value) {
    while (stack.length > 0 && (stack.at(-1)?.depth ?? -1) >= row.depth) {
      stack.pop();
    }
    const node: CheckboxTreeNode =
      row.kind === "layer"
        ? {
            id: row.layer.id,
            label: row.label,
            checked: row.layer.visible,
            checkDisabled:
              row.layer.status !== "ready" ||
              compatibilityDiagnostic(row.layer) !== null,
            selectable: true,
            searchText: row.layer.name,
            ...(row.layer.status !== "ready"
              ? { secondaryText: row.layer.status }
              : compatibilityDiagnostic(row.layer) === null
                ? {}
                : { secondaryText: "unsupported" }),
          }
        : {
            id: row.key,
            label: row.label,
            ...(row.kind === "category"
              ? {
                  icon:
                    categoryIconById.get(row.categoryId) ??
                    "mdi-layers-outline",
                }
              : {}),
            checked: false,
            selectable: false,
            children: [],
          };
    const parent = stack.at(-1)?.node;
    if (parent === undefined) {
      nodes.push(node);
    } else {
      parent.children?.push(node);
    }
    if (row.kind !== "layer") {
      stack.push({ depth: row.depth, node });
    }
  }

  function finalize(node: CheckboxTreeNode): string[] {
    if (!node.children?.length) {
      const layer = store.items.find(({ id }) => id === node.id);
      const layerIds =
        layer?.status === "ready" && compatibilityDiagnostic(layer) === null
          ? [node.id]
          : [];
      layerIdsByNode.set(node.id, layerIds);
      return layerIds;
    }
    const layerIds = node.children.flatMap(finalize);
    const layers = layerIds
      .map((id) => store.items.find((layer) => layer.id === id))
      .filter((layer): layer is Layer => layer !== undefined);
    const visibleCount = layers.filter(({ visible }) => visible).length;
    node.checked = layers.length > 0 && visibleCount === layers.length;
    node.indeterminate = visibleCount > 0 && visibleCount < layers.length;
    node.checkDisabled = layers.length === 0;
    layerIdsByNode.set(node.id, layerIds);
    return layerIds;
  }
  nodes.forEach(finalize);
  return { nodes, layerIdsByNode };
});
const allHierarchyBranchIds = computed(() =>
  checkboxTreeBranchIds(selectorModel.value.nodes),
);
const expandedHierarchyIds = computed({
  get: () =>
    allHierarchyBranchIds.value.filter(
      (key) => !collapsedHierarchyKeys.value.includes(key),
    ),
  set: (expanded: string[]) => {
    const expandedSet = new Set(expanded);
    collapsedHierarchyKeys.value = allHierarchyBranchIds.value.filter(
      (key) => !expandedSet.has(key),
    );
    saveCollapsedLayerHierarchy(collapsedHierarchyKeys.value, browserStorage);
  },
});
const selectedLayer = computed(
  () => store.items.find(({ id }) => id === selectedLayerId.value) ?? null,
);

function compatibilityDiagnostic(layer: Layer): string | null {
  if (layer.pluginId === MAP_SET_LAYER_PLUGIN_ID) {
    try {
      const configuration = validateMapSetLayerConfiguration(
        layer.configuration,
      );
      if (!mapSets.items.some(({ id }) => id === configuration.mapSetId)) {
        return "The referenced Map Set is unavailable.";
      }
    } catch {
      return "The Map Set layer configuration is invalid.";
    }
  }
  const plugin = layerPlugins.get(layer.pluginId);
  if (plugin === undefined) {
    return null;
  }
  const supported = new Set(props.supportedLayerTypes);
  const missing = plugin.manifest.requiredRendererLayerTypes.filter(
    (type) => !supported.has(type),
  );
  return missing.length === 0
    ? null
    : `This renderer does not support: ${missing.join(", ")}.`;
}

const creatableLayerTypes = layerPlugins
  .list()
  .filter(({ frontend }) => frontend !== undefined)
  .map((plugin) => ({
    id: plugin.manifest.id,
    ...layerTypePresentation(plugin.manifest.id),
    label: plugin.manifest.category.displayName,
  }));
const selectedLayerType = computed(() => {
  const selected = creatableLayerTypes.find(
    ({ id }) => id === newLayerPluginId.value,
  );
  if (selected === undefined) {
    throw new Error("The selected Layer type is not registered.");
  }
  return selected;
});
const suggestedLayerName = computed(() => {
  const category = categoryDefinitions.find(({ pluginIds }) =>
    pluginIds.includes(newLayerPluginId.value),
  );
  return nextNumberedLayerName(
    store.items,
    category?.pluginIds ?? [newLayerPluginId.value],
    selectedLayerType.value.defaultName,
  );
});

const activeJobs = computed(() =>
  store.jobs.filter(
    (job) =>
      job.type === "photo-scan" &&
      ["queued", "running", "paused"].includes(job.status),
  ),
);
const filteredPhotoAssets = computed(() => {
  const layerId = editingAsset.value?.layerId;
  if (layerId === undefined) {
    return [];
  }
  const query = assetSearch.value.trim().toLocaleLowerCase();
  return photoAssets(layerId)
    .filter(
      (asset) =>
        query === "" ||
        asset.fileName.toLocaleLowerCase().includes(query) ||
        asset.relativePath?.toLocaleLowerCase().includes(query),
    )
    .slice(0, 200);
});
const filteredAssetCount = computed(() => {
  const layerId = editingAsset.value?.layerId;
  if (layerId === undefined) {
    return 0;
  }
  const query = assetSearch.value.trim().toLocaleLowerCase();
  return photoAssets(layerId).filter(
    (asset) =>
      query === "" ||
      asset.fileName.toLocaleLowerCase().includes(query) ||
      asset.relativePath?.toLocaleLowerCase().includes(query),
  ).length;
});
const editingCoordinate = computed<GeographicCoordinate | null>(() => {
  if (editLongitude.value.trim() === "" || editLatitude.value.trim() === "") {
    return null;
  }
  const longitude = Number(editLongitude.value);
  const latitude = Number(editLatitude.value);
  return Number.isFinite(longitude) &&
    longitude >= -180 &&
    longitude <= 180 &&
    Number.isFinite(latitude) &&
    latitude >= -90 &&
    latitude <= 90
    ? { longitude, latitude }
    : null;
});
const editingPhotoMetadataRows = computed(() =>
  photoMetadataRows(editingAsset.value?.photoMetadata),
);

watch(
  () => ({
    loaded: store.loaded,
    layerIds: store.items.map(({ id }) => id),
  }),
  ({ loaded, layerIds }) => {
    if (
      loaded &&
      (selectedLayerId.value === null ||
        !layerIds.includes(selectedLayerId.value))
    ) {
      selectLayer(
        resolveSelectedLayerId(
          store.items,
          selectedLayerId.value ?? loadSelectedLayerId(browserStorage),
        ),
      );
    }
  },
  { immediate: true },
);

function selectLayer(layerId: string | null): void {
  selectedLayerId.value = layerId;
  saveSelectedLayerId(layerId, browserStorage);
}

watch(
  selectedLayer,
  (layer) => {
    if (layer?.pluginId === "photo-layer") {
      void store.ensureAssets(layer.id).catch((error) => {
        localError.value =
          error instanceof Error
            ? error.message
            : "The Photo catalog could not be loaded.";
      });
    }
  },
  { immediate: true },
);

function photoAssets(layerId: string): LayerAsset[] {
  return (store.assetsByLayer[layerId] ?? []).filter(
    (asset) => asset.kind === "external-photo",
  );
}

function scanJob(layerId: string) {
  return activeJobs.value.find((job) => job.input.layerId === layerId);
}

function displayedScanJob(layerId: string) {
  return (
    scanJob(layerId) ??
    store.jobs.find(
      (job) =>
        job.type === "photo-scan" &&
        job.input.layerId === layerId &&
        visibleScanResultJobIds.value.has(job.id),
    )
  );
}

function latestScanJob(layerId: string) {
  return store.jobs.find(
    (job) => job.type === "photo-scan" && job.input.layerId === layerId,
  );
}

function restorePhotoScanSettings(): void {
  for (const layer of store.items) {
    if (
      layer.pluginId !== "photo-layer" ||
      restoredPhotoScanLayerIds.has(layer.id)
    ) {
      continue;
    }
    const previousJob = latestScanJob(layer.id);
    if (previousJob === undefined) continue;
    scanDirectories[layer.id] =
      typeof previousJob.input.relativeDirectory === "string"
        ? previousJob.input.relativeDirectory
        : "";
    recursiveScans[layer.id] =
      typeof previousJob.input.recursive === "boolean"
        ? previousJob.input.recursive
        : true;
    restoredPhotoScanLayerIds.add(layer.id);
  }
}

watch(
  [() => store.items.map(({ id }) => id), () => store.jobs.map(({ id }) => id)],
  restorePhotoScanSettings,
  { immediate: true },
);

async function run(action: () => Promise<unknown>): Promise<void> {
  busy.value = true;
  localError.value = null;
  try {
    await action();
    emit("changed");
  } catch (error) {
    localError.value =
      error instanceof Error ? error.message : "The layer operation failed.";
  } finally {
    busy.value = false;
  }
}

async function focusPrimaryLayerAction(layerId: string): Promise<void> {
  await nextTick();
  document
    .querySelector<HTMLElement>(`[data-layer-editor-id="${layerId}"]`)
    ?.querySelector<HTMLElement>("[data-layer-primary-action]")
    ?.focus();
}

function add(): void {
  const enteredName = newLayerName.value.trim();
  const segments =
    enteredName === ""
      ? [suggestedLayerName.value]
      : layerNameSegments(enteredName);
  if (segments.some((segment) => segment.length === 0)) {
    addDialogError.value = "Use / only between non-empty folder names.";
    return;
  }
  const name = segments.join("/");
  const pluginId = newLayerPluginId.value;
  if (pluginId === MAP_SET_LAYER_PLUGIN_ID && newLayerMapSetId.value === "") {
    addDialogError.value = "Choose a Map Set.";
    return;
  }
  busy.value = true;
  addDialogError.value = null;
  void store
    .create(
      pluginId,
      name,
      pluginId === MAP_SET_LAYER_PLUGIN_ID
        ? {
            mapSetId: newLayerMapSetId.value,
            allowProviderRequests: false,
          }
        : {},
    )
    .then(async (layer) => {
      addDialogOpen.value = false;
      if (pluginId === "photo-layer") {
        scanDirectories[layer.id] = "";
        recursiveScans[layer.id] = true;
      }
      const categoryId =
        categoryIdByPlugin.get(layer.pluginId) ?? layer.pluginId;
      const ancestorKeys = new Set(
        layerHierarchyAncestorKeys(categoryId, layer.name),
      );
      collapsedHierarchyKeys.value = collapsedHierarchyKeys.value.filter(
        (key) => !ancestorKeys.has(key),
      );
      saveCollapsedLayerHierarchy(collapsedHierarchyKeys.value, browserStorage);
      selectLayer(layer.id);
      busy.value = false;
      emit("changed");
      await focusPrimaryLayerAction(layer.id);
    })
    .catch((error: unknown) => {
      addDialogError.value =
        error instanceof Error
          ? error.message
          : "The Layer could not be created.";
    })
    .finally(() => {
      busy.value = false;
    });
}

function openAddDialog(): void {
  newLayerName.value = "";
  newLayerPluginId.value = "track-layer";
  newLayerMapSetId.value = mapSets.items[0]?.id ?? "";
  addDialogError.value = null;
  addDialogOpen.value = true;
}

function setTreeVisibility(nodeId: string, visible: boolean): void {
  const layerIds = selectorModel.value.layerIdsByNode.get(nodeId) ?? [];
  if (layerIds.length > 0) {
    void run(() =>
      Promise.all(layerIds.map((id) => store.update(id, { visible }))),
    );
  }
}

function move(layer: Layer, direction: -1 | 1): void {
  const siblings = siblingLayers(layer);
  const index = siblings.findIndex(({ id }) => id === layer.id);
  const target = siblings[index + direction];
  if (target !== undefined) {
    void run(() => store.swapOrder(layer.id, target.id));
  }
}

function siblingLayers(layer: Layer): Layer[] {
  const categoryId = categoryIdByPlugin.get(layer.pluginId) ?? layer.pluginId;
  const parentPath = layerParentPath(layer.name);
  return store.items
    .filter(
      (candidate) =>
        (categoryIdByPlugin.get(candidate.pluginId) ?? candidate.pluginId) ===
          categoryId && layerParentPath(candidate.name) === parentPath,
    )
    .sort(
      (left, right) =>
        left.displayOrder - right.displayOrder ||
        left.name.localeCompare(right.name),
    );
}

function canMove(layer: Layer, direction: -1 | 1): boolean {
  const siblings = siblingLayers(layer);
  const index = siblings.findIndex(({ id }) => id === layer.id);
  return siblings[index + direction] !== undefined;
}

function setVisibility(layer: Layer, visible: boolean): void {
  void run(() => store.update(layer.id, { visible }));
}

function setSelectedVisibility(visible: boolean): void {
  if (selectedLayer.value !== null) {
    setVisibility(selectedLayer.value, visible);
  }
}

function setOpacity(layer: Layer, opacity: number): void {
  void run(() => store.update(layer.id, { opacity }));
}

function setSelectedOpacity(opacity: number): void {
  if (selectedLayer.value !== null) {
    setOpacity(selectedLayer.value, opacity);
  }
}

function setZoom(
  layer: Layer,
  key: "minimumZoom" | "maximumZoom",
  value: number | null,
): void {
  void run(() => store.update(layer.id, { [key]: value }));
}

function setSelectedZoom(
  key: "minimumZoom" | "maximumZoom",
  value: number | null,
): void {
  if (selectedLayer.value !== null) {
    setZoom(selectedLayer.value, key, value);
  }
}

function setConfiguration(
  layer: Layer,
  key: string,
  value: string | number | boolean,
): void {
  void run(() =>
    store.update(layer.id, {
      configuration: { ...layer.configuration, [key]: value },
    }),
  );
}

function setSelectedConfiguration(
  key: string,
  value: string | number | boolean,
): void {
  if (selectedLayer.value !== null) {
    setConfiguration(selectedLayer.value, key, value);
  }
}

function withSelectedLayer(action: (layer: Layer) => void): void {
  if (selectedLayer.value !== null) {
    action(selectedLayer.value);
  }
}

function renameLayer(layer: Layer): void {
  const name = window.prompt("Layer name/path", layer.name)?.trim();
  if (name !== undefined && name !== "" && name !== layer.name) {
    void run(() => store.update(layer.id, { name }));
  }
}

function removeLayer(layer: Layer): void {
  if (!window.confirm(`Delete layer “${layer.name}”?`)) {
    return;
  }
  const index = store.items.findIndex(({ id }) => id === layer.id);
  const nextSelection =
    store.items[index + 1]?.id ?? store.items[index - 1]?.id ?? null;
  void run(async () => {
    await store.remove(layer.id);
    selectLayer(nextSelection);
  });
}

function uploadTrack(layerId: string, file: File): void {
  void run(() => store.uploadTrack(layerId, file));
}

function startPhotoScan(layerId: string): void {
  if (!store.photoDirectory.available) {
    localError.value = "The configured photo directory is unavailable.";
    return;
  }
  const relativeDirectory = (scanDirectories[layerId] ?? "").trim();
  if (relativeDirectory === "") {
    localError.value = "Choose a photo subdirectory before starting a scan.";
    return;
  }
  void run(async () => {
    const job = await store.startPhotoScan(layerId, {
      relativeDirectory,
      recursive: recursiveScans[layerId] ?? true,
    });
    visibleScanResultJobIds.value = new Set([
      ...visibleScanResultJobIds.value,
      job.id,
    ]);
  });
}

function openPhotoDirectoryBrowser(layer: Layer): void {
  if (!store.photoDirectory.available) {
    localError.value = "The configured photo directory is unavailable.";
    return;
  }
  photoDirectoryBrowserLayerId.value = layer.id;
}

function scanPhotoDirectory(relativeDirectory: string): void {
  const layerId = photoDirectoryBrowserLayerId.value;
  if (layerId === null) return;
  scanDirectories[layerId] = relativeDirectory;
  photoDirectoryBrowserLayerId.value = null;
  startPhotoScan(layerId);
}

function openAsset(asset: LayerAsset): void {
  editingAsset.value = asset;
  editLongitude.value = asset.longitude?.toString() ?? "";
  editLatitude.value = asset.latitude?.toString() ?? "";
}

function openFirstPhoto(layerId: string): void {
  void (async () => {
    busy.value = true;
    localError.value = null;
    try {
      await store.ensureAssets(layerId);
      const asset = photoAssets(layerId)[0];
      if (asset === undefined) {
        localError.value = "The Photo catalog is empty.";
        return;
      }
      openAsset(asset);
    } catch (error) {
      localError.value =
        error instanceof Error
          ? error.message
          : "The Photo catalog could not be loaded.";
    } finally {
      busy.value = false;
    }
  })();
}

function loadMorePhotos(layerId: string): void {
  void (async () => {
    busy.value = true;
    localError.value = null;
    try {
      await store.loadMoreAssets(layerId);
    } catch (error) {
      localError.value =
        error instanceof Error
          ? error.message
          : "More Photos could not be loaded.";
    } finally {
      busy.value = false;
    }
  })();
}

function controlJob(id: string, action: "pause" | "resume" | "cancel"): void {
  void run(() => store.controlJob(id, action));
}

function numberOrNull(value: string): number | null {
  return value.trim() === "" ? null : Number(value);
}

function saveAsset(): void {
  const asset = editingAsset.value;
  if (asset === null) {
    return;
  }
  void run(async () => {
    await store.updateAsset(asset.layerId, asset.id, {
      longitude: numberOrNull(editLongitude.value),
      latitude: numberOrNull(editLatitude.value),
    });
    editingAsset.value = null;
  });
}

function centerEditingPhoto(): void {
  if (editingCoordinate.value !== null) {
    emit("centerMap", editingCoordinate.value);
  }
}

async function pollJobs(): Promise<void> {
  await store.loadJobs();
  const current = new Set(activeJobs.value.map(({ id }) => id));
  const finishedJobIds = [...previousRunningJobs].filter(
    (id) => !current.has(id),
  );
  const finished = finishedJobIds.length > 0;
  if (panelOpen.value && finished) {
    visibleScanResultJobIds.value = new Set([
      ...visibleScanResultJobIds.value,
      ...finishedJobIds,
    ]);
  }
  previousRunningJobs = current;
  if (finished) {
    await Promise.all(
      store.items
        .filter(
          (layer) =>
            layer.pluginId === "photo-layer" && store.assetsLoaded(layer.id),
        )
        .map((layer) => store.loadAssets(layer.id)),
    );
    emit("changed");
  }
}

onMounted(async () => {
  await Promise.all([store.loadPhotoDirectory(), store.loadJobs()]);
  restorePhotoScanSettings();
  previousRunningJobs = new Set(activeJobs.value.map(({ id }) => id));
  jobPoll = window.setInterval(() => void pollJobs(), 1000);
});

onBeforeUnmount(() => {
  if (jobPoll !== null) {
    window.clearInterval(jobPoll);
  }
});
</script>

<template>
  <MapSideControlButton
    label="Layers"
    :expanded="panelOpen"
    @click="togglePanel"
  >
    <i class="mdi mdi-layers-triple-outline" aria-hidden="true"></i>
  </MapSideControlButton>

  <DialogWindow
    ref="layerDialog"
    :open="panelOpen"
    title="Layers"
    :is-modal="false"
    :content-scrollable="false"
    fit-content
    initial-position="map-controls"
    @close="closePanel"
  >
    <template #header-actions>
      <button
        type="button"
        class="layer-add-button"
        :disabled="!enabled || busy"
        @click="openAddDialog"
      >
        <i class="mdi mdi-plus" aria-hidden="true"></i>Add layer
      </button>
    </template>
    <section class="layer-panel" :aria-busy="busy">
      <p v-if="!enabled" class="layer-note">Layer rendering is unavailable for this Map Set.</p>
      <p v-else-if="store.loading" class="layer-note">Loading layers…</p>
      <p v-else-if="store.items.length === 0" class="layer-note">No layers yet.</p>
      <p v-if="localError || store.error" class="layer-error" role="alert">
        {{ localError || store.error }}
      </p>

      <TreeSelectDropdown
        v-if="store.items.length > 0"
        :model-value="selectedLayerId"
        :nodes="selectorModel.nodes"
        :expanded-ids="expandedHierarchyIds"
        label="Layer"
        placeholder="Select a layer"
        root-icon-only
        :disabled="!enabled || busy"
        @update:model-value="selectLayer"
        @update:expanded-ids="expandedHierarchyIds = $event"
        @check="setTreeVisibility"
        @open-change="selectorOpen = $event"
      />

      <LayerEditor
        v-if="selectedLayer"
        v-show="!selectorOpen"
        :layer="selectedLayer"
        :configuration-schema="layerPlugins.get(selectedLayer.pluginId)?.manifest.configurationSchema ?? {}"
        :compatibility-diagnostic="compatibilityDiagnostic(selectedLayer)"
        :busy="busy"
        :can-move-up="canMove(selectedLayer, -1)"
        :can-move-down="canMove(selectedLayer, 1)"
        :photo-directory="store.photoDirectory"
        :scan-directory="scanDirectories[selectedLayer.id] ?? ''"
        :recursive-scan="recursiveScans[selectedLayer.id] ?? true"
        :active-scan-job="scanJob(selectedLayer.id)"
        :displayed-scan-job="displayedScanJob(selectedLayer.id)"
        :photo-count="photoAssets(selectedLayer.id).length"
        :photos-loaded="store.assetsLoaded(selectedLayer.id)"
        :has-more-photos="store.hasMoreAssets(selectedLayer.id)"
        @visibility-change="setSelectedVisibility"
        @opacity-change="setSelectedOpacity"
        @zoom-change="setSelectedZoom"
        @configuration-change="setSelectedConfiguration"
        @rename="withSelectedLayer(renameLayer)"
        @move="withSelectedLayer((layer) => move(layer, $event))"
        @remove="withSelectedLayer(removeLayer)"
        @upload-track="withSelectedLayer((layer) => uploadTrack(layer.id, $event))"
        @update:recursive-scan="withSelectedLayer((layer) => { recursiveScans[layer.id] = $event; })"
        @browse-scan-directory="withSelectedLayer(openPhotoDirectoryBrowser)"
        @scan-job-action="withSelectedLayer((layer) => { const job = scanJob(layer.id); if (job) controlJob(job.id, $event); })"
        @manage-photos="withSelectedLayer((layer) => openFirstPhoto(layer.id))"
        @fit-photos="withSelectedLayer((layer) => emit('fitPhotoLayer', layer.id))"
      />
    </section>
  </DialogWindow>

  <DialogWindow :open="addDialogOpen" title="Add layer" @close="addDialogOpen = false">
    <form class="add-dialog" @submit.prevent="add">
      <fieldset class="layer-type-picker">
        <legend>Category</legend>
        <div class="layer-type-options" role="radiogroup" aria-label="Layer category">
          <button
            v-for="type in creatableLayerTypes"
            :key="type.id"
            type="button"
            role="radio"
            class="layer-type-option"
            :class="{ selected: newLayerPluginId === type.id }"
            :aria-checked="newLayerPluginId === type.id"
            :disabled="busy"
            @click="newLayerPluginId = type.id"
          >
            <i class="mdi" :class="type.icon" aria-hidden="true"></i>
            <span>{{ type.label }}</span>
          </button>
        </div>
      </fieldset>
      <label v-if="newLayerPluginId === MAP_SET_LAYER_PLUGIN_ID">
        <span>Source Map Set</span>
        <select v-model="newLayerMapSetId" :disabled="busy">
          <option disabled value="">Choose a Map Set</option>
          <option v-for="mapSet in mapSets.items" :key="mapSet.id" :value="mapSet.id">
            {{ mapSet.name }}
          </option>
        </select>
      </label>
      <label>
        <span>Name or folder/name (optional)</span>
        <input
          v-model="newLayerName"
          type="text"
          maxlength="120"
          :placeholder="suggestedLayerName"
        />
      </label>
      <small>Leave blank for {{ suggestedLayerName }}. Use / to create additional hierarchy levels.</small>
      <p v-if="addDialogError" class="layer-error" role="alert">{{ addDialogError }}</p>
      <button
        type="submit"
        :disabled="busy || (newLayerPluginId === MAP_SET_LAYER_PLUGIN_ID && newLayerMapSetId === '')"
      >
        <i class="mdi mdi-plus" aria-hidden="true"></i>Add layer
      </button>
    </form>
  </DialogWindow>

  <PhotoDirectoryBrowser
    :open="photoDirectoryBrowserLayerId !== null"
    :initial-directory="photoDirectoryBrowserLayerId === null ? '' : (scanDirectories[photoDirectoryBrowserLayerId] ?? '')"
    @close="photoDirectoryBrowserLayerId = null"
    @select="scanPhotoDirectory"
  />

  <DialogWindow
    :open="editingAsset !== null"
    title="Photo position"
    fit-content
    allow-viewport-height
    resizable
    @close="editingAsset = null"
  >
    <div v-if="editingAsset" class="asset-editor">
      <aside class="asset-list">
        <input v-model="assetSearch" type="search" placeholder="Filter photos" />
        <small v-if="filteredAssetCount > filteredPhotoAssets.length">
          Showing {{ filteredPhotoAssets.length }} of {{ filteredAssetCount }} loaded matches
        </small>
        <button
          v-if="store.hasMoreAssets(editingAsset.layerId)"
          type="button"
          :disabled="busy"
          @click="loadMorePhotos(editingAsset.layerId)"
        >Load more photos</button>
        <button
          v-for="asset in filteredPhotoAssets"
          :key="asset.id"
          type="button"
          :class="{ selected: asset.id === editingAsset.id }"
          @click="openAsset(asset)"
        >
          <span>{{ asset.fileName }}</span>
          <small>{{ asset.status }} · {{ asset.coordinateSource }}</small>
        </button>
      </aside>
      <section class="asset-detail">
        <strong>{{ editingAsset.fileName }}</strong>
        <small v-if="editingAsset.relativePath">{{ editingAsset.relativePath }}</small>
        <div v-if="editingAsset.previewAvailable" class="photo-preview">
          <img
            :src="`api/layers/${editingAsset.layerId}/assets/${editingAsset.id}`"
            :alt="editingAsset.fileName"
          />
          <button
            type="button"
            class="photo-preview-center"
            title="Center map here"
            aria-label="Center map here"
            :disabled="editingCoordinate === null"
            @click="centerEditingPhoto"
          >
            <i class="mdi mdi-crosshairs-gps" aria-hidden="true"></i>
          </button>
        </div>
        <section
          v-if="editingPhotoMetadataRows.length > 0"
          class="photo-metadata"
          aria-label="Photo metadata"
        >
          <strong>Photo metadata</strong>
          <dl>
            <div v-for="row in editingPhotoMetadataRows" :key="row.label">
              <dt>{{ row.label }}</dt>
              <dd>{{ row.value }}</dd>
            </div>
          </dl>
        </section>
        <p v-if="editingAsset.errorMessage" class="layer-error">{{ editingAsset.errorMessage }}</p>
        <div class="coordinate-fields">
          <label><span>Longitude</span><input v-model="editLongitude" type="number" step="any" /></label>
          <label><span>Latitude</span><input v-model="editLatitude" type="number" step="any" /></label>
        </div>
      </section>
    </div>
    <template #footer>
      <button type="button" @click="editingAsset = null">Cancel</button>
      <button type="button" :disabled="busy" @click="saveAsset">Save position</button>
    </template>
  </DialogWindow>
</template>

<style scoped>
.layer-panel {
  display: grid;
  gap: 0.7rem;
  min-height: 0;
  width: min(25rem, 82vw);
  max-height: min(38rem, calc(100dvh - 7.6rem));
  overflow: hidden;
}

.coordinate-fields {
  display: flex;
  gap: 0.45rem;
  align-items: center;
}

.layer-add-button,
.add-dialog > button {
  display: inline-flex;
  gap: 0.3rem;
  align-items: center;
  padding: 0.35rem 0.5rem;
  border: 1px solid #9aada6;
  border-radius: 0.35rem;
  color: #173d35;
  background: #fff;
  font: inherit;
  cursor: pointer;
}

.layer-note,
.layer-error {
  margin: 0;
}

.layer-error {
  color: #a22f26;
}

.asset-editor,
.asset-editor fieldset,
.asset-list,
.asset-detail,
.add-dialog {
  display: grid;
  gap: 0.5rem;
}

.asset-editor {
  grid-template-columns: minmax(10rem, 15rem) minmax(18rem, 30rem);
  width: min(48rem, 82vw);
  max-height: 68vh;
}

.add-dialog > label,
.asset-editor label {
  display: grid;
  gap: 0.2rem;
}

.layer-type-picker {
  margin: 0;
  padding: 0;
  border: 0;
}

.layer-type-options {
  display: grid;
  grid-template-columns: repeat(2, minmax(7rem, 1fr));
  gap: 0.6rem;
  margin-top: 0.3rem;
}

.layer-type-option {
  display: grid;
  gap: 0.25rem;
  min-height: 5.5rem;
  padding: 0.65rem;
  place-items: center;
  border: 1px solid #9aada6;
  border-radius: 0.5rem;
  color: #173d35;
  background: #fff;
  font: inherit;
  cursor: pointer;
}

.layer-type-option > i {
  font-size: 2rem;
  line-height: 1;
}

.layer-type-option:hover,
.layer-type-option:focus-visible {
  border-color: #a34521;
}

.layer-type-option.selected {
  border-color: #286b5d;
  background: #e5f0eb;
  box-shadow: inset 0 0 0 1px #286b5d;
}

.add-dialog > button {
  justify-self: end;
  border-color: #286b5d;
  color: #fff;
  background: #286b5d;
}

.asset-list {
  align-content: start;
  overflow: auto;
}

.asset-list button {
  display: grid;
  gap: 0.15rem;
  padding: 0.4rem;
  border: 1px solid #d2ded9;
  border-radius: 0.35rem;
  background: #fff;
  text-align: left;
}

.asset-list button.selected {
  border-color: #286b5d;
  background: #e5f0eb;
}

.asset-list small,
.asset-detail small {
  color: #617870;
}

.asset-detail {
  align-content: start;
  min-height: 0;
  padding-right: 0.15rem;
  overflow-y: auto;
}

.photo-preview {
  position: relative;
  display: grid;
  min-width: 0;
  place-items: center;
}

.photo-preview img {
  width: 100%;
  max-height: 18rem;
  object-fit: contain;
}

.photo-preview-center {
  position: absolute;
  top: 0.4rem;
  left: 0.4rem;
  display: grid;
  width: 2rem;
  height: 2rem;
  padding: 0;
  place-items: center;
  border: 0;
  border-radius: 50%;
  color: #fff;
  background: transparent;
  filter: drop-shadow(0 1px 2px rgb(0 0 0 / 85%));
  font: inherit;
  font-size: 1.35rem;
  cursor: pointer;
}

.photo-preview-center:hover,
.photo-preview-center:focus-visible {
  background: rgb(22 56 50 / 68%);
}

.photo-preview-center:focus-visible {
  outline: 2px solid #fff;
  outline-offset: 1px;
}

.photo-preview-center:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.coordinate-fields > label {
  flex: 1;
}

.photo-metadata {
  display: grid;
  gap: 0.3rem;
  padding: 0.5rem 0.6rem;
  border: 1px solid #d2ded9;
  border-radius: 0.35rem;
  background: #f8fbfa;
}

.photo-metadata dl {
  display: grid;
  gap: 0.2rem;
  margin: 0;
}

.photo-metadata dl > div {
  display: grid;
  grid-template-columns: minmax(7rem, 0.4fr) minmax(0, 1fr);
  gap: 0.5rem;
}

.photo-metadata dt {
  color: #617870;
  font-size: 0.78rem;
}

.photo-metadata dd {
  min-width: 0;
  margin: 0;
  overflow-wrap: anywhere;
}

@media (max-width: 650px) {
  .asset-editor {
    grid-template-columns: 1fr;
  }

  .asset-list {
    max-height: 10rem;
  }
}
</style>
