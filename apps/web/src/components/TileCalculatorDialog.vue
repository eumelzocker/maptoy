<script setup lang="ts">
// biome-ignore lint/correctness/noUnusedImports: referenced by the Vue template
import { WEB_MERCATOR_MAX_LATITUDE } from "@maptoy/map-core";
import { computed, nextTick, ref, useId, watch } from "vue";
import {
  type TileCalculatorInput,
  tileCoordinateForLocation,
} from "../mapTileCalculator.js";
// biome-ignore lint/correctness/noUnusedImports: referenced by the Vue template
import CenteredDialog from "./CenteredDialog.vue";

interface TileCalculatorMapSet {
  id: string;
  minZoom: number;
  maxZoom: number;
}

const props = defineProps<{
  open: boolean;
  mapSet: TileCalculatorMapSet | null;
  initialInput: TileCalculatorInput;
}>();

// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
const emit = defineEmits<{
  close: [];
}>();

// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
const formId = `tile-calculator-form-${useId()}`;
const zoom = ref(0);
const longitude = ref(0);
const latitude = ref(0);
const previewUrl = ref<string | null>(null);
const previewStatus = ref<"idle" | "loading" | "loaded" | "error">("idle");
const previewKey = ref(0);
const activeMapSet = ref<TileCalculatorMapSet | null>(null);

const calculatedTile = computed(() => {
  const mapSet = activeMapSet.value;
  if (mapSet === null) {
    return null;
  }
  const tile = tileCoordinateForLocation({
    zoom: Number(zoom.value),
    longitude: Number(longitude.value),
    latitude: Number(latitude.value),
  });
  return tile !== null &&
    tile.zoom >= mapSet.minZoom &&
    tile.zoom <= mapSet.maxZoom
    ? tile
    : null;
});

watch(
  () => props.open,
  (open) => {
    if (open) {
      activeMapSet.value = props.mapSet === null ? null : { ...props.mapSet };
      zoom.value = props.initialInput.zoom;
      longitude.value = props.initialInput.longitude;
      latitude.value = props.initialInput.latitude;
      previewUrl.value = null;
      previewStatus.value = "idle";
    }
  },
);

watch([zoom, longitude, latitude], () => {
  previewUrl.value = null;
  previewStatus.value = "idle";
});

// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
async function loadTile(): Promise<void> {
  const mapSet = activeMapSet.value;
  const tile = calculatedTile.value;
  if (mapSet === null || tile === null) {
    return;
  }
  previewUrl.value = null;
  previewStatus.value = "loading";
  previewKey.value += 1;
  await nextTick();
  previewUrl.value = `api/map-sets/${encodeURIComponent(mapSet.id)}/tiles/${tile.zoom}/${tile.x}/${tile.y}`;
}
</script>

<template>
  <CenteredDialog
    :open="open"
    title="Tile Calculator"
    :is-modal="false"
    @close="emit('close')"
  >
    <form :id="formId" class="map-tool-form" @submit.prevent="loadTile">
      <p>Find the XYZ tile containing a WGS84 coordinate.</p>
      <div class="tile-fields">
        <label>
          <span>Zoom</span>
          <input
            v-model.number="zoom"
            type="number"
            :min="activeMapSet?.minZoom ?? 0"
            :max="activeMapSet?.maxZoom ?? 24"
            step="1"
            required
            autofocus
          />
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
        </label>
      </div>

      <output v-if="calculatedTile" class="tile-result" aria-live="polite">
        <span>XYZ tile coordinates</span>
        <strong>
          z {{ calculatedTile.zoom }} · x {{ calculatedTile.x }} · y {{ calculatedTile.y }}
        </strong>
      </output>
      <p v-else class="tool-validation" role="status">
        Enter an integer zoom within this Map Set's range and a location inside
        the Web Mercator extent. Longitude 180° belongs to the wrapped tile at
        −180°.
      </p>

      <figure v-if="previewUrl" class="tile-preview">
        <div class="tile-preview-frame">
          <span v-if="previewStatus === 'loading'">Loading Tile…</span>
          <img
            :key="previewKey"
            v-show="previewStatus !== 'error'"
            :src="previewUrl"
            :alt="calculatedTile
              ? `Tile z ${calculatedTile.zoom}, x ${calculatedTile.x}, y ${calculatedTile.y}`
              : 'Calculated Tile preview'"
            @load="previewStatus = 'loaded'"
            @error="previewStatus = 'error'"
          />
        </div>
        <figcaption v-if="previewStatus === 'error'" role="alert">
          The Tile could not be loaded from the selected Map Set.
        </figcaption>
      </figure>
    </form>
    <template #footer>
      <button type="button" class="dialog-button" @click="emit('close')">
        Close
      </button>
      <button
        type="submit"
        :form="formId"
        class="dialog-button primary"
        :disabled="calculatedTile === null"
      >
        Load Tile
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

.tile-fields {
  display: grid;
  grid-template-columns: 0.7fr 1fr 1fr;
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

.dialog-button {
  cursor: pointer;
}

.dialog-button.primary {
  border-color: #163832;
  color: #fff;
  background: #163832;
}

.dialog-button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.tile-result {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: baseline;
  padding: 0.75rem;
  border-radius: 0.5rem;
  color: #314f47;
  background: #e7f5eb;
  font-size: 0.84rem;
}

.tile-result strong {
  color: #163832;
  font-family: ui-monospace, monospace;
  white-space: nowrap;
}

.map-tool-form .tool-validation {
  padding: 0.7rem 0.75rem;
  border-left: 0.2rem solid #bc8d1c;
  background: #fff6d9;
  color: #6b5317;
  font-size: 0.82rem;
}

.tile-preview {
  display: grid;
  gap: 0.5rem;
  margin: 0;
}

.tile-preview-frame {
  position: relative;
  display: grid;
  min-height: 10rem;
  overflow: hidden;
  place-items: center;
  border: 1px solid #b6c6bc;
  border-radius: 0.55rem;
  background:
    linear-gradient(45deg, #e4e9e6 25%, transparent 25%),
    linear-gradient(-45deg, #e4e9e6 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #e4e9e6 75%),
    linear-gradient(-45deg, transparent 75%, #e4e9e6 75%) #f7f9f8;
  background-position: 0 0, 0 0.5rem, 0.5rem -0.5rem, -0.5rem 0;
  background-size: 1rem 1rem;
}

.tile-preview-frame > span {
  color: #536b64;
  font-size: 0.84rem;
}

.tile-preview img {
  display: block;
  max-width: 100%;
  max-height: min(25rem, 50dvh);
}

.tile-preview-frame > span + img {
  position: absolute;
}

.tile-preview figcaption {
  color: #9b3327;
  font-size: 0.84rem;
}

@media (max-width: 700px) {
  .tile-fields {
    grid-template-columns: 1fr;
  }

  .tile-result {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
