<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, useId, watch } from "vue";
import {
  activateDialog,
  deactivateDialog,
  isTopDialog,
} from "../dialogStack.js";

const props = withDefaults(
  defineProps<{
    open: boolean;
    title: string;
    isModal?: boolean;
    initialPosition?: "center" | "map-controls";
    contentScrollable?: boolean;
    fitContent?: boolean;
    allowViewportHeight?: boolean;
  }>(),
  {
    isModal: true,
    initialPosition: "center",
    contentScrollable: true,
    fitContent: false,
    allowViewportHeight: false,
  },
);

const emit = defineEmits<{
  close: [];
}>();

// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
const titleId = `centered-dialog-title-${useId()}`;
const dialogStackId = Symbol("centered-dialog");
const panel = ref<HTMLElement | null>(null);
const dragOffset = ref({ x: 0, y: 0 });
const dragging = ref(false);
const zIndex = ref(3000);
let previouslyFocused: HTMLElement | null = null;
let dragSession: {
  pointerId: number;
  pointerX: number;
  pointerY: number;
  offsetX: number;
  offsetY: number;
  minimumDeltaX: number;
  maximumDeltaX: number;
  minimumDeltaY: number;
  maximumDeltaY: number;
} | null = null;

const focusableSelector = [
  "button:not(:disabled)",
  "[href]",
  "input:not(:disabled)",
  "select:not(:disabled)",
  "textarea:not(:disabled)",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

function close(): void {
  emit("close");
}

function bringToFront(): void {
  zIndex.value = activateDialog(dialogStackId);
}

function activate(): void {
  bringToFront();
  panel.value?.focus();
}

defineExpose({ activate });

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
function startDrag(event: PointerEvent): void {
  if (
    panel.value === null ||
    (event.pointerType === "mouse" && event.button !== 0) ||
    (event.target instanceof Element && event.target.closest("button") !== null)
  ) {
    return;
  }
  const bounds = panel.value.getBoundingClientRect();
  const viewportMargin = 8;
  dragSession = {
    pointerId: event.pointerId,
    pointerX: event.clientX,
    pointerY: event.clientY,
    offsetX: dragOffset.value.x,
    offsetY: dragOffset.value.y,
    minimumDeltaX: viewportMargin - bounds.left,
    maximumDeltaX: window.innerWidth - viewportMargin - bounds.right,
    minimumDeltaY: viewportMargin - bounds.top,
    maximumDeltaY: window.innerHeight - viewportMargin - bounds.bottom,
  };
  dragging.value = true;
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  event.preventDefault();
}

// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
function drag(event: PointerEvent): void {
  const session = dragSession;
  if (session === null || session.pointerId !== event.pointerId) {
    return;
  }
  dragOffset.value = {
    x:
      session.offsetX +
      clamp(
        event.clientX - session.pointerX,
        session.minimumDeltaX,
        session.maximumDeltaX,
      ),
    y:
      session.offsetY +
      clamp(
        event.clientY - session.pointerY,
        session.minimumDeltaY,
        session.maximumDeltaY,
      ),
  };
}

// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
function stopDrag(event: PointerEvent): void {
  if (dragSession?.pointerId !== event.pointerId) {
    return;
  }
  const target = event.currentTarget as HTMLElement;
  if (target.hasPointerCapture(event.pointerId)) {
    target.releasePointerCapture(event.pointerId);
  }
  dragSession = null;
  dragging.value = false;
}

function focusableElements(): HTMLElement[] {
  return Array.from(
    panel.value?.querySelectorAll<HTMLElement>(focusableSelector) ?? [],
  ).filter((element) => !element.hasAttribute("hidden"));
}

function onKeydown(event: KeyboardEvent): void {
  if (!isTopDialog(dialogStackId)) {
    return;
  }
  if (event.key === "Escape") {
    event.preventDefault();
    event.stopImmediatePropagation();
    close();
    return;
  }
  if (event.key !== "Tab") {
    return;
  }
  if (!props.isModal) {
    return;
  }
  const elements = focusableElements();
  if (elements.length === 0) {
    event.preventDefault();
    panel.value?.focus();
    return;
  }
  const first = elements[0];
  const last = elements.at(-1);
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last?.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first?.focus();
  }
}

function removeKeyListener(): void {
  document.removeEventListener("keydown", onKeydown);
}

function deactivate(): void {
  removeKeyListener();
  deactivateDialog(dialogStackId);
}

// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
function onBackdropMouseDown(): void {
  if (props.isModal) {
    close();
  }
}

watch(
  () => props.open,
  async (open) => {
    if (!open) {
      deactivate();
      dragSession = null;
      dragging.value = false;
      previouslyFocused?.focus();
      previouslyFocused = null;
      return;
    }
    previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    bringToFront();
    dragOffset.value = { x: 0, y: 0 };
    document.addEventListener("keydown", onKeydown);
    await nextTick();
    const initialFocus =
      panel.value?.querySelector<HTMLElement>("[autofocus]") ??
      focusableElements()[0] ??
      panel.value;
    initialFocus?.focus();
  },
  { flush: "post" },
);

onBeforeUnmount(deactivate);
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="dialog-backdrop"
      :class="[
        `initial-${initialPosition}`,
        { 'non-modal': !isModal },
      ]"
      :style="{ zIndex }"
      @mousedown.self="onBackdropMouseDown"
    >
      <section
        ref="panel"
        class="centered-dialog"
        :class="{
          dragging,
          'fit-content': fitContent,
          'allow-viewport-height': allowViewportHeight,
        }"
        :style="{ transform: `translate(${dragOffset.x}px, ${dragOffset.y}px)` }"
        role="dialog"
        :aria-modal="isModal ? 'true' : undefined"
        :aria-labelledby="titleId"
        tabindex="-1"
        @pointerdown="bringToFront"
        @focusin="bringToFront"
      >
        <header
          class="dialog-header"
          @pointerdown="startDrag"
          @pointermove="drag"
          @pointerup="stopDrag"
          @pointercancel="stopDrag"
        >
          <h2 :id="titleId">{{ title }}</h2>
          <div class="dialog-header-actions">
            <slot name="header-actions"></slot>
            <button
              type="button"
              class="dialog-close"
              :aria-label="`Close ${title}`"
              @click="close"
            >
              <i class="mdi mdi-close" aria-hidden="true"></i>
            </button>
          </div>
        </header>
        <div
          class="dialog-content"
          :class="{ contained: !contentScrollable }"
        >
          <slot></slot>
        </div>
        <footer v-if="$slots.footer" class="dialog-footer">
          <slot name="footer"></slot>
        </footer>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.dialog-backdrop {
  position: fixed;
  inset: 0;
  display: grid;
  padding: 1rem;
  place-items: center;
  background: transparent;
}

.dialog-backdrop.non-modal {
  pointer-events: none;
}

.dialog-backdrop.initial-map-controls {
  padding-left: 3.65rem;
  place-items: center start;
}

.centered-dialog {
  display: flex;
  width: min(32rem, 100%);
  max-height: min(44rem, calc(100dvh - 2rem));
  overflow: hidden;
  flex-direction: column;
  border: 1px solid rgb(103 125 116 / 60%);
  border-radius: 0.8rem;
  color: #142c28;
  background: #fff;
  box-shadow: 0 1.5rem 4rem rgb(10 28 24 / 32%);
}

.centered-dialog.fit-content {
  width: fit-content;
  max-width: 100%;
}

.centered-dialog.allow-viewport-height {
  max-height: calc(100dvh - 2rem);
}

.non-modal .centered-dialog {
  pointer-events: auto;
}

.centered-dialog:focus {
  outline: none;
}

.dialog-header,
.dialog-footer,
.dialog-header-actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
}

.dialog-header {
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem 1.1rem;
  border-bottom: 1px solid #d7e0db;
  cursor: grab;
  touch-action: none;
  user-select: none;
}

.centered-dialog.dragging .dialog-header {
  cursor: grabbing;
}

.dialog-header h2 {
  margin: 0;
  color: #163832;
  font-size: 1.15rem;
}

.dialog-header-actions {
  gap: 0.45rem;
}

.dialog-close {
  display: grid;
  width: 2.25rem;
  min-height: 2.25rem;
  padding: 0;
  place-items: center;
  border: 0;
  border-radius: 0.35rem;
  color: #314f47;
  background: transparent;
  font: inherit;
  font-size: 1.25rem;
  cursor: pointer;
}

.dialog-close:hover,
.dialog-close:focus-visible {
  background: #e7eee9;
}

.dialog-content {
  min-height: 0;
  padding: 1.1rem;
  overflow-y: auto;
}

.dialog-content.contained {
  display: flex;
  overflow: hidden;
}

.dialog-footer {
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.7rem;
  padding: 0.9rem 1.1rem;
  border-top: 1px solid #d7e0db;
  background: #f6f8f7;
}

@media (max-width: 700px) {
  .dialog-backdrop.initial-map-controls {
    padding-left: 3.4rem;
  }
}
</style>
