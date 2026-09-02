<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import type {
  MapComparisonCount,
  MapComparisonMode,
} from "../mapComparisonPreferences.js";

const props = defineProps<{
  active: boolean;
  count: MapComparisonCount;
  mode: MapComparisonMode;
  verticalSplit: number;
  horizontalSplit: number;
  labels: readonly string[];
}>();

const emit = defineEmits<{
  "update:verticalSplit": [value: number];
  "update:horizontalSplit": [value: number];
  resize: [];
}>();

const stage = ref<HTMLElement | null>(null);
const hosts: Array<HTMLElement | null> = [];
const activeOrientation = ref<"vertical" | "horizontal" | null>(null);
let resizeObserver: ResizeObserver | null = null;
const paneCount = computed(() => (props.active ? props.count : 1));
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
        class="map-comparison-label-region"
        :class="{ primary: index === 1 }"
        :style="regionStyle(index - 1)"
      >
        <span class="map-comparison-label">
          <span class="map-comparison-number">{{ index }}</span>
          {{ labels[index - 1] }}
        </span>
      </div>

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

.map-comparison-label-region {
  position: absolute;
  z-index: 900;
  overflow: hidden;
  padding: 0.55rem;
  pointer-events: none;
}

.map-comparison-label-region.primary {
  padding-left: 3.25rem;
}

.map-comparison-label {
  display: inline-flex;
  max-width: calc(100% - 0.5rem);
  gap: 0.35rem;
  align-items: center;
  overflow: hidden;
  padding: 0.25rem 0.45rem;
  border-radius: 0.35rem;
  color: #173b33;
  background: rgb(255 255 255 / 88%);
  box-shadow: 0 0.15rem 0.4rem rgb(24 54 45 / 18%);
  font-size: 0.75rem;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
  backdrop-filter: blur(0.25rem);
}

.map-comparison-number {
  display: inline-grid;
  width: 1.15rem;
  height: 1.15rem;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 50%;
  color: #fff;
  background: #315f54;
  font-size: 0.65rem;
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
