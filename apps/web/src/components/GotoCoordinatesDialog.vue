<script setup lang="ts">
import type { GeographicCoordinate } from "@maptoy/map-adapter-sdk";
import { WEB_MERCATOR_MAX_LATITUDE } from "@maptoy/map-core";
import { computed, ref, useId, watch } from "vue";
// biome-ignore lint/correctness/noUnusedImports: referenced by the Vue template
import CenteredDialog from "./CenteredDialog.vue";
// biome-ignore lint/correctness/noUnusedImports: referenced by the Vue template
import CoordinateDmsReadout from "./CoordinateDmsReadout.vue";

const props = defineProps<{
  open: boolean;
  initialCoordinate: GeographicCoordinate;
  initialZoom: number;
  minimumZoom: number;
  maximumZoom: number;
}>();

const emit = defineEmits<{
  close: [];
  apply: [coordinate: GeographicCoordinate, zoom: number];
}>();

// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
const formId = `goto-coordinates-form-${useId()}`;
const zoom = ref(0);
const longitude = ref(0);
const latitude = ref(0);
const coordinatePrecision = 8;
// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
const zoomLevels = computed(() =>
  Array.from(
    { length: props.maximumZoom - props.minimumZoom + 1 },
    (_, index) => props.minimumZoom + index,
  ),
);

watch(
  () => props.open,
  (open) => {
    if (open) {
      zoom.value = Math.min(
        props.maximumZoom,
        Math.max(props.minimumZoom, Math.round(props.initialZoom)),
      );
      longitude.value = Number(
        props.initialCoordinate.longitude.toFixed(coordinatePrecision),
      );
      latitude.value = Number(
        props.initialCoordinate.latitude.toFixed(coordinatePrecision),
      );
    }
  },
);

// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
function apply(): void {
  const nextZoom = Number(zoom.value);
  const nextLongitude = Number(longitude.value);
  const nextLatitude = Number(latitude.value);
  if (
    !Number.isInteger(nextZoom) ||
    nextZoom < props.minimumZoom ||
    nextZoom > props.maximumZoom ||
    !Number.isFinite(nextLongitude) ||
    nextLongitude < -180 ||
    nextLongitude > 180 ||
    !Number.isFinite(nextLatitude) ||
    Math.abs(nextLatitude) > WEB_MERCATOR_MAX_LATITUDE
  ) {
    return;
  }
  emit("apply", { longitude: nextLongitude, latitude: nextLatitude }, nextZoom);
}
</script>

<template>
  <CenteredDialog
    :open="open"
    title="Goto Coordinates"
    :is-modal="false"
    @close="emit('close')"
  >
    <form :id="formId" class="map-tool-form" @submit.prevent="apply">
      <p>Center the map on a WGS84 longitude and latitude.</p>
      <div class="coordinate-fields">
        <label>
          <span>Zoom level</span>
          <select v-model.number="zoom" required>
            <option v-for="level in zoomLevels" :key="level" :value="level">
              z{{ level }}
            </option>
          </select>
        </label>
        <label>
          <span>Longitude</span>
          <input
            v-model.number="longitude"
            type="number"
            min="-180"
            max="180"
            step="any"
            required
            autofocus
          />
          <CoordinateDmsReadout
            class="coordinate-readout"
            axis="longitude"
            :value="longitude"
          />
        </label>
        <label>
          <span>Latitude</span>
          <input
            v-model.number="latitude"
            type="number"
            :min="-WEB_MERCATOR_MAX_LATITUDE"
            :max="WEB_MERCATOR_MAX_LATITUDE"
            step="any"
            required
          />
          <CoordinateDmsReadout
            class="coordinate-readout"
            axis="latitude"
            :value="latitude"
          />
        </label>
      </div>
      <small>Latitude is limited to the Web Mercator map extent.</small>
    </form>
    <template #footer>
      <button type="button" class="dialog-button" @click="emit('close')">
        Cancel
      </button>
      <button type="submit" :form="formId" class="dialog-button primary">
        Apply
      </button>
    </template>
  </CenteredDialog>
</template>

<style scoped>
.map-tool-form {
  display: grid;
  gap: 1rem;
}

.map-tool-form > p {
  margin: 0;
  color: #536b64;
  line-height: 1.45;
}

.coordinate-fields {
  display: grid;
  grid-template-columns: 6rem repeat(2, minmax(0, 1fr));
  gap: 0.8rem;
}

.map-tool-form label {
  display: grid;
  min-width: 0;
  gap: 0.35rem;
  align-content: start;
  color: #314f47;
  font-size: 0.84rem;
  font-weight: 700;
}

.coordinate-readout {
  text-align: center;
}

.map-tool-form input,
.map-tool-form select,
.dialog-button {
  min-height: 2.5rem;
  padding: 0.55rem 0.65rem;
  border: 1px solid #9eb1a7;
  border-radius: 0.45rem;
  color: #142c28;
  background: #fff;
  font: inherit;
}

.map-tool-form input,
.map-tool-form select {
  width: 100%;
  min-width: 0;
}

.map-tool-form small {
  color: #597068;
}

.dialog-button {
  cursor: pointer;
}

.dialog-button.primary {
  border-color: #163832;
  color: #fff;
  background: #163832;
}

@media (max-width: 700px) {
  .coordinate-fields {
    grid-template-columns: 1fr;
  }
}
</style>
