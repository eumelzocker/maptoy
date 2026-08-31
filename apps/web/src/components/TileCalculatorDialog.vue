<script setup lang="ts">
// biome-ignore lint/correctness/noUnusedImports: referenced by the Vue template
import { WEB_MERCATOR_MAX_LATITUDE } from "@maptoy/map-core";
import { computed, onBeforeUnmount, ref, watch } from "vue";
import {
  type TileCalculatorInput,
  tileCalculatorPreviewUrl,
  tileCoordinateForLocation,
} from "../mapTileCalculator.js";
// biome-ignore lint/correctness/noUnusedImports: referenced by the Vue template
import CenteredDialog from "./CenteredDialog.vue";
// biome-ignore lint/correctness/noUnusedImports: referenced by the Vue template
import CoordinateDmsReadout from "./CoordinateDmsReadout.vue";

interface TileCalculatorMapSet {
  id: string;
  minZoom: number;
  maxZoom: number;
  tileSize: 256 | 512;
}

const props = defineProps<{
  open: boolean;
  mapSet: TileCalculatorMapSet | null;
  initialInput: TileCalculatorInput;
  cachedTilesOnly: boolean;
}>();

// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
const emit = defineEmits<{
  close: [];
}>();

const zoom = ref(0);
const longitude = ref(0);
const latitude = ref(0);
const coordinatePrecision = 8;
const previewUrl = ref<string | null>(null);
const previewStatus = ref<"idle" | "loading" | "loaded" | "error">("idle");
let previewTimer: ReturnType<typeof setTimeout> | null = null;

const calculatedTile = computed(() => {
  const mapSet = props.mapSet;
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

const previewTargetUrl = computed(() => {
  const mapSet = props.mapSet;
  const tile = calculatedTile.value;
  return props.open && mapSet !== null && tile !== null
    ? tileCalculatorPreviewUrl(mapSet.id, tile, props.cachedTilesOnly)
    : null;
});

// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
const previewStyle = computed(() => ({
  "--tile-preview-size": `${props.mapSet?.tileSize ?? 256}px`,
}));

watch(
  () => props.open,
  (open) => {
    if (open) {
      zoom.value = props.initialInput.zoom;
      longitude.value = Number(
        props.initialInput.longitude.toFixed(coordinatePrecision),
      );
      latitude.value = Number(
        props.initialInput.latitude.toFixed(coordinatePrecision),
      );
    }
  },
);

watch(previewTargetUrl, (url) => {
  if (previewTimer !== null) {
    clearTimeout(previewTimer);
    previewTimer = null;
  }
  previewUrl.value = null;
  previewStatus.value = url === null ? "idle" : "loading";
  if (url !== null) {
    previewTimer = setTimeout(() => {
      previewTimer = null;
      previewUrl.value = url;
    }, 200);
  }
});

onBeforeUnmount(() => {
  if (previewTimer !== null) {
    clearTimeout(previewTimer);
  }
});
</script>

<template>
  <CenteredDialog
    :open="open"
    title="Tile Calculator"
    :is-modal="false"
    fit-content
    allow-viewport-height
    @close="emit('close')"
  >
    <form
      class="map-tool-form"
      :class="{ 'cached-only': cachedTilesOnly }"
      :style="previewStyle"
      @submit.prevent
    >
      <p>Find the XYZ tile containing a WGS84 coordinate.</p>
      <p v-if="cachedTilesOnly" class="cached-only-note">
        The preview follows the Map view's <i>Cached Tiles only</i> option;
        cache misses appear as placeholder Tiles.
      </p>
      <div class="tile-fields">
        <label>
          <span>Zoom</span>
          <input
            v-model.number="zoom"
            type="number"
            :min="mapSet?.minZoom ?? 0"
            :max="mapSet?.maxZoom ?? 24"
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

      <figure class="tile-preview">
        <div class="tile-preview-frame">
          <span v-if="previewStatus === 'loading'">Loading Tile…</span>
          <img
            v-if="previewUrl"
            :key="previewUrl"
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
    </template>
  </CenteredDialog>
</template>

<style scoped>
.map-tool-form {
  display: grid;
  width: max(30rem, var(--tile-preview-size));
  max-width: 100%;
  gap: 1rem;
  --tile-preview-available-height: calc(100dvh - 25rem);
}

.map-tool-form.cached-only {
  --tile-preview-available-height: calc(100dvh - 28rem);
}

.map-tool-form > p {
  margin: 0;
  color: #536b64;
  line-height: 1.45;
}

.map-tool-form > .cached-only-note {
  font-size: 0.78rem;
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
  align-content: start;
  color: #314f47;
  font-size: 0.84rem;
  font-weight: 700;
}

.coordinate-readout {
  text-align: center;
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
  width: min(
    var(--tile-preview-size),
    100%,
    max(10rem, var(--tile-preview-available-height))
  );
  aspect-ratio: 1;
  overflow: hidden;
  justify-self: center;
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
  width: 100%;
  height: 100%;
  object-fit: contain;
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
