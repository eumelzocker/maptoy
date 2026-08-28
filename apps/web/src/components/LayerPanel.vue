<script setup lang="ts">
// biome-ignore-all lint/correctness/noUnusedImports: Vue template references are not detected by Biome.
// biome-ignore-all lint/correctness/noUnusedVariables: Vue template references are not detected by Biome.
import type { Layer, LayerAsset } from "@maptoy/contracts";
import {
  computed,
  inject,
  nextTick,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
} from "vue";
import {
  buildLayerHierarchyRows,
  type LayerCategoryDefinition,
  layerHierarchyAncestorKeys,
  layerNameSegments,
  layerParentPath,
  nextNumberedLayerName,
  visibleLayerHierarchyRows,
} from "../layerHierarchy.js";
import {
  loadCollapsedLayerHierarchy,
  loadExpandedLayerConfigurations,
  saveCollapsedLayerHierarchy,
  saveExpandedLayerConfigurations,
} from "../layerPanelPreferences.js";
import { availableLocalStorage } from "../localStorage.js";
import { LAYER_PLUGIN_REGISTRY_KEY } from "../registries.js";
import { useLayersStore } from "../stores/layers.js";
import CenteredDialog from "./CenteredDialog.vue";
import TogglePanel from "./TogglePanel.vue";

defineProps<{ enabled: boolean }>();

const emit = defineEmits<{ changed: [] }>();
const store = useLayersStore();
const layerPlugins = inject(LAYER_PLUGIN_REGISTRY_KEY);
if (layerPlugins === undefined) {
  throw new Error("Layer plugin registry is not available.");
}
const browserStorage = availableLocalStorage();
const busy = ref(false);
const localError = ref<string | null>(null);
const addDialogOpen = ref(false);
const addDialogError = ref<string | null>(null);
const newLayerName = ref("");
const newLayerPluginId = ref<"track-layer" | "image-layer">("track-layer");
const assetSearch = ref("");
const rootSelections = reactive<Record<string, string>>({});
const scanDirectories = reactive<Record<string, string>>({});
const recursiveScans = reactive<Record<string, boolean>>({});
const editingAsset = ref<LayerAsset | null>(null);
const editLongitude = ref("");
const editLatitude = ref("");
const editBounds = reactive({ west: "", south: "", east: "", north: "" });
const expandedLayerIds = ref(loadExpandedLayerConfigurations(browserStorage));
const collapsedHierarchyKeys = ref(loadCollapsedLayerHierarchy(browserStorage));
let jobPoll: number | null = null;
let previousRunningJobs = new Set<string>();

const categoryDefinitions: Array<
  LayerCategoryDefinition & { pluginIds: string[] }
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
const hierarchyRows = computed(() =>
  buildLayerHierarchyRows(store.items, categoryDefinitions),
);
const visibleHierarchyRows = computed(() =>
  visibleLayerHierarchyRows(
    hierarchyRows.value,
    new Set(collapsedHierarchyKeys.value),
  ),
);
const creatableLayerTypes = [
  {
    id: "track-layer" as const,
    icon: "mdi-vector-polyline",
    defaultName: "Track",
  },
  {
    id: "image-layer" as const,
    icon: "mdi-image-marker",
    defaultName: "Image",
  },
].map((type) => ({
  ...type,
  label:
    layerPlugins.get(type.id)?.manifest.category.displayName ??
    layerPlugins.get(type.id)?.manifest.displayName ??
    type.id,
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
      job.type === "image-scan" &&
      ["queued", "running", "paused"].includes(job.status),
  ),
);
const filteredImageAssets = computed(() => {
  const layerId = editingAsset.value?.layerId;
  if (layerId === undefined) {
    return [];
  }
  const query = assetSearch.value.trim().toLocaleLowerCase();
  return imageAssets(layerId)
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
  return imageAssets(layerId).filter(
    (asset) =>
      query === "" ||
      asset.fileName.toLocaleLowerCase().includes(query) ||
      asset.relativePath?.toLocaleLowerCase().includes(query),
  ).length;
});

function imageAssets(layerId: string): LayerAsset[] {
  return (store.assetsByLayer[layerId] ?? []).filter(
    (asset) => asset.kind === "external-image",
  );
}

function scanJob(layerId: string) {
  return activeJobs.value.find((job) => job.input.layerId === layerId);
}

function displayedScanJob(layerId: string) {
  return (
    scanJob(layerId) ??
    store.jobs.find(
      (job) => job.type === "image-scan" && job.input.layerId === layerId,
    )
  );
}

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
  const layerElement = [
    ...document.querySelectorAll<HTMLElement>("[data-layer-id]"),
  ].find((element) => element.dataset.layerId === layerId);
  layerElement
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
  busy.value = true;
  addDialogError.value = null;
  void store
    .create(pluginId, name)
    .then(async (layer) => {
      addDialogOpen.value = false;
      if (pluginId === "image-layer") {
        rootSelections[layer.id] =
          store.imageRoots.find((root) => root.available)?.id ?? "";
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
      if (!isLayerConfigurationExpanded(layer.id)) {
        setExpandedLayerIds([...expandedLayerIds.value, layer.id]);
      }
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
  addDialogError.value = null;
  addDialogOpen.value = true;
}

function layerConfigurationId(layerId: string): string {
  return `layer-configuration-${layerId}`;
}

function isLayerConfigurationExpanded(layerId: string): boolean {
  return expandedLayerIds.value.includes(layerId);
}

function setExpandedLayerIds(layerIds: string[]): void {
  expandedLayerIds.value = layerIds;
  saveExpandedLayerConfigurations(layerIds, browserStorage);
}

function toggleLayerConfiguration(layerId: string): void {
  setExpandedLayerIds(
    isLayerConfigurationExpanded(layerId)
      ? expandedLayerIds.value.filter((id) => id !== layerId)
      : [...expandedLayerIds.value, layerId],
  );
}

function isHierarchyExpanded(key: string): boolean {
  return !collapsedHierarchyKeys.value.includes(key);
}

function toggleHierarchy(key: string): void {
  collapsedHierarchyKeys.value = isHierarchyExpanded(key)
    ? [...collapsedHierarchyKeys.value, key]
    : collapsedHierarchyKeys.value.filter((nodeKey) => nodeKey !== key);
  saveCollapsedLayerHierarchy(collapsedHierarchyKeys.value, browserStorage);
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

function setVisibility(layer: Layer, event: Event): void {
  void run(() =>
    store.update(layer.id, {
      visible: (event.target as HTMLInputElement).checked,
    }),
  );
}

function setOpacity(layer: Layer, event: Event): void {
  void run(() =>
    store.update(layer.id, {
      opacity: Number((event.target as HTMLInputElement).value),
    }),
  );
}

function setZoom(
  layer: Layer,
  key: "minimumZoom" | "maximumZoom",
  event: Event,
): void {
  const value = (event.target as HTMLInputElement).value;
  void run(() =>
    store.update(layer.id, { [key]: value === "" ? null : Number(value) }),
  );
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

function renameLayer(layer: Layer): void {
  const name = window.prompt("Layer name/path", layer.name)?.trim();
  if (name !== undefined && name !== "" && name !== layer.name) {
    void run(() => store.update(layer.id, { name }));
  }
}

function removeLayer(layer: Layer): void {
  if (window.confirm(`Delete layer “${layer.name}”?`)) {
    void run(async () => {
      await store.remove(layer.id);
      setExpandedLayerIds(
        expandedLayerIds.value.filter((id) => id !== layer.id),
      );
    });
  }
}

function uploadTrack(layerId: string, event: Event): void {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file !== undefined) {
    void run(() => store.uploadTrack(layerId, file));
  }
  input.value = "";
}

function startScan(layerId: string): void {
  const rootId = rootSelections[layerId] ?? "";
  if (rootId === "") {
    localError.value = "Select an available image root.";
    return;
  }
  void run(() =>
    store.startImageScan(layerId, {
      rootId,
      relativeDirectory: scanDirectories[layerId] ?? "",
      recursive: recursiveScans[layerId] ?? true,
    }),
  );
}

function openAsset(asset: LayerAsset): void {
  editingAsset.value = asset;
  editLongitude.value = asset.longitude?.toString() ?? "";
  editLatitude.value = asset.latitude?.toString() ?? "";
  editBounds.west = asset.bounds?.west.toString() ?? "";
  editBounds.south = asset.bounds?.south.toString() ?? "";
  editBounds.east = asset.bounds?.east.toString() ?? "";
  editBounds.north = asset.bounds?.north.toString() ?? "";
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
  const values = [
    editBounds.west,
    editBounds.south,
    editBounds.east,
    editBounds.north,
  ];
  const bounds = values.some((value) => value.trim() !== "")
    ? {
        west: Number(editBounds.west),
        south: Number(editBounds.south),
        east: Number(editBounds.east),
        north: Number(editBounds.north),
      }
    : null;
  void run(async () => {
    await store.updateAsset(asset.layerId, asset.id, {
      longitude: numberOrNull(editLongitude.value),
      latitude: numberOrNull(editLatitude.value),
      bounds,
    });
    editingAsset.value = null;
  });
}

async function pollJobs(): Promise<void> {
  await store.loadJobs();
  const current = new Set(activeJobs.value.map(({ id }) => id));
  const finished = [...previousRunningJobs].some((id) => !current.has(id));
  previousRunningJobs = current;
  if (finished) {
    await Promise.all(
      store.items
        .filter((layer) => layer.pluginId === "image-layer")
        .map((layer) => store.loadAssets(layer.id)),
    );
    emit("changed");
  }
}

onMounted(async () => {
  await Promise.all([store.loadImageRoots(), store.loadJobs()]);
  for (const layer of store.items) {
    if (layer.pluginId === "image-layer") {
      rootSelections[layer.id] =
        store.imageRoots.find((root) => root.available)?.id ?? "";
      recursiveScans[layer.id] = true;
    }
  }
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
  <TogglePanel
    label="Layers"
    align="start"
    :suspend-outside-close="addDialogOpen || editingAsset !== null"
  >
    <template #trigger>
      <i class="mdi mdi-layers-triple-outline" aria-hidden="true"></i>
    </template>
    <section class="layer-panel" :aria-busy="busy">
      <header>
        <strong>Layers</strong>
        <div class="add-actions">
          <button type="button" :disabled="!enabled || busy" @click="openAddDialog">
            <i class="mdi mdi-plus" aria-hidden="true"></i>Add layer
          </button>
        </div>
      </header>

      <p v-if="!enabled" class="layer-note">Layer rendering is unavailable for this Map Set.</p>
      <p v-else-if="store.loading" class="layer-note">Loading layers…</p>
      <p v-else-if="store.items.length === 0" class="layer-note">No layers yet.</p>
      <p v-if="localError || store.error" class="layer-error" role="alert">
        {{ localError || store.error }}
      </p>

      <ol class="layer-list">
        <li
          v-for="row in visibleHierarchyRows"
          :key="row.key"
          :class="`hierarchy-${row.kind}`"
          :style="{ marginLeft: `${row.depth * 0.8}rem` }"
        >
          <button
            v-if="row.kind !== 'layer'"
            type="button"
            class="hierarchy-heading hierarchy-toggle"
            :class="row.kind === 'category' ? 'category-toggle' : 'folder-toggle'"
            :aria-expanded="isHierarchyExpanded(row.key)"
            :aria-label="isHierarchyExpanded(row.key) ? `Collapse ${row.label}` : `Expand ${row.label}`"
            @click="toggleHierarchy(row.key)"
          >
            <i
              class="mdi"
              :class="isHierarchyExpanded(row.key) ? 'mdi-chevron-down' : 'mdi-chevron-right'"
              aria-hidden="true"
            ></i>
            <i
              class="mdi"
              :class="row.kind === 'category' ? 'mdi-folder-multiple-outline' : 'mdi-folder-outline'"
              aria-hidden="true"
            ></i>
            <strong v-if="row.kind === 'category'">{{ row.label }}</strong>
            <span v-else>{{ row.label }}</span>
          </button>
          <div
            v-else
            v-for="layer in row.kind === 'layer' ? [row.layer] : []"
            :key="layer.id"
            class="layer-entry-content"
            :data-layer-id="layer.id"
          >
            <div class="layer-heading">
            <label>
              <input
                type="checkbox"
                :checked="layer.visible"
                :disabled="busy || layer.status !== 'ready'"
                @change="setVisibility(layer, $event)"
              />
              <span :title="layer.name">{{ row.label }}</span>
            </label>
            <span v-if="layer.status !== 'ready'" class="layer-status">{{ layer.status }}</span>
            <button
              type="button"
              class="configuration-toggle"
              :title="isLayerConfigurationExpanded(layer.id) ? 'Collapse layer configuration' : 'Expand layer configuration'"
              :aria-label="isLayerConfigurationExpanded(layer.id) ? `Collapse configuration for ${layer.name}` : `Expand configuration for ${layer.name}`"
              :aria-expanded="isLayerConfigurationExpanded(layer.id)"
              :aria-controls="layerConfigurationId(layer.id)"
              @click="toggleLayerConfiguration(layer.id)"
            >
              <i
                class="mdi"
                :class="isLayerConfigurationExpanded(layer.id) ? 'mdi-chevron-down' : 'mdi-chevron-right'"
                aria-hidden="true"
              ></i>
            </button>
            <button type="button" title="Rename layer" @click="renameLayer(layer)">
              <i class="mdi mdi-pencil-outline" aria-hidden="true"></i>
            </button>
            <button
              type="button"
              title="Move layer up"
              :disabled="!canMove(layer, -1)"
              @click="move(layer, -1)"
            >
              <i class="mdi mdi-arrow-up" aria-hidden="true"></i>
            </button>
            <button
              type="button"
              title="Move layer down"
              :disabled="!canMove(layer, 1)"
              @click="move(layer, 1)"
            >
              <i class="mdi mdi-arrow-down" aria-hidden="true"></i>
            </button>
            <button type="button" title="Delete layer" @click="removeLayer(layer)">
              <i class="mdi mdi-delete-outline" aria-hidden="true"></i>
            </button>
            </div>
            <div
              v-show="isLayerConfigurationExpanded(layer.id)"
              :id="layerConfigurationId(layer.id)"
              class="layer-configuration"
            >
            <label class="opacity-field">
              <span>Opacity</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                :value="layer.opacity"
                :disabled="busy"
                @change="setOpacity(layer, $event)"
              />
            </label>
            <div class="zoom-fields">
              <label>
                <span>Min zoom</span>
                <input
                  type="number"
                  min="0"
                  max="24"
                  :value="layer.minimumZoom ?? ''"
                  @change="setZoom(layer, 'minimumZoom', $event)"
                />
              </label>
              <label>
                <span>Max zoom</span>
                <input
                  type="number"
                  min="0"
                  max="24"
                  :value="layer.maximumZoom ?? ''"
                  @change="setZoom(layer, 'maximumZoom', $event)"
                />
              </label>
            </div>

            <div v-if="layer.pluginId === 'track-layer'" class="plugin-fields">
              <label>
                <span>Line</span>
                <input
                  type="color"
                  :value="String(layer.configuration.lineColor ?? '#d4552d')"
                  @change="setConfiguration(layer, 'lineColor', ($event.target as HTMLInputElement).value)"
                />
              </label>
              <label>
                <span>Line opacity</span>
                <input
                  type="number"
                  min="0"
                  max="1"
                  step="0.1"
                  :value="Number(layer.configuration.lineOpacity ?? 0.9)"
                  @change="setConfiguration(layer, 'lineOpacity', Number(($event.target as HTMLInputElement).value))"
                />
              </label>
              <label>
                <span>Width</span>
                <input
                  type="number"
                  min="1"
                  max="20"
                  :value="Number(layer.configuration.lineWidth ?? 4)"
                  @change="setConfiguration(layer, 'lineWidth', Number(($event.target as HTMLInputElement).value))"
                />
              </label>
            </div>

            <div v-else-if="layer.pluginId === 'image-layer'" class="plugin-fields">
              <label>
                <span>Marker</span>
                <input
                  type="color"
                  :value="String(layer.configuration.pointColor ?? '#c54e2e')"
                  @change="setConfiguration(layer, 'pointColor', ($event.target as HTMLInputElement).value)"
                />
              </label>
              <label class="recursive-field">
                <input
                  type="checkbox"
                  :checked="Boolean(layer.configuration.showPreviews ?? true)"
                  @change="setConfiguration(layer, 'showPreviews', ($event.target as HTMLInputElement).checked)"
                />
                <span>Preview popups</span>
              </label>
              <label>
                <span>Radius</span>
                <input
                  type="number"
                  min="2"
                  max="30"
                  :value="Number(layer.configuration.pointRadius ?? 8)"
                  @change="setConfiguration(layer, 'pointRadius', Number(($event.target as HTMLInputElement).value))"
                />
              </label>
            </div>

            <label v-if="layer.pluginId === 'track-layer'" class="file-action">
              <i class="mdi mdi-upload" aria-hidden="true"></i>
              Import GPX/GeoJSON
              <input
                type="file"
                data-layer-primary-action
                accept=".gpx,.geojson,.json,application/gpx+xml,application/geo+json"
                :disabled="busy"
                @change="uploadTrack(layer.id, $event)"
              />
            </label>

            <div v-else-if="layer.pluginId === 'image-layer'" class="image-tools">
              <label>
                <span>Image root</span>
                <select
                  v-model="rootSelections[layer.id]"
                  :disabled="busy"
                >
                  <option value="">Select…</option>
                  <option
                    v-for="root in store.imageRoots"
                    :key="root.id"
                    :value="root.id"
                    :disabled="!root.available"
                  >
                    {{ root.id }}{{ root.available ? '' : ' (unavailable)' }}
                  </option>
                </select>
              </label>
              <label>
                <span>Subdirectory</span>
                <input v-model="scanDirectories[layer.id]" type="text" placeholder="optional/relative" />
              </label>
              <label class="recursive-field">
                <input v-model="recursiveScans[layer.id]" type="checkbox" />Recursive
              </label>
              <button
                type="button"
                data-layer-primary-action
                :disabled="busy || !!scanJob(layer.id)"
                @click="startScan(layer.id)"
              >
                <i class="mdi mdi-folder-search-outline" aria-hidden="true"></i>Scan directory
              </button>
              <p v-if="displayedScanJob(layer.id)" class="scan-status">
                {{ displayedScanJob(layer.id)?.status }} ·
                {{ displayedScanJob(layer.id)?.completed }}/{{ displayedScanJob(layer.id)?.total }} ·
                new {{ displayedScanJob(layer.id)?.summary.created ?? 0 }} ·
                changed {{ displayedScanJob(layer.id)?.summary.changed ?? 0 }} ·
                missing {{ displayedScanJob(layer.id)?.summary.missing ?? 0 }} ·
                failed {{ displayedScanJob(layer.id)?.summary.failed ?? 0 }}
              </p>
              <div v-if="scanJob(layer.id)" class="job-actions">
                <button
                  v-if="scanJob(layer.id)?.status !== 'paused'"
                  type="button"
                  @click="controlJob(scanJob(layer.id)!.id, 'pause')"
                >Pause</button>
                <button
                  v-else
                  type="button"
                  @click="controlJob(scanJob(layer.id)!.id, 'resume')"
                >Resume</button>
                <button type="button" @click="controlJob(scanJob(layer.id)!.id, 'cancel')">
                  Cancel
                </button>
              </div>
              <button
                v-if="imageAssets(layer.id).length > 0"
                type="button"
                @click="openAsset(imageAssets(layer.id)[0]!)"
              >
                Manage {{ imageAssets(layer.id).length }} images
              </button>
            </div>
              </div>
          </div>
        </li>
      </ol>
    </section>
  </TogglePanel>

  <CenteredDialog :open="addDialogOpen" title="Add layer" @close="addDialogOpen = false">
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
      <button type="submit" :disabled="busy">
        <i class="mdi mdi-plus" aria-hidden="true"></i>Add layer
      </button>
    </form>
  </CenteredDialog>

  <CenteredDialog
    :open="editingAsset !== null"
    title="Image position"
    @close="editingAsset = null"
  >
    <div v-if="editingAsset" class="asset-editor">
      <aside class="asset-list">
        <input v-model="assetSearch" type="search" placeholder="Filter images" />
        <small v-if="filteredAssetCount > filteredImageAssets.length">
          Showing {{ filteredImageAssets.length }} of {{ filteredAssetCount }} matches
        </small>
        <button
          v-for="asset in filteredImageAssets"
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
        <img
          v-if="editingAsset.previewAvailable"
          :src="`api/layers/${editingAsset.layerId}/assets/${editingAsset.id}`"
          :alt="editingAsset.fileName"
        />
        <p v-if="editingAsset.errorMessage" class="layer-error">{{ editingAsset.errorMessage }}</p>
        <div class="coordinate-fields">
          <label><span>Longitude</span><input v-model="editLongitude" type="number" step="any" /></label>
          <label><span>Latitude</span><input v-model="editLatitude" type="number" step="any" /></label>
        </div>
        <fieldset>
          <legend>Geographic bounds (alternative to point)</legend>
          <label><span>West</span><input v-model="editBounds.west" type="number" step="any" /></label>
          <label><span>South</span><input v-model="editBounds.south" type="number" step="any" /></label>
          <label><span>East</span><input v-model="editBounds.east" type="number" step="any" /></label>
          <label><span>North</span><input v-model="editBounds.north" type="number" step="any" /></label>
        </fieldset>
      </section>
    </div>
    <template #footer>
      <button type="button" @click="editingAsset = null">Cancel</button>
      <button type="button" :disabled="busy" @click="saveAsset">Save position</button>
    </template>
  </CenteredDialog>
</template>

<style scoped>
.layer-panel {
  display: grid;
  gap: 0.7rem;
  width: min(25rem, 82vw);
  max-height: min(34rem, 72vh);
  overflow: auto;
}

.layer-panel header,
.layer-heading,
.add-actions,
.coordinate-fields {
  display: flex;
  gap: 0.45rem;
  align-items: center;
}

.layer-panel header,
.layer-heading {
  justify-content: space-between;
}

.layer-panel button,
.file-action {
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

.layer-list {
  display: grid;
  gap: 0.65rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.hierarchy-layer {
  display: grid;
  gap: 0.5rem;
  padding: 0.65rem;
  border: 1px solid #d2ded9;
  border-radius: 0.45rem;
}

.layer-entry-content {
  display: grid;
  gap: 0.5rem;
}

.hierarchy-category,
.hierarchy-folder {
  min-width: 0;
}

.hierarchy-heading {
  display: flex;
  gap: 0.35rem;
  align-items: center;
}

.layer-panel .hierarchy-toggle {
  width: 100%;
  padding: 0.15rem 0;
  border: 0;
  background: transparent;
  text-align: left;
}

.layer-panel .hierarchy-toggle:hover,
.layer-panel .hierarchy-toggle:focus-visible {
  color: #a34521;
}

.hierarchy-category:not(:first-child) {
  margin-top: 0.3rem;
}

.folder-toggle {
  color: #49665d;
  font-size: 0.85rem;
  font-weight: 650;
}

.layer-configuration {
  display: grid;
  gap: 0.5rem;
}

.configuration-toggle {
  font-size: 1.1rem !important;
}

.layer-heading > label {
  display: flex;
  flex: 1;
  gap: 0.4rem;
  align-items: center;
  min-width: 0;
  font-weight: 700;
}

.layer-heading > label > span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.layer-heading > button {
  padding: 0.2rem;
  border: 0;
}

.layer-status,
.scan-status {
  color: #8b3d22;
  font-size: 0.78rem;
}

.layer-note,
.layer-error,
.scan-status {
  margin: 0;
}

.layer-error {
  color: #a22f26;
}

.opacity-field,
.zoom-fields > label,
.plugin-fields > label,
.image-tools > label,
.asset-editor label {
  display: grid;
  gap: 0.2rem;
  font-size: 0.82rem;
}

.zoom-fields,
.plugin-fields,
.job-actions {
  display: flex;
  gap: 0.45rem;
}

.zoom-fields > label,
.plugin-fields > label {
  flex: 1;
  min-width: 0;
}

.zoom-fields input,
.plugin-fields input[type="number"] {
  min-width: 0;
  width: 100%;
}

.file-action {
  position: relative;
  justify-content: center;
  overflow: hidden;
}

.file-action input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.file-action:has(input:focus-visible) {
  outline: 2px solid #a34521;
  outline-offset: 2px;
}

.image-tools,
.asset-editor,
.asset-editor fieldset {
  display: grid;
  gap: 0.5rem;
}

.recursive-field {
  display: flex !important;
  grid-template-columns: auto 1fr;
}

.asset-editor {
  grid-template-columns: minmax(10rem, 15rem) minmax(18rem, 30rem);
  width: min(48rem, 82vw);
  max-height: 68vh;
}

.asset-list,
.asset-detail,
.add-dialog {
  display: grid;
  gap: 0.5rem;
}

.add-dialog > label {
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
  place-items: center;
  min-height: 5.5rem;
  padding: 0.65rem;
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
  display: inline-flex;
  gap: 0.3rem;
  align-items: center;
  justify-self: end;
  padding: 0.4rem 0.65rem;
  border: 1px solid #286b5d;
  border-radius: 0.35rem;
  color: #fff;
  background: #286b5d;
  font: inherit;
  cursor: pointer;
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

.asset-editor img {
  width: 100%;
  max-height: 18rem;
  object-fit: contain;
}

.coordinate-fields > label {
  flex: 1;
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
