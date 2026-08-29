<script setup lang="ts">
// biome-ignore-all lint/correctness/noUnusedImports: Vue template references are not detected by Biome.
// biome-ignore-all lint/correctness/noUnusedVariables: Vue template references are not detected by Biome.
import type { Job, Layer } from "@maptoy/contracts";
import ImageLayerEditor from "./ImageLayerEditor.vue";
import TrackLayerEditor from "./TrackLayerEditor.vue";

defineProps<{
  layer: Layer;
  busy: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  imageRoots: readonly { id: string; available: boolean }[];
  imageRootId: string;
  scanDirectory: string;
  recursiveScan: boolean;
  activeScanJob: Job | undefined;
  displayedScanJob: Job | undefined;
  imageCount: number;
}>();

const emit = defineEmits<{
  visibilityChange: [visible: boolean];
  opacityChange: [opacity: number];
  zoomChange: [key: "minimumZoom" | "maximumZoom", value: number | null];
  configurationChange: [key: string, value: string | number | boolean];
  rename: [];
  move: [direction: -1 | 1];
  remove: [];
  uploadTrack: [file: File];
  "update:imageRootId": [value: string];
  "update:scanDirectory": [value: string];
  "update:recursiveScan": [value: boolean];
  startScan: [];
  scanJobAction: [action: "pause" | "resume" | "cancel"];
  manageImages: [];
}>();

function nullableNumber(event: Event): number | null {
  const value = (event.target as HTMLInputElement).value;
  return value === "" ? null : Number(value);
}

function hasTrack(layer: Layer): boolean {
  return Array.isArray(layer.data.features) && layer.data.features.length > 0;
}
</script>

<template>
  <section class="layer-editor" :data-layer-editor-id="layer.id">
    <header class="editor-header">
      <div>
        <strong>{{ layer.name.split('/').at(-1) }}</strong>
        <small v-if="layer.name.includes('/')">{{ layer.name }}</small>
      </div>
      <span v-if="layer.status !== 'ready'" class="layer-status">{{ layer.status }}</span>
      <div class="editor-actions">
        <button type="button" title="Rename layer" :disabled="busy" @click="emit('rename')">
          <i class="mdi mdi-pencil-outline" aria-hidden="true"></i>
        </button>
        <button
          type="button"
          title="Move layer up"
          :disabled="busy || !canMoveUp"
          @click="emit('move', -1)"
        >
          <i class="mdi mdi-arrow-up" aria-hidden="true"></i>
        </button>
        <button
          type="button"
          title="Move layer down"
          :disabled="busy || !canMoveDown"
          @click="emit('move', 1)"
        >
          <i class="mdi mdi-arrow-down" aria-hidden="true"></i>
        </button>
        <button type="button" title="Delete layer" :disabled="busy" @click="emit('remove')">
          <i class="mdi mdi-delete-outline" aria-hidden="true"></i>
        </button>
      </div>
    </header>

    <label class="visibility-field">
      <input
        type="checkbox"
        :checked="layer.visible"
        :disabled="busy || layer.status !== 'ready'"
        @change="emit('visibilityChange', ($event.target as HTMLInputElement).checked)"
      />
      <span>Visible on map</span>
    </label>

    <label class="opacity-field">
      <span>Opacity</span>
      <input
        type="range"
        min="0"
        max="1"
        step="0.05"
        :value="layer.opacity"
        :disabled="busy"
        @change="emit('opacityChange', Number(($event.target as HTMLInputElement).value))"
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
          :disabled="busy"
          @change="emit('zoomChange', 'minimumZoom', nullableNumber($event))"
        />
      </label>
      <label>
        <span>Max zoom</span>
        <input
          type="number"
          min="0"
          max="24"
          :value="layer.maximumZoom ?? ''"
          :disabled="busy"
          @change="emit('zoomChange', 'maximumZoom', nullableNumber($event))"
        />
      </label>
    </div>

    <TrackLayerEditor
      v-if="layer.pluginId === 'track-layer'"
      :configuration="layer.configuration"
      :busy="busy"
      :has-track="hasTrack(layer)"
      @configuration-change="(key, value) => emit('configurationChange', key, value)"
      @upload="emit('uploadTrack', $event)"
    />
    <ImageLayerEditor
      v-else-if="layer.pluginId === 'image-layer'"
      :configuration="layer.configuration"
      :busy="busy"
      :image-roots="imageRoots"
      :root-id="imageRootId"
      :scan-directory="scanDirectory"
      :recursive="recursiveScan"
      :active-job="activeScanJob"
      :displayed-job="displayedScanJob"
      :image-count="imageCount"
      @configuration-change="(key, value) => emit('configurationChange', key, value)"
      @update:root-id="emit('update:imageRootId', $event)"
      @update:scan-directory="emit('update:scanDirectory', $event)"
      @update:recursive="emit('update:recursiveScan', $event)"
      @start-scan="emit('startScan')"
      @job-action="emit('scanJobAction', $event)"
      @manage-images="emit('manageImages')"
    />
    <p v-else class="layer-status">No editor is available for plugin {{ layer.pluginId }}.</p>

    <p v-if="layer.diagnostic" class="layer-status">{{ layer.diagnostic }}</p>
  </section>
</template>

<style scoped>
.layer-editor {
  display: grid;
  gap: 0.65rem;
  min-height: 0;
  padding: 0.65rem;
  overflow: auto;
  border: 1px solid #d2ded9;
  border-radius: 0.45rem;
}

.editor-header {
  display: flex;
  gap: 0.45rem;
  align-items: center;
}

.editor-header > div:first-child {
  display: grid;
  flex: 1;
  min-width: 0;
}

.editor-header strong,
.editor-header small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.editor-header small {
  color: #617870;
  font-size: 0.76rem;
}

.editor-actions {
  display: flex;
  gap: 0.15rem;
}

.editor-actions button {
  display: grid;
  width: 1.8rem;
  height: 1.8rem;
  padding: 0;
  place-items: center;
  border: 0;
  border-radius: 0.3rem;
  color: #173d35;
  background: transparent;
  font: inherit;
  cursor: pointer;
}

.editor-actions button:hover:not(:disabled),
.editor-actions button:focus-visible {
  background: #edf4f1;
}

.visibility-field {
  display: flex;
  gap: 0.4rem;
  align-items: center;
}

.opacity-field,
.zoom-fields > label {
  display: grid;
  gap: 0.2rem;
  font-size: 0.82rem;
}

.zoom-fields {
  display: flex;
  gap: 0.45rem;
}

.zoom-fields > label {
  flex: 1;
  min-width: 0;
}

.zoom-fields input {
  min-width: 0;
  width: 100%;
}

.layer-status {
  margin: 0;
  color: #8b3d22;
  font-size: 0.78rem;
}
</style>
