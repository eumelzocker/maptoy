<script setup lang="ts">
import { computed, nextTick, ref } from "vue";
import { useAnchoredOverlayPosition } from "../composables/useAnchoredOverlayPosition.js";
import { useDisclosure } from "../composables/useDisclosure.js";

const props = withDefaults(
  defineProps<{
    label: string;
    align?: "start" | "end";
    fixed?: boolean;
    unstyledTrigger?: boolean;
  }>(),
  { align: "start", fixed: false, unstyledTrigger: false },
);

const {
  // biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
  contentId,
  open: pinned,
  toggle: togglePinState,
  close: closePinned,
} = useDisclosure();
const {
  root,
  content: fixedContent,
  // biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
  style: fixedStyle,
  reposition,
} = useAnchoredOverlayPosition();
const hoverOpen = ref(false);
// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
const open = computed(() => hoverOpen.value || pinned.value);

// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
function openTooltip(): void {
  hoverOpen.value = true;
  if (props.fixed) {
    void nextTick(() => reposition(props.align));
  }
}

function closeTooltip(): void {
  hoverOpen.value = false;
}

// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
function togglePin(): void {
  togglePinState();
  if (pinned.value && props.fixed) {
    void nextTick(() => reposition(props.align));
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

// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
function closeAll(): void {
  hoverOpen.value = false;
  closePinned();
}
</script>

<template>
  <span
    ref="root"
    class="html-tooltip"
    :class="[`align-${align}`, { open, pinned }]"
    @mouseenter="openTooltip"
    @mouseleave="closeTooltip"
    @focusin="openTooltip"
    @focusout="closeAfterFocusLeaves"
    @keydown.esc="closeAll"
  >
    <button
      class="tooltip-trigger"
      :class="{ unstyled: unstyledTrigger }"
      type="button"
      :aria-label="label"
      aria-haspopup="dialog"
      :aria-expanded="open"
      :aria-pressed="pinned"
      :aria-controls="contentId"
      @click.stop="togglePin"
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
