<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  useId,
  watch,
} from "vue";
import {
  formatMapZoomLevel,
  type MapZoomDirection,
  mapZoomControlTarget,
} from "../mapZoomControl.js";

const props = withDefaults(
  defineProps<{
    zoom: number | null;
    minimum: number;
    maximum: number;
    autoCloseOnChange?: boolean;
  }>(),
  { autoCloseOnChange: false },
);

const emit = defineEmits<{
  change: [zoom: number];
}>();

// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
const sliderId = `map-zoom-slider-${useId()}`;
const controlHost = ref<HTMLElement | null>(null);
const levelButton = ref<HTMLButtonElement | null>(null);
const slider = ref<HTMLInputElement | null>(null);
const sliderOpen = ref(false);
const draftZoom = ref(0);

// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
const label = computed(() =>
  props.zoom === null ? "—" : formatMapZoomLevel(props.zoom),
);
const sliderMinimum = computed(() => Math.ceil(props.minimum));
const sliderMaximum = computed(() => Math.floor(props.maximum));
// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
const zoomInDisabled = computed(
  () => props.zoom === null || props.zoom >= props.maximum,
);
// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
const zoomOutDisabled = computed(
  () => props.zoom === null || props.zoom <= props.minimum,
);

function constrainedIntegerZoom(value: number): number {
  return Math.min(
    sliderMaximum.value,
    Math.max(sliderMinimum.value, Math.round(value)),
  );
}

function synchronizeDraftZoom(): void {
  if (props.zoom !== null) {
    draftZoom.value = constrainedIntegerZoom(props.zoom);
  }
}

watch(
  [() => props.zoom, () => props.minimum, () => props.maximum],
  synchronizeDraftZoom,
  { immediate: true },
);

// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
function changeZoom(direction: MapZoomDirection, event: MouseEvent): void {
  if (props.zoom === null) return;
  const target = mapZoomControlTarget(
    props.zoom,
    direction,
    event,
    props.minimum,
    props.maximum,
  );
  if (target !== props.zoom) {
    emit("change", target);
  }
}

// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
async function toggleSlider(): Promise<void> {
  if (props.zoom === null) return;
  sliderOpen.value = !sliderOpen.value;
  if (sliderOpen.value) {
    synchronizeDraftZoom();
    await nextTick();
    slider.value?.focus();
  }
}

function updateSliderZoom(event: Event): void {
  if (event.currentTarget instanceof HTMLInputElement) {
    draftZoom.value = Number(event.currentTarget.value);
  }
}

// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
function applySliderZoom(event: Event): void {
  updateSliderZoom(event);
  if (props.zoom !== draftZoom.value) {
    emit("change", draftZoom.value);
  }
  if (props.autoCloseOnChange) {
    closeSlider();
  }
}

function closeSlider(restoreFocus = false): void {
  if (!sliderOpen.value) return;
  sliderOpen.value = false;
  if (restoreFocus) {
    void nextTick(() => levelButton.value?.focus());
  }
}

// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
function onSliderKeydown(event: KeyboardEvent): void {
  if (event.key === "Escape") {
    event.preventDefault();
    closeSlider(true);
  }
}

function onDocumentPointerDown(event: PointerEvent): void {
  const target = event.target;
  if (
    sliderOpen.value &&
    target instanceof Node &&
    !controlHost.value?.contains(target)
  ) {
    closeSlider();
  }
}

onMounted(() =>
  document.addEventListener("pointerdown", onDocumentPointerDown),
);
onBeforeUnmount(() =>
  document.removeEventListener("pointerdown", onDocumentPointerDown),
);
</script>

<template>
  <div ref="controlHost" class="map-zoom-control-host">
    <div class="map-zoom-control" role="group" aria-label="Map zoom">
      <button
        type="button"
        :disabled="zoomInDisabled"
        aria-label="Zoom in"
        title="Zoom in; Ctrl-click for a ¼ step; Shift-click for next integer zoom"
        @click="changeZoom('in', $event)"
      >
        <span aria-hidden="true">+</span>
      </button>
      <button
        ref="levelButton"
        type="button"
        class="zoom-level-button"
        :disabled="zoom === null"
        :aria-expanded="sliderOpen"
        :aria-controls="sliderId"
        :aria-label="`Zoom level ${label}; select zoom level`"
        :title="`Zoom level ${label}; click to select`"
        @click="toggleSlider"
      >
        {{ label }}
      </button>
      <button
        type="button"
        :disabled="zoomOutDisabled"
        aria-label="Zoom out"
        title="Zoom out; Ctrl-click for a ¼ step; Shift-click for previous integer zoom"
        @click="changeZoom('out', $event)"
      >
        <span aria-hidden="true">−</span>
      </button>
    </div>

    <section
      v-if="sliderOpen"
      :id="sliderId"
      class="zoom-slider-panel"
      aria-label="Select zoom level"
    >
      <label :for="`${sliderId}-input`">Zoom {{ draftZoom }}</label>
      <input
        :id="`${sliderId}-input`"
        ref="slider"
        type="range"
        :min="sliderMinimum"
        :max="sliderMaximum"
        step="1"
        :value="draftZoom"
        @input="updateSliderZoom"
        @change="applySliderZoom"
        @keydown="onSliderKeydown"
      />
      <div class="zoom-slider-range" aria-hidden="true">
        <span>{{ sliderMinimum }}</span>
        <span>{{ sliderMaximum }}</span>
      </div>
    </section>
  </div>
</template>

<style scoped>
.map-zoom-control-host {
  position: absolute;
  top: 0.625rem;
  left: 0.625rem;
  z-index: 1000;
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.map-zoom-control {
  display: flex;
  overflow: hidden;
  flex: 0 0 auto;
  flex-direction: column;
  gap: 0;
  border: 2px solid rgb(0 0 0 / 20%);
  border-radius: 0.3rem;
  background: white;
  background-clip: padding-box;
  box-shadow: 0 0.1rem 0.35rem rgb(0 0 0 / 12%);
}

.map-zoom-control button {
  display: grid;
  width: 1.875rem;
  height: 1.875rem;
  place-items: center;
  padding: 0;
  border: 0;
  border-bottom: 1px solid #ccc;
  color: #333;
  background: #fff;
  font:
    700 1.15rem / 1 system-ui,
    sans-serif;
}

.map-zoom-control .zoom-level-button {
  font-size: 0.8rem;
  user-select: none;
}

.map-zoom-control button:last-child {
  border-bottom: 0;
}

.map-zoom-control button:not(:disabled) {
  cursor: pointer;
}

.map-zoom-control button:not(:disabled):hover,
.map-zoom-control button:not(:disabled):focus-visible {
  color: #17453c;
  background: #f1f6f3;
}

.map-zoom-control button:focus-visible {
  position: relative;
  z-index: 1;
  outline: 2px solid #47796c;
  outline-offset: -2px;
}

.map-zoom-control button:disabled {
  color: #999;
  cursor: not-allowed;
}

.zoom-slider-panel {
  width: min(16rem, calc(100vw - 4rem));
  padding: 0.65rem 0.75rem 0.5rem;
  border: 1px solid rgb(58 87 78 / 45%);
  border-radius: 0.45rem;
  background: rgb(255 255 255 / 96%);
  box-shadow: 0 0.35rem 1rem rgb(24 54 45 / 18%);
}

.zoom-slider-panel label {
  display: block;
  margin-bottom: 0.35rem;
  color: #314f47;
  font-size: 0.78rem;
  font-weight: 800;
}

.zoom-slider-panel input {
  display: block;
  width: 100%;
  margin: 0;
  accent-color: #17453c;
  cursor: pointer;
}

.zoom-slider-range {
  display: flex;
  justify-content: space-between;
  margin-top: 0.15rem;
  color: #617870;
  font-size: 0.7rem;
  font-variant-numeric: tabular-nums;
}
</style>
