<script setup lang="ts">
import type { MapSetListItem } from "@maptoy/contracts";
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import type {
  MapComparisonCount,
  MapComparisonMode,
} from "../mapComparisonPreferences.js";
// biome-ignore lint/correctness/noUnusedImports: referenced by the Vue template
import HtmlTooltip from "./HtmlTooltip.vue";
// biome-ignore lint/correctness/noUnusedImports: referenced by the Vue template
import MapSetSelect from "./MapSetSelect.vue";

const props = defineProps<{
  active: boolean;
  count: MapComparisonCount;
  mode: MapComparisonMode;
  verticalSplit: number;
  horizontalSplit: number;
  mapSets: readonly MapSetListItem[];
  selectedMapSetIds: readonly (string | null)[];
  attributions: readonly string[];
  showAttribution: boolean;
}>();

const emit = defineEmits<{
  "update:verticalSplit": [value: number];
  "update:horizontalSplit": [value: number];
  source: [index: number, mapSetId: string | null];
  reset: [index: number];
  resize: [];
}>();

const stage = ref<HTMLElement | null>(null);
const hosts: Array<HTMLElement | null> = [];
const activeOrientation = ref<"vertical" | "horizontal" | null>(null);
let resizeObserver: ResizeObserver | null = null;
const paneCount = computed(() => (props.active ? props.count : 1));
// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
const selectedMapSets = computed(() =>
  props.selectedMapSetIds.map(
    (id) => props.mapSets.find((mapSet) => mapSet.id === id) ?? null,
  ),
);
const minimumSplit = 15;
const maximumSplit = 85;

// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
function setHost(index: number, value: unknown): void {
  hosts[index] = value instanceof HTMLElement ? value : null;
}

function getHosts(): readonly HTMLElement[] {
  return hosts.slice(0, paneCount.value).filter((host) => host !== null);
}

function regionStyle(index: number): Readonly<Record<string, string>> {
  if (!props.active) return { inset: "0" };
  const left = index % 2 === 0 ? 0 : props.verticalSplit;
  const width =
    index % 2 === 0 ? props.verticalSplit : 100 - props.verticalSplit;
  if (props.count === 2) {
    return { top: "0", left: `${left}%`, width: `${width}%`, height: "100%" };
  }
  const top = index < 2 ? 0 : props.horizontalSplit;
  const height =
    index < 2 ? props.horizontalSplit : 100 - props.horizontalSplit;
  return {
    top: `${top}%`,
    left: `${left}%`,
    width: `${width}%`,
    height: `${height}%`,
  };
}

// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
function paneStyle(index: number): Readonly<Record<string, string>> {
  if (!props.active || props.mode === "synchronized") {
    return regionStyle(index);
  }
  const top = props.count === 4 && index >= 2 ? props.horizontalSplit : 0;
  const right = index % 2 === 0 ? 100 - props.verticalSplit : 0;
  const bottom =
    props.count === 4 && index < 2 ? 100 - props.horizontalSplit : 0;
  const left = index % 2 === 0 ? 0 : props.verticalSplit;
  return { clipPath: `inset(${top}% ${right}% ${bottom}% ${left}%)` };
}

function constrainedSplit(value: number): number {
  return Math.min(maximumSplit, Math.max(minimumSplit, value));
}

function setSplit(orientation: "vertical" | "horizontal", value: number): void {
  const constrained = constrainedSplit(value);
  if (orientation === "vertical") {
    emit("update:verticalSplit", constrained);
  } else {
    emit("update:horizontalSplit", constrained);
  }
  emit("resize");
}

function updateFromPointer(event: PointerEvent): void {
  const orientation = activeOrientation.value;
  const bounds = stage.value?.getBoundingClientRect();
  if (orientation === null || bounds === undefined) return;
  const value =
    orientation === "vertical"
      ? ((event.clientX - bounds.left) / bounds.width) * 100
      : ((event.clientY - bounds.top) / bounds.height) * 100;
  setSplit(orientation, value);
}

function stopDragging(): void {
  if (activeOrientation.value === null) return;
  activeOrientation.value = null;
  window.removeEventListener("pointermove", updateFromPointer);
  window.removeEventListener("pointerup", stopDragging);
  window.removeEventListener("pointercancel", stopDragging);
  emit("resize");
}

// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
function startDragging(
  orientation: "vertical" | "horizontal",
  event: PointerEvent,
): void {
  event.preventDefault();
  stopDragging();
  activeOrientation.value = orientation;
  window.addEventListener("pointermove", updateFromPointer);
  window.addEventListener("pointerup", stopDragging);
  window.addEventListener("pointercancel", stopDragging);
  updateFromPointer(event);
}

// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
function moveWithKeyboard(
  orientation: "vertical" | "horizontal",
  event: KeyboardEvent,
): void {
  const current =
    orientation === "vertical" ? props.verticalSplit : props.horizontalSplit;
  let next = current;
  if (event.key === "Home") next = minimumSplit;
  else if (event.key === "End") next = maximumSplit;
  else if (
    (orientation === "vertical" && event.key === "ArrowLeft") ||
    (orientation === "horizontal" && event.key === "ArrowUp")
  ) {
    next -= 2;
  } else if (
    (orientation === "vertical" && event.key === "ArrowRight") ||
    (orientation === "horizontal" && event.key === "ArrowDown")
  ) {
    next += 2;
  } else {
    return;
  }
  event.preventDefault();
  setSplit(orientation, next);
}

onMounted(() => {
  if (stage.value !== null) {
    resizeObserver = new ResizeObserver(() => emit("resize"));
    resizeObserver.observe(stage.value);
  }
});
onBeforeUnmount(() => {
  stopDragging();
  resizeObserver?.disconnect();
});

defineExpose({ getHosts });
</script>

<template>
  <div
    ref="stage"
    class="map-comparison-layout"
    :class="{
      comparing: active,
      [`mode-${mode}`]: active,
      dragging: activeOrientation !== null,
    }"
  >
    <div
      v-for="index in paneCount"
      :key="index - 1"
      class="map-comparison-pane"
      :style="paneStyle(index - 1)"
    >
      <div :ref="(element) => setHost(index - 1, element)" class="map-host"></div>
    </div>

    <template v-if="active">
      <div
        v-for="index in count"
        :key="`label-${index - 1}`"
        class="map-comparison-control-region"
        :class="{ 'offset-left-controls': index % 2 === 1 }"
        :style="regionStyle(index - 1)"
      >
        <span class="map-comparison-controls">
          <span class="map-comparison-number">{{ index }}</span>
          <MapSetSelect
            class="mini-map-set-selector"
            :model-value="selectedMapSetIds[index - 1] ?? null"
            :items="mapSets"
            variant="plain"
            :align="index % 2 === 0 ? 'end' : 'start'"
            :aria-label="`Map ${index} Map Set`"
            @update:model-value="emit('source', index - 1, $event)"
          />
          <HtmlTooltip
            v-if="selectedMapSets[index - 1]"
            class="map-comparison-info"
            :label="`Map ${index} Map Set information`"
            :align="index % 2 === 0 ? 'end' : 'start'"
            fixed
          >
            <template #trigger>
              <i class="mdi mdi-information-outline" aria-hidden="true"></i>
            </template>
            <article class="map-comparison-info-card">
              <strong>{{ selectedMapSets[index - 1]?.name }}</strong>
              <dl>
                <div><dt>Renderer</dt><dd>{{ selectedMapSets[index - 1]?.rendererId }}</dd></div>
                <div><dt>Projection</dt><dd>{{ selectedMapSets[index - 1]?.sourceProjection }}</dd></div>
                <div><dt>Source zoom</dt><dd>{{ selectedMapSets[index - 1]?.minZoom }}–{{ selectedMapSets[index - 1]?.maxZoom }}</dd></div>
                <div><dt>Tiles</dt><dd>{{ selectedMapSets[index - 1]?.tileSize }} · {{ selectedMapSets[index - 1]?.tileFormat.toUpperCase() }}</dd></div>
              </dl>
              <button
                type="button"
                class="map-comparison-reset"
                @click="emit('reset', index - 1)"
              >
                <i class="mdi mdi-crosshairs-gps" aria-hidden="true"></i>
                Reset to initial view
              </button>
              <!-- Attribution is trusted, administrator-authored Map Set HTML. -->
              <div class="map-comparison-info-attribution" v-html="selectedMapSets[index - 1]?.attribution"></div>
              <a
                v-if="selectedMapSets[index - 1]?.termsUrl"
                :href="selectedMapSets[index - 1]?.termsUrl ?? undefined"
                target="_blank"
                rel="noopener noreferrer"
              >
                Provider terms
                <i class="mdi mdi-open-in-new" aria-hidden="true"></i>
              </a>
            </article>
          </HtmlTooltip>
        </span>
      </div>

      <template v-if="showAttribution">
        <div
          v-for="index in count"
          :key="`attribution-${index - 1}`"
          class="map-comparison-attribution-region"
          :style="regionStyle(index - 1)"
          aria-label="Map attribution"
        >
          <!-- Attribution is trusted, administrator-authored Map Set HTML. -->
          <span
            v-if="attributions[index - 1]"
            class="map-comparison-attribution"
            v-html="attributions[index - 1]"
          ></span>
        </div>
      </template>

      <button
        type="button"
        class="map-splitter vertical"
        :style="{ left: `${verticalSplit}%` }"
        role="separator"
        aria-label="Resize Map columns"
        aria-orientation="vertical"
        :aria-valuemin="minimumSplit"
        :aria-valuemax="maximumSplit"
        :aria-valuenow="Math.round(verticalSplit)"
        @pointerdown="startDragging('vertical', $event)"
        @keydown="moveWithKeyboard('vertical', $event)"
      ></button>
      <button
        v-if="count === 4"
        type="button"
        class="map-splitter horizontal"
        :style="{ top: `${horizontalSplit}%` }"
        role="separator"
        aria-label="Resize Map rows"
        aria-orientation="horizontal"
        :aria-valuemin="minimumSplit"
        :aria-valuemax="maximumSplit"
        :aria-valuenow="Math.round(horizontalSplit)"
        @pointerdown="startDragging('horizontal', $event)"
        @keydown="moveWithKeyboard('horizontal', $event)"
      ></button>
    </template>
  </div>
</template>

<style scoped>
.map-comparison-layout,
.map-comparison-pane,
.map-host {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.map-comparison-layout {
  overflow: hidden;
}

.map-comparison-pane {
  overflow: hidden;
  background: #a6c4b5;
}

.map-comparison-control-region {
  position: absolute;
  z-index: 900;
  overflow: hidden;
  padding: 0.3rem 0.55rem;
  pointer-events: none;
}

.map-comparison-control-region.offset-left-controls {
  padding-left: 3.25rem;
}

.map-comparison-controls {
  display: inline-flex;
  max-width: calc(100% - 0.5rem);
  gap: 0.12rem;
  align-items: center;
  padding: 0.05rem 0.15rem;
  border: 1px solid rgb(103 125 116 / 35%);
  border-radius: 0.35rem;
  color: #173b33;
  background: rgb(255 255 255 / 92%);
  box-shadow: 0 0.15rem 0.4rem rgb(24 54 45 / 18%);
  backdrop-filter: blur(0.25rem);
  pointer-events: auto;
}

.map-comparison-number {
  display: inline-grid;
  width: 1rem;
  height: 1rem;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 50%;
  color: #fff;
  background: #315f54;
  font-size: 0.58rem;
}

.mini-map-set-selector {
  min-width: 0;
  max-width: 22rem;
  flex: 0 1 auto;
}

.mini-map-set-selector :deep(.select-trigger) {
  grid-template-columns: minmax(0, 1fr) 0.7rem;
  min-height: 1.3rem;
  gap: 0.12rem;
  padding: 0.05rem 0.18rem;
  border-radius: 0.25rem;
  font-size: 0.66rem;
}

.mini-map-set-selector :deep(.select-icon) {
  display: none;
}

.map-comparison-info {
  flex: 0 0 auto;
}

.map-comparison-info :deep(.tooltip-trigger) {
  width: 1.3rem;
  height: 1.3rem;
  border-radius: 0.25rem;
  font-size: 0.8rem;
}

.map-comparison-info-card > strong {
  display: block;
  margin-bottom: 0.65rem;
  font-size: 0.9rem;
}

.map-comparison-info-card dl {
  display: grid;
  gap: 0.35rem;
  margin: 0;
}

.map-comparison-info-card dl div {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
}

.map-comparison-info-card dt {
  color: #617870;
}

.map-comparison-info-card dd {
  margin: 0;
  font-weight: 700;
}

.map-comparison-info-attribution {
  margin-top: 0.65rem;
  padding-top: 0.65rem;
  border-top: 1px solid #d7e0db;
  color: #536b64;
  font-size: 0.75rem;
  line-height: 1.35;
}

.map-comparison-reset {
  display: inline-flex;
  gap: 0.3rem;
  align-items: center;
  margin-top: 0.6rem;
  padding: 0;
  border: 0;
  color: #17453c;
  background: transparent;
  font: inherit;
  font-size: 0.78rem;
  font-weight: 700;
  cursor: pointer;
}

.map-comparison-info-card > a {
  display: inline-flex;
  gap: 0.3rem;
  align-items: center;
  margin-top: 0.6rem;
  color: #17453c;
  font-size: 0.78rem;
  font-weight: 700;
}

.map-comparison-attribution-region {
  position: absolute;
  z-index: 900;
  display: flex;
  overflow: hidden;
  align-items: flex-end;
  justify-content: flex-end;
  padding: 0.2rem 0.3rem;
  pointer-events: none;
}

.map-comparison-attribution {
  max-width: 100%;
  overflow: hidden;
  padding: 0.12rem 0.28rem;
  border-radius: 0.2rem;
  color: #2f403c;
  background: rgb(255 255 255 / 82%);
  font-size: 0.62rem;
  line-height: 1.25;
  pointer-events: auto;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.map-comparison-attribution :deep(a) {
  color: inherit;
}

.map-splitter {
  position: absolute;
  z-index: 950;
  margin: 0;
  padding: 0;
  border: 0;
  outline: 0;
  background: transparent;
  touch-action: none;
}

.map-splitter::after {
  position: absolute;
  content: "";
  background: rgb(255 255 255 / 82%);
  opacity: 0;
  pointer-events: none;
  transition: opacity 120ms ease;
}

.map-splitter:hover::after,
.map-splitter:focus-visible::after,
.dragging .map-splitter::after {
  opacity: 1;
}

.map-splitter.vertical {
  top: 0;
  bottom: 0;
  width: 0.8rem;
  cursor: col-resize;
  transform: translateX(-50%);
}

.map-splitter.vertical::after {
  top: 0;
  bottom: 0;
  left: calc(50% - 0.5px);
  width: 1px;
}

.map-splitter.horizontal {
  right: 0;
  left: 0;
  height: 0.8rem;
  cursor: row-resize;
  transform: translateY(-50%);
}

.map-splitter.horizontal::after {
  top: calc(50% - 0.5px);
  right: 0;
  left: 0;
  height: 1px;
}
</style>
