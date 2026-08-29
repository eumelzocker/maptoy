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
  saveCollapsedLayerHierarchy,
  saveSelectedLayerId,
} from "../layerPanelPreferences.js";
import { availableLocalStorage } from "../localStorage.js";
import { LAYER_PLUGIN_REGISTRY_KEY } from "../registries.js";
import { useLayersStore } from "../stores/layers.js";
import CenteredDialog from "./CenteredDialog.vue";
import LayerEditor from "./LayerEditor.vue";
import TogglePanel from "./TogglePanel.vue";
import TreeSelectDropdown from "./TreeSelectDropdown.vue";

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
const selectedLayerId = ref<string | null>(loadSelectedLayerId(browserStorage));
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
            checkDisabled: row.layer.status !== "ready",
            selectable: true,
            searchText: row.layer.name,
            ...(row.layer.status === "ready"
              ? {}
              : { secondaryText: row.layer.status }),
          }
        : {
            id: row.key,
            label: row.label,
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
      const layerIds = layer?.status === "ready" ? [node.id] : [];
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

watch(
  () => store.items.map(({ id }) => id),
  (layerIds) => {
    if (
      selectedLayerId.value === null ||
      !layerIds.includes(selectedLayerId.value)
    ) {
      selectLayer(layerIds[0] ?? null);
    }
  },
  { immediate: true },
);

function selectLayer(layerId: string | null): void {
  selectedLayerId.value = layerId;
  saveSelectedLayerId(layerId, browserStorage);
}

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

function openFirstImage(layerId: string): void {
  const asset = imageAssets(layerId)[0];
  if (asset !== undefined) {
    openAsset(asset);
  }
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
        <button type="button" :disabled="!enabled || busy" @click="openAddDialog">
          <i class="mdi mdi-plus" aria-hidden="true"></i>Add layer
        </button>
      </header>

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
        :disabled="!enabled || busy"
        @update:model-value="selectLayer"
        @update:expanded-ids="expandedHierarchyIds = $event"
        @check="setTreeVisibility"
      />

      <LayerEditor
        v-if="selectedLayer"
        :layer="selectedLayer"
        :busy="busy"
        :can-move-up="canMove(selectedLayer, -1)"
        :can-move-down="canMove(selectedLayer, 1)"
        :image-roots="store.imageRoots"
        :image-root-id="rootSelections[selectedLayer.id] ?? ''"
        :scan-directory="scanDirectories[selectedLayer.id] ?? ''"
        :recursive-scan="recursiveScans[selectedLayer.id] ?? true"
        :active-scan-job="scanJob(selectedLayer.id)"
        :displayed-scan-job="displayedScanJob(selectedLayer.id)"
        :image-count="imageAssets(selectedLayer.id).length"
        @visibility-change="setSelectedVisibility"
        @opacity-change="setSelectedOpacity"
        @zoom-change="setSelectedZoom"
        @configuration-change="setSelectedConfiguration"
        @rename="withSelectedLayer(renameLayer)"
        @move="withSelectedLayer((layer) => move(layer, $event))"
        @remove="withSelectedLayer(removeLayer)"
        @upload-track="withSelectedLayer((layer) => uploadTrack(layer.id, $event))"
        @update:image-root-id="withSelectedLayer((layer) => { rootSelections[layer.id] = $event; })"
        @update:scan-directory="withSelectedLayer((layer) => { scanDirectories[layer.id] = $event; })"
        @update:recursive-scan="withSelectedLayer((layer) => { recursiveScans[layer.id] = $event; })"
        @start-scan="withSelectedLayer((layer) => startScan(layer.id))"
        @scan-job-action="withSelectedLayer((layer) => { const job = scanJob(layer.id); if (job) controlJob(job.id, $event); })"
        @manage-images="withSelectedLayer((layer) => openFirstImage(layer.id))"
      />
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
  max-height: min(38rem, 78vh);
}

.layer-panel header,
.coordinate-fields {
  display: flex;
  gap: 0.45rem;
  align-items: center;
}

.layer-panel header {
  justify-content: space-between;
}

.layer-panel header button,
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
