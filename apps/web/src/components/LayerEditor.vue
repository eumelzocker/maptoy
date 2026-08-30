<script setup lang="ts">
// biome-ignore-all lint/correctness/noUnusedImports: Vue template references are not detected by Biome.
// biome-ignore-all lint/correctness/noUnusedVariables: Vue template references are not detected by Biome.
import type { Job, Layer } from "@maptoy/contracts";
import { computed } from "vue";
import { layerTypePresentation } from "../layerEditorRegistry.js";

const props = defineProps<{
  layer: Layer;
  configurationSchema: Readonly<Record<string, unknown>>;
  compatibilityDiagnostic: string | null;
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

const pluginEditor = computed(
  () => layerTypePresentation(props.layer.pluginId).editor,
);

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

function emitConfigurationChange(
  key: string,
  value: string | number | boolean,
): void {
  emit("configurationChange", key, value);
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
          <i class="mdi mdi-trash-can-outline" aria-hidden="true"></i>
        </button>
      </div>
    </header>

    <div class="layer-state-fields">
      <label class="visibility-field">
        <input
          type="checkbox"
          :checked="layer.visible"
          :disabled="busy || layer.status !== 'ready' || compatibilityDiagnostic !== null"
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
    </div>

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

    <component
      :is="pluginEditor"
      :layer="layer"
      :configuration="layer.configuration"
      :configuration-schema="configurationSchema"
      :busy="busy"
      :image-roots="imageRoots"
      :image-root-id="imageRootId"
      :scan-directory="scanDirectory"
      :recursive-scan="recursiveScan"
      :active-scan-job="activeScanJob"
      :displayed-scan-job="displayedScanJob"
      :image-count="imageCount"
      @configuration-change="emitConfigurationChange"
      @upload-track="emit('uploadTrack', $event)"
      @update:image-root-id="emit('update:imageRootId', $event)"
      @update:scan-directory="emit('update:scanDirectory', $event)"
      @update:recursive-scan="emit('update:recursiveScan', $event)"
      @start-scan="emit('startScan')"
      @scan-job-action="emit('scanJobAction', $event)"
      @manage-images="emit('manageImages')"
    />

    <p v-if="compatibilityDiagnostic || layer.diagnostic" class="layer-status">
      {{ compatibilityDiagnostic || layer.diagnostic }}
    </p>
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

.layer-state-fields,
.visibility-field,
.opacity-field {
  display: flex;
  gap: 0.4rem;
  align-items: center;
}

.layer-state-fields {
  gap: 0.8rem;
}

.visibility-field {
  flex: 0 0 auto;
}

.opacity-field {
  flex: 1;
  min-width: 0;
}

.opacity-field input {
  flex: 1;
  min-width: 3rem;
}

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
