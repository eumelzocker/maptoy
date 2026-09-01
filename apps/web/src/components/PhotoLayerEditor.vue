<script setup lang="ts">
// biome-ignore-all lint/correctness/noUnusedImports: Vue template references are not detected by Biome.
// biome-ignore-all lint/correctness/noUnusedVariables: Vue template references are not detected by Biome.
import type { Job, Layer } from "@maptoy/contracts";

defineProps<{
  configuration: Layer["configuration"];
  busy: boolean;
  photoDirectory: { configured: boolean; available: boolean };
  scanDirectory: string;
  recursive: boolean;
  activeJob: Job | undefined;
  displayedJob: Job | undefined;
  photoCount: number;
  photosLoaded: boolean;
  hasMorePhotos: boolean;
}>();

const emit = defineEmits<{
  configurationChange: [key: string, value: string | number | boolean];
  "update:recursive": [value: boolean];
  browseDirectory: [];
  jobAction: [action: "pause" | "resume" | "cancel"];
  managePhotos: [];
}>();

function processedItems(job: Job): number {
  return job.completed + job.skipped + job.failed;
}
</script>

<template>
  <section class="plugin-editor" aria-label="Photo style and data">
    <div class="plugin-fields">
      <label>
        <span>Marker</span>
        <input
          type="color"
          :value="String(configuration.pointColor ?? '#c54e2e')"
          :disabled="busy"
          @change="emit('configurationChange', 'pointColor', ($event.target as HTMLInputElement).value)"
        />
      </label>
      <label class="recursive-field">
        <input
          type="checkbox"
          :checked="Boolean(configuration.showPreviews ?? true)"
          :disabled="busy"
          @change="emit('configurationChange', 'showPreviews', ($event.target as HTMLInputElement).checked)"
        />
        <span>Preview popups</span>
      </label>
      <label>
        <span>Radius</span>
        <input
          type="number"
          min="2"
          max="30"
          :value="Number(configuration.pointRadius ?? 8)"
          :disabled="busy"
          @change="emit('configurationChange', 'pointRadius', Number(($event.target as HTMLInputElement).value))"
        />
      </label>
    </div>

    <div class="photo-tools">
      <p v-if="!photoDirectory.configured" class="scan-status">
        Configure MAPTOY_PHOTOS_DIR before scanning photos.
      </p>
      <p v-else-if="!photoDirectory.available" class="scan-status">
        The configured photo directory is unavailable.
      </p>
      <div class="selected-directory">
        <span>Subdirectory</span>
        <strong :title="scanDirectory || 'No subdirectory selected'">
          {{ scanDirectory || "No subdirectory selected" }}
        </strong>
      </div>
      <label class="recursive-field">
        <input
          type="checkbox"
          :checked="recursive"
          :disabled="busy"
          @change="emit('update:recursive', ($event.target as HTMLInputElement).checked)"
        />
        <span>Recursive</span>
      </label>
      <button
        type="button"
        data-layer-primary-action
        :disabled="busy || activeJob !== undefined || !photoDirectory.available"
        @click="emit('browseDirectory')"
      >
        <i class="mdi mdi-folder-search-outline" aria-hidden="true"></i>Scan directory…
      </button>
      <p v-if="displayedJob" class="scan-status">
        {{ displayedJob.status }} · {{ processedItems(displayedJob) }}/{{ displayedJob.total }} ·
        new {{ displayedJob.summary.created ?? 0 }} · changed
        {{ displayedJob.summary.changed ?? 0 }} · skipped (no location)
        {{ displayedJob.summary.withoutLocation ?? 0 }} · missing
        {{ displayedJob.summary.missing ?? 0 }} · failed
        {{ displayedJob.summary.failed ?? 0 }}
      </p>
      <div v-if="activeJob" class="job-actions">
        <button
          v-if="activeJob.status !== 'paused'"
          type="button"
          @click="emit('jobAction', 'pause')"
        >Pause</button>
        <button v-else type="button" @click="emit('jobAction', 'resume')">Resume</button>
        <button type="button" @click="emit('jobAction', 'cancel')">Cancel</button>
      </div>
      <button
        type="button"
        :disabled="busy || (photosLoaded && photoCount === 0)"
        @click="emit('managePhotos')"
      >
        {{ photosLoaded ? (photoCount === 0 ? "No photos" : `Manage ${photoCount}${hasMorePhotos ? "+" : ""} photos`) : "Manage photos" }}
      </button>
    </div>
  </section>
</template>

<style scoped>
.plugin-editor,
.photo-tools {
  display: grid;
  gap: 0.55rem;
}

.plugin-fields,
.job-actions {
  display: flex;
  gap: 0.45rem;
}

.plugin-fields > label,
.photo-tools > label {
  display: grid;
  flex: 1;
  gap: 0.2rem;
  min-width: 0;
  font-size: 0.82rem;
}

.selected-directory {
  display: grid;
  gap: 0.15rem;
  min-width: 0;
  font-size: 0.82rem;
}

.selected-directory strong {
  overflow: hidden;
  color: #536b64;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.plugin-fields input[type="number"] {
  min-width: 0;
  width: 100%;
}

.recursive-field {
  display: flex !important;
  align-items: center;
}

button {
  display: inline-flex;
  gap: 0.3rem;
  align-items: center;
  justify-content: center;
  padding: 0.35rem 0.5rem;
  border: 1px solid #9aada6;
  border-radius: 0.35rem;
  color: #173d35;
  background: #fff;
  font: inherit;
  cursor: pointer;
}

.scan-status {
  margin: 0;
  color: #8b3d22;
  font-size: 0.78rem;
}
</style>
