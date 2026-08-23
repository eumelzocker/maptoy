<script setup lang="ts">
import {
  createDefaultMapSetInput,
  type MapSet,
  type MapSetInput,
  type MapSetTestResponse,
  type TileCacheStats,
} from "@maptoy/contracts";
import { nextTick, onMounted, ref } from "vue";
// biome-ignore lint/correctness/noUnusedImports: referenced by the Vue template
import MapSetForm from "../components/MapSetForm.vue";
import { apiRequest } from "../api.js";
import { mapSetInput } from "../mapSetModels.js";
import { useMapSetsStore } from "../stores/mapSets.js";

const store = useMapSetsStore();
const editorMode = ref<"closed" | "create" | "edit">("closed");
const editorKey = ref("closed");
const draft = ref<MapSetInput>(createDefaultMapSetInput());
const editingId = ref<string | null>(null);
const busy = ref(false);
const message = ref<string | null>(null);
const error = ref<string | null>(null);
const testResult = ref<MapSetTestResponse | null>(null);
const testedMapSetId = ref<string | null>(null);
const sourceLocked = ref(false);
const editorDirty = ref(false);
const cacheStats = ref<Record<string, TileCacheStats | null>>({});
const editorPanel = ref<HTMLElement | null>(null);

async function scrollEditorIntoView(): Promise<void> {
  await nextTick();
  editorPanel.value?.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function loadCacheStats(mapSet: MapSet): Promise<void> {
  try {
    cacheStats.value[mapSet.id] = await apiRequest<TileCacheStats>(
      `api/map-sets/${mapSet.id}/cache/stats`,
    );
  } catch {
    cacheStats.value[mapSet.id] = null;
  }
}

// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
function cachedTileCount(id: string): number | null {
  return cacheStats.value[id]?.logicalTileCount ?? null;
}

onMounted(async () => {
  try {
    await store.load();
    void Promise.all(store.items.map(loadCacheStats));
  } catch {
    error.value = store.error;
  }
});

function hasUnsavedChanges(): boolean {
  return editorMode.value !== "closed" && editorDirty.value;
}

function confirmDiscardChanges(): boolean {
  return (
    !hasUnsavedChanges() ||
    window.confirm("Discard unsaved changes to this Map Set?")
  );
}

// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
function newMapSet(): void {
  if (!confirmDiscardChanges()) {
    return;
  }
  draft.value = createDefaultMapSetInput();
  editingId.value = null;
  sourceLocked.value = false;
  editorDirty.value = false;
  editorMode.value = "create";
  editorKey.value = `create-${Date.now()}`;
  message.value = null;
  error.value = null;
  testResult.value = null;
  void scrollEditorIntoView();
}

function openEditor(mapSet: MapSet, locked: boolean): void {
  draft.value = mapSetInput(mapSet);
  editingId.value = mapSet.id;
  sourceLocked.value = locked;
  editorDirty.value = false;
  editorMode.value = "edit";
  editorKey.value = mapSet.id;
  message.value = null;
  error.value = null;
  testResult.value = null;
}

// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
async function edit(mapSet: MapSet): Promise<void> {
  if (!confirmDiscardChanges()) {
    return;
  }
  busy.value = true;
  error.value = null;
  try {
    const stats = await apiRequest<TileCacheStats>(
      `api/map-sets/${mapSet.id}/cache/stats`,
    );
    cacheStats.value[mapSet.id] = stats;
    openEditor(mapSet, stats.totalRevisionCount > 0);
    void scrollEditorIntoView();
  } catch (cause) {
    error.value =
      cause instanceof Error
        ? cause.message
        : "The Map Set cache status could not be loaded.";
  } finally {
    busy.value = false;
  }
}

function closeEditor(): void {
  editorMode.value = "closed";
  editingId.value = null;
  sourceLocked.value = false;
  editorDirty.value = false;
  editorKey.value = "closed";
}

// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
function requestCloseEditor(): void {
  if (confirmDiscardChanges()) {
    closeEditor();
  }
}

// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
async function save(input: MapSetInput): Promise<void> {
  busy.value = true;
  error.value = null;
  message.value = null;
  try {
    const mapSet =
      editingId.value === null
        ? await store.create(input)
        : await store.update(editingId.value, input);
    if (cacheStats.value[mapSet.id] === undefined) {
      void loadCacheStats(mapSet);
    }
    openEditor(mapSet, sourceLocked.value);
    message.value = `${mapSet.name} was saved.`;
  } catch (cause) {
    error.value =
      cause instanceof Error
        ? cause.message
        : "The Map Set could not be saved.";
  } finally {
    busy.value = false;
  }
}

async function duplicate(mapSet: MapSet): Promise<void> {
  if (!confirmDiscardChanges()) {
    return;
  }
  busy.value = true;
  error.value = null;
  try {
    const copy = await store.create({
      ...mapSetInput(mapSet),
      name: `${mapSet.name} copy`,
    });
    void loadCacheStats(copy);
    openEditor(copy, false);
    void scrollEditorIntoView();
    message.value = `${copy.name} was created.`;
  } catch (cause) {
    error.value =
      cause instanceof Error
        ? cause.message
        : "The Map Set could not be duplicated.";
  } finally {
    busy.value = false;
  }
}

// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
async function duplicateEditing(): Promise<void> {
  const mapSet = store.items.find(({ id }) => id === editingId.value);
  if (mapSet !== undefined) {
    await duplicate(mapSet);
  }
}

// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
async function remove(mapSet: MapSet): Promise<void> {
  if (!window.confirm(`Delete “${mapSet.name}”? This cannot be undone.`)) {
    return;
  }
  busy.value = true;
  error.value = null;
  try {
    await store.remove(mapSet.id);
    message.value = `${mapSet.name} was deleted.`;
    if (editingId.value === mapSet.id) {
      closeEditor();
    }
  } catch (cause) {
    error.value =
      cause instanceof Error
        ? cause.message
        : "The Map Set could not be deleted.";
  } finally {
    busy.value = false;
  }
}

// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
async function test(mapSet: MapSet): Promise<void> {
  busy.value = true;
  error.value = null;
  testResult.value = null;
  testedMapSetId.value = mapSet.id;
  try {
    testResult.value = await store.test(mapSet.id);
  } catch (cause) {
    error.value =
      cause instanceof Error ? cause.message : "The provider test failed.";
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <main class="map-sets-page">
    <header class="page-heading">
      <div>
        <p class="eyebrow">Configuration</p>
        <h1>Map Sets</h1>
        <p>Configure XYZ raster sources.</p>
      </div>
      <button class="primary-button" type="button" @click="newMapSet">
        <i class="mdi mdi-plus" aria-hidden="true"></i>
        New Map Set
      </button>
    </header>

    <p v-if="message" class="notice success" role="status">{{ message }}</p>
    <p v-if="error" class="notice error" role="alert">{{ error }}</p>
    <p v-if="store.loading" class="notice">Loading Map Sets…</p>

    <section v-if="store.items.length > 0" class="map-set-list" aria-label="Map Sets">
      <article v-for="mapSet in store.items" :key="mapSet.id" class="map-set-card">
        <div>
          <h2>{{ mapSet.name }}</h2>
          <p class="source-template">{{ mapSet.urlTemplate }}</p>
          <p class="metadata">
            Zoom {{ mapSet.minZoom }}–{{ mapSet.maxZoom }} · {{ mapSet.tileSize }} px ·
            {{ mapSet.rendererId }}
            <template v-if="cachedTileCount(mapSet.id) !== null">
              · {{ cachedTileCount(mapSet.id) }} cached tiles
            </template>
          </p>
          <ul class="capabilities" aria-label="Enabled capabilities">
            <li v-if="mapSet.capabilities.interactive">Interactive</li>
            <li v-if="mapSet.capabilities.tileArchive">Archive</li>
            <li v-if="mapSet.capabilities.batchDownload">Batch</li>
            <li v-if="mapSet.capabilities.serverExport">Export</li>
          </ul>
        </div>
        <div class="card-actions">
          <button
            type="button"
            :disabled="busy || editingId === mapSet.id"
            @click="edit(mapSet)"
          >
            Edit
          </button>
          <button type="button" :disabled="busy" @click="test(mapSet)">Test tile</button>
          <button type="button" :disabled="busy" @click="duplicate(mapSet)">Duplicate</button>
          <button class="danger-button" type="button" :disabled="busy" @click="remove(mapSet)">
            Delete
          </button>
        </div>
        <p
          v-if="testResult && testedMapSetId === mapSet.id"
          class="test-result"
          :class="{ failed: !testResult.ok }"
          role="status"
        >
          {{ testResult.message }}
          <span v-if="testResult.statusCode">
            HTTP {{ testResult.statusCode }}, {{ testResult.contentType ?? "unknown type" }},
            {{ testResult.byteLength ?? 0 }} bytes, {{ testResult.durationMilliseconds }} ms
          </span>
        </p>
      </article>
    </section>

    <section v-else-if="store.loaded && !store.loading" class="empty-state">
      <i class="mdi mdi-map-plus" aria-hidden="true"></i>
      <h2>No Map Sets yet</h2>
      <p>Create an XYZ source to show it on the map.</p>
      <button class="primary-button" type="button" @click="newMapSet">Create the first Map Set</button>
    </section>

    <section
      v-if="editorMode !== 'closed'"
      ref="editorPanel"
      class="editor-panel"
      aria-label="Map Set editor"
    >
      <header>
        <h2>{{ editorMode === "create" ? "Create Map Set" : "Edit Map Set" }}</h2>
        <button type="button" aria-label="Close editor" @click="requestCloseEditor">
          <i class="mdi mdi-close" aria-hidden="true"></i>
        </button>
      </header>
      <MapSetForm
        :key="editorKey"
        :model-value="draft"
        :submit-label="editorMode === 'create' ? 'Create Map Set' : 'Save changes'"
        :busy="busy"
        :source-locked="sourceLocked"
        @submit="save"
        @cancel="requestCloseEditor"
        @duplicate="duplicateEditing"
        @dirty="(value) => (editorDirty = value)"
      />
    </section>
  </main>
</template>

<style scoped>
.map-sets-page {
  width: min(86rem, 100%);
  margin: 0 auto;
  padding: clamp(1.5rem, 4vw, 3.5rem);
}

.page-heading,
.editor-panel > header,
.card-actions,
.capabilities {
  display: flex;
  align-items: center;
}

.page-heading,
.editor-panel > header {
  justify-content: space-between;
  gap: 1rem;
}

h1 {
  margin: 0;
  font-family: Georgia, "Times New Roman", serif;
  font-size: clamp(2.3rem, 5vw, 4rem);
  font-weight: 500;
}

.map-set-list {
  display: grid;
  gap: 1rem;
}

.map-set-card,
.editor-panel,
.empty-state {
  padding: 1.25rem;
  border: 1px solid #c5d2ca;
  border-radius: 0.9rem;
  background: rgb(255 255 255 / 72%);
  box-shadow: 0 1rem 2.5rem rgb(39 68 57 / 8%);
}

.map-set-card {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 1rem;
}

.map-set-card h2,
.map-set-card p {
  margin-block: 0 0.5rem;
}

.source-template {
  overflow-wrap: anywhere;
  color: #405b54;
  font-family: ui-monospace, monospace;
  font-size: 0.82rem;
}

.metadata {
  color: #597068;
}

.capabilities {
  flex-wrap: wrap;
  gap: 0.4rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.capabilities li {
  padding: 0.2rem 0.5rem;
  border-radius: 999px;
  color: #245744;
  background: #dcebe1;
  font-size: 0.75rem;
  font-weight: 700;
}

.card-actions {
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.5rem;
}

button {
  min-height: 2.4rem;
  padding: 0.5rem 0.7rem;
  border: 1px solid #9eb1a7;
  border-radius: 0.45rem;
  color: #142c28;
  background: #fff;
  cursor: pointer;
  font: inherit;
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.primary-button {
  color: #fff;
  border-color: #163832;
  background: #163832;
}

.danger-button {
  color: #8a281c;
  border-color: #d6aaa4;
}

.notice,
.test-result {
  padding: 0.75rem 1rem;
  border-left: 0.25rem solid #bc8d1c;
  background: #fff6d9;
}

.notice.success,
.test-result {
  border-color: #31835f;
  background: #e5f4eb;
}

.notice.error,
.test-result.failed {
  border-color: #b64030;
  background: #ffe9e5;
}

.test-result {
  grid-column: 1 / -1;
  margin: 0;
}

.test-result span {
  display: block;
  margin-top: 0.25rem;
  font-size: 0.82rem;
}

.empty-state {
  text-align: center;
}

.empty-state > i {
  color: #a34521;
  font-size: 3rem;
}

.editor-panel {
  margin-top: 1.5rem;
}

@media (max-width: 800px) {
  .page-heading,
  .map-set-card {
    grid-template-columns: 1fr;
  }

  .page-heading {
    align-items: flex-start;
    flex-direction: column;
  }

  .card-actions {
    justify-content: flex-start;
  }
}
</style>
