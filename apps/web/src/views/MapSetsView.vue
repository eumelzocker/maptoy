<script setup lang="ts">
import {
  createDefaultMapSetInput,
  type MapSet,
  type MapSetInput,
  type MapSetTestResponse,
  type TileCacheStats,
} from "@maptoy/contracts";
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import { onBeforeRouteLeave } from "vue-router";
// biome-ignore lint/correctness/noUnusedImports: referenced by the Vue template
import MapSetForm from "../components/MapSetForm.vue";
import { apiRequest } from "../api.js";
import { groupMapSetsByFirstNameSegment } from "../mapSetNameGroups.js";
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
const editorPanel = ref<HTMLElement | null>(null);
// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
const mapSetGroups = computed(() =>
  groupMapSetsByFirstNameSegment(store.items),
);
const collapsedGroupKeys = ref<Set<string>>(new Set());

// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
function isGroupCollapsed(key: string): boolean {
  return collapsedGroupKeys.value.has(key);
}

// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
function toggleGroup(key: string): void {
  const next = new Set(collapsedGroupKeys.value);
  if (next.has(key)) {
    next.delete(key);
  } else {
    next.add(key);
  }
  collapsedGroupKeys.value = next;
}

async function scrollEditorIntoView(): Promise<void> {
  await nextTick();
  editorPanel.value?.scrollIntoView({ behavior: "smooth", block: "start" });
}

onMounted(async () => {
  window.addEventListener("beforeunload", guardBeforeUnload);
  try {
    await store.load();
  } catch {
    error.value = store.error;
  }
});

onBeforeUnmount(() => {
  window.removeEventListener("beforeunload", guardBeforeUnload);
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

function guardBeforeUnload(event: BeforeUnloadEvent): void {
  if (!hasUnsavedChanges()) return;
  event.preventDefault();
  event.returnValue = "";
}

onBeforeRouteLeave(() => confirmDiscardChanges());

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

    <section v-if="store.items.length > 0" class="map-set-groups" aria-label="Map Sets">
      <section
        v-for="(group, groupIndex) in mapSetGroups"
        :key="group.key"
        class="map-set-group"
        :class="{ ungrouped: group.ungrouped }"
        :aria-labelledby="`map-set-group-${groupIndex}`"
      >
        <header
          class="group-heading"
          role="button"
          tabindex="0"
          :aria-expanded="!isGroupCollapsed(group.key)"
          :aria-controls="`map-set-group-list-${groupIndex}`"
          @click="toggleGroup(group.key)"
          @keydown.enter.prevent="toggleGroup(group.key)"
          @keydown.space.prevent="toggleGroup(group.key)"
        >
          <div class="group-title">
            <i
              class="mdi group-caret"
              :class="isGroupCollapsed(group.key) ? 'mdi-chevron-right' : 'mdi-chevron-down'"
              aria-hidden="true"
            ></i>
            <i
              class="mdi"
              :class="group.ungrouped ? 'mdi-format-list-bulleted' : 'mdi-folder-outline'"
              aria-hidden="true"
            ></i>
            <h2 :id="`map-set-group-${groupIndex}`">{{ group.label }}</h2>
          </div>
          <span class="group-count">
            {{ group.items.length }} {{ group.items.length === 1 ? "Map Set" : "Map Sets" }}
          </span>
        </header>

        <div
          v-show="!isGroupCollapsed(group.key)"
          :id="`map-set-group-list-${groupIndex}`"
          class="map-set-list"
        >
          <article v-for="item in group.items" :key="item.mapSet.id" class="map-set-card">
            <div>
              <h3 :title="item.mapSet.name">{{ item.label }}</h3>
              <p class="source-template">{{ item.mapSet.urlTemplate }}</p>
              <p class="metadata">
                Zoom {{ item.mapSet.minZoom }}–{{ item.mapSet.maxZoom }} ·
                {{ item.mapSet.tileSize }} px · {{ item.mapSet.rendererId }} ·
                {{ item.mapSet.logicalTileCount }} cached tiles
              </p>
              <ul class="capabilities" aria-label="Enabled capabilities">
                <li v-if="item.mapSet.capabilities.interactive">Interactive</li>
                <li v-if="item.mapSet.capabilities.tileArchive">Archive</li>
                <li v-if="item.mapSet.capabilities.batchDownload">Batch</li>
                <li v-if="item.mapSet.capabilities.serverExport">Export</li>
              </ul>
            </div>
            <div class="card-actions">
              <button
                type="button"
                :disabled="busy || editingId === item.mapSet.id"
                @click="edit(item.mapSet)"
              >
                Edit
              </button>
              <button type="button" :disabled="busy" @click="test(item.mapSet)">
                Test tile
              </button>
              <button type="button" :disabled="busy" @click="duplicate(item.mapSet)">
                Duplicate
              </button>
              <button
                class="danger-button"
                type="button"
                :disabled="busy"
                @click="remove(item.mapSet)"
              >
                Delete
              </button>
            </div>
            <p
              v-if="testResult && testedMapSetId === item.mapSet.id"
              class="test-result"
              :class="{ failed: !testResult.ok }"
              role="status"
            >
              {{ testResult.message }}
              <span v-if="testResult.statusCode">
                HTTP {{ testResult.statusCode }},
                {{ testResult.contentType ?? "unknown type" }},
                {{ testResult.byteLength ?? 0 }} bytes,
                {{ testResult.durationMilliseconds }} ms
              </span>
            </p>
          </article>
        </div>
      </section>
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

.map-set-groups,
.map-set-list {
  display: grid;
}

.map-set-groups {
  gap: 1.75rem;
}

.map-set-group {
  display: grid;
  gap: 0.75rem;
}

.group-heading,
.group-title {
  display: flex;
  align-items: center;
}

.group-heading {
  justify-content: space-between;
  gap: 1rem;
  padding: 0.35rem;
  border-radius: 0.5rem;
  cursor: pointer;
  user-select: none;
}

.group-heading:hover {
  background: rgb(255 255 255 / 45%);
}

.group-heading:focus-visible {
  outline: 2px solid #163832;
  outline-offset: 2px;
}

.group-title {
  min-width: 0;
  gap: 0.55rem;
}

.group-title i {
  color: #a34521;
  font-size: 1.35rem;
}

.group-title .group-caret {
  color: #657971;
  font-size: 1.15rem;
  transition: transform 0.15s ease;
}

.group-heading h2 {
  margin: 0;
  color: #243f38;
  font-size: 1.15rem;
  font-weight: 750;
}

.group-count {
  flex: none;
  color: #657971;
  font-size: 0.78rem;
  font-weight: 650;
  letter-spacing: 0.02em;
}

.map-set-list {
  gap: 1rem;
  padding-left: 1rem;
  border-left: 0.2rem solid #b9cfc3;
}

.map-set-group.ungrouped .map-set-list {
  border-left-color: #d4c9b6;
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

.map-set-card h3,
.map-set-card p {
  margin-block: 0 0.5rem;
}

.map-set-card h3 {
  color: #19372f;
  font-size: 1.1rem;
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

  .map-set-list {
    padding-left: 0.65rem;
  }
}
</style>
