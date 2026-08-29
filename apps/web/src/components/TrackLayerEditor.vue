<script setup lang="ts">
// biome-ignore-all lint/correctness/noUnusedImports: Vue template references are not detected by Biome.
// biome-ignore-all lint/correctness/noUnusedVariables: Vue template references are not detected by Biome.
import type { Layer } from "@maptoy/contracts";

defineProps<{
  configuration: Layer["configuration"];
  busy: boolean;
  hasTrack: boolean;
}>();

const emit = defineEmits<{
  configurationChange: [key: string, value: string | number | boolean];
  upload: [file: File];
}>();

function selectFile(event: Event): void {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file !== undefined) {
    emit("upload", file);
  }
  input.value = "";
}
</script>

<template>
  <section class="plugin-editor" aria-label="Track style and data">
    <div class="plugin-fields">
      <label>
        <span>Line</span>
        <input
          type="color"
          :value="String(configuration.lineColor ?? '#d4552d')"
          :disabled="busy"
          @change="emit('configurationChange', 'lineColor', ($event.target as HTMLInputElement).value)"
        />
      </label>
      <label>
        <span>Width</span>
        <input
          type="number"
          min="1"
          max="20"
          :value="Number(configuration.lineWidth ?? 4)"
          :disabled="busy"
          @change="emit('configurationChange', 'lineWidth', Number(($event.target as HTMLInputElement).value))"
        />
      </label>
    </div>

    <label class="file-action" :class="{ primary: !hasTrack }">
      <i
        class="mdi"
        :class="hasTrack ? 'mdi-file-replace-outline' : 'mdi-upload'"
        aria-hidden="true"
      ></i>
      {{ hasTrack ? 'Replace track…' : 'Import track…' }}
      <input
        type="file"
        data-layer-primary-action
        accept=".gpx,.geojson,.json,application/gpx+xml,application/geo+json"
        :disabled="busy"
        @change="selectFile"
      />
    </label>
    <small class="file-hint">GPX or GeoJSON</small>
  </section>
</template>

<style scoped>
.plugin-editor {
  display: grid;
  gap: 0.6rem;
}

.plugin-fields {
  display: flex;
  gap: 0.45rem;
}

.plugin-fields > label {
  display: grid;
  flex: 1;
  gap: 0.2rem;
  min-width: 0;
  font-size: 0.82rem;
}

.plugin-fields input[type="number"] {
  min-width: 0;
  width: 100%;
}

.file-action {
  position: relative;
  display: inline-flex;
  gap: 0.3rem;
  align-items: center;
  justify-content: center;
  padding: 0.35rem 0.5rem;
  overflow: hidden;
  border: 1px solid #9aada6;
  border-radius: 0.35rem;
  color: #173d35;
  background: #fff;
  cursor: pointer;
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

.file-action.primary {
  border-color: #286b5d;
  color: #fff;
  background: #286b5d;
  font-weight: 700;
  box-shadow: 0 0.2rem 0.55rem rgb(40 107 93 / 24%);
}

.file-hint {
  margin-top: -0.35rem;
  color: #617870;
  font-size: 0.75rem;
  text-align: center;
}
</style>
