<script setup lang="ts">
import type { CSSProperties } from "vue";
import { nextTick, ref, useId } from "vue";

const props = withDefaults(
  defineProps<{
    label: string;
    align?: "start" | "end";
    fixed?: boolean;
    unstyledTrigger?: boolean;
  }>(),
  { align: "start", fixed: false, unstyledTrigger: false },
);

// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
const contentId = useId();
const root = ref<HTMLElement | null>(null);
const fixedContent = ref<HTMLElement | null>(null);
const open = ref(false);
const fixedStyle = ref<CSSProperties>({
  top: "0",
  left: "0",
  visibility: "hidden",
});

function positionFixedContent(): void {
  if (root.value === null || fixedContent.value === null) {
    return;
  }
  const trigger = root.value.getBoundingClientRect();
  const content = fixedContent.value.getBoundingClientRect();
  const gap = 8;
  const edge = 8;
  const alignedLeft =
    props.align === "end" ? trigger.right - content.width : trigger.left;
  const left = Math.max(
    edge,
    Math.min(alignedLeft, window.innerWidth - content.width - edge),
  );
  const below = trigger.bottom + gap;
  const above = trigger.top - content.height - gap;
  const top =
    below + content.height <= window.innerHeight - edge || above < edge
      ? below
      : above;
  fixedStyle.value = {
    top: `${top}px`,
    left: `${left}px`,
    visibility: "visible",
  };
}

function openTooltip(): void {
  open.value = true;
  if (props.fixed) {
    void nextTick(positionFixedContent);
  }
}

function closeTooltip(): void {
  open.value = false;
}

// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
function toggleTooltip(): void {
  if (open.value) {
    closeTooltip();
  } else {
    openTooltip();
  }
}

// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
function closeAfterFocusLeaves(event: FocusEvent): void {
  const nextTarget = event.relatedTarget;
  if (
    !(nextTarget instanceof Node) ||
    (!root.value?.contains(nextTarget) &&
      !fixedContent.value?.contains(nextTarget))
  ) {
    closeTooltip();
  }
}
</script>

<template>
  <span
    ref="root"
    class="html-tooltip"
    :class="[`align-${align}`, { open }]"
    @mouseenter="openTooltip"
    @mouseleave="closeTooltip"
    @focusin="openTooltip"
    @focusout="closeAfterFocusLeaves"
    @keydown.esc="closeTooltip"
  >
    <button
      class="tooltip-trigger"
      :class="{ unstyled: unstyledTrigger }"
      type="button"
      :aria-label="label"
      aria-haspopup="dialog"
      :aria-expanded="open"
      :aria-controls="contentId"
      @click.stop="toggleTooltip"
    >
      <slot name="trigger">
        <i class="mdi mdi-information-outline" aria-hidden="true"></i>
      </slot>
    </button>
    <span
      v-if="open && !fixed"
      :id="contentId"
      class="tooltip-content"
      role="dialog"
      :aria-label="label"
    >
      <slot></slot>
    </span>
  </span>
  <Teleport v-if="open && fixed" to="body">
    <span
      :id="contentId"
      ref="fixedContent"
      class="tooltip-content fixed"
      role="dialog"
      :aria-label="label"
      :style="fixedStyle"
    >
      <slot></slot>
    </span>
  </Teleport>
</template>

<style scoped>
.html-tooltip {
  position: relative;
  display: inline-flex;
}

.tooltip-trigger {
  display: grid;
  width: 2.35rem;
  height: 2.35rem;
  padding: 0;
  place-items: center;
  border: 0;
  border-radius: 0.35rem;
  color: #163832;
  background: transparent;
  font: inherit;
  font-size: 1.25rem;
  cursor: help;
}

.tooltip-trigger:hover,
.tooltip-trigger:focus-visible,
.open .tooltip-trigger {
  background: #dfe9e3;
}

.tooltip-trigger.unstyled {
  width: auto;
  height: auto;
  border-radius: 999px;
  color: inherit;
  background: transparent;
  font-size: inherit;
}

.tooltip-trigger.unstyled:hover,
.tooltip-trigger.unstyled:focus-visible,
.open .tooltip-trigger.unstyled {
  background: transparent;
}

.tooltip-trigger:focus-visible {
  outline: 2px solid #a34521;
  outline-offset: 1px;
}

.tooltip-content {
  position: absolute;
  top: calc(100% + 0.55rem);
  z-index: 20;
  width: min(20rem, calc(100vw - 2rem));
  padding: 0.9rem;
  border: 1px solid rgb(103 125 116 / 45%);
  border-radius: 0.55rem;
  color: #142c28;
  background: rgb(255 255 255 / 97%);
  box-shadow: 0 0.65rem 1.75rem rgb(24 54 45 / 24%);
  text-align: left;
}

.tooltip-content.fixed {
  position: fixed;
  top: auto;
  z-index: 3000;
}

.align-start .tooltip-content {
  left: 0;
}

.align-end .tooltip-content {
  right: 0;
}
</style>
