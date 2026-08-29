<script setup lang="ts">
import type { GeographicCoordinate } from "@maptoy/map-adapter-sdk";
import { WEB_MERCATOR_MAX_LATITUDE } from "@maptoy/map-core";
import { ref, useId, watch } from "vue";
// biome-ignore lint/correctness/noUnusedImports: referenced by the Vue template
import CenteredDialog from "./CenteredDialog.vue";
// biome-ignore lint/correctness/noUnusedImports: referenced by the Vue template
import CoordinateDmsReadout from "./CoordinateDmsReadout.vue";

const props = defineProps<{
  open: boolean;
  initialCoordinate: GeographicCoordinate;
}>();

const emit = defineEmits<{
  close: [];
  apply: [coordinate: GeographicCoordinate];
}>();

// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
const formId = `goto-coordinates-form-${useId()}`;
const longitude = ref(0);
const latitude = ref(0);

watch(
  () => props.open,
  (open) => {
    if (open) {
      longitude.value = props.initialCoordinate.longitude;
      latitude.value = props.initialCoordinate.latitude;
    }
  },
);

// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
function apply(): void {
  const nextLongitude = Number(longitude.value);
  const nextLatitude = Number(latitude.value);
  if (
    !Number.isFinite(nextLongitude) ||
    nextLongitude < -180 ||
    nextLongitude > 180 ||
    !Number.isFinite(nextLatitude) ||
    Math.abs(nextLatitude) > WEB_MERCATOR_MAX_LATITUDE
  ) {
    return;
  }
  emit("apply", { longitude: nextLongitude, latitude: nextLatitude });
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
          <CoordinateDmsReadout axis="longitude" :value="longitude" />
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
          <CoordinateDmsReadout axis="latitude" :value="latitude" />
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
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.8rem;
}

.map-tool-form label {
  display: grid;
  min-width: 0;
  gap: 0.35rem;
  color: #314f47;
  font-size: 0.84rem;
  font-weight: 700;
}

.map-tool-form input,
.dialog-button {
  min-height: 2.5rem;
  padding: 0.55rem 0.65rem;
  border: 1px solid #9eb1a7;
  border-radius: 0.45rem;
  color: #142c28;
  background: #fff;
  font: inherit;
}

.map-tool-form input {
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
