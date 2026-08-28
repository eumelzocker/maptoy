<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from "vue";
import { useDisclosure } from "../composables/useDisclosure.js";

const props = withDefaults(
  defineProps<{
    label: string;
    align?: "start" | "end";
    suspendOutsideClose?: boolean;
  }>(),
  { align: "start", suspendOutsideClose: false },
);

const {
  // biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
  contentId,
  open,
  // biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
  toggle,
  close,
} = useDisclosure();
const root = ref<HTMLElement | null>(null);

defineExpose({ close });

function onOutsideClick(event: MouseEvent): void {
  if (props.suspendOutsideClose) {
    return;
  }
  const target = event.target;
  if (!(target instanceof Node) || !root.value?.contains(target)) {
    close();
  }
}

watch(open, (isOpen) => {
  if (isOpen) {
    document.addEventListener("mousedown", onOutsideClick);
  } else {
    document.removeEventListener("mousedown", onOutsideClick);
  }
});

onBeforeUnmount(() => {
  document.removeEventListener("mousedown", onOutsideClick);
});
</script>

<template>
  <span
    ref="root"
    class="toggle-panel"
    :class="[`align-${align}`, { open }]"
    @keydown.esc="close"
  >
    <button
      class="toggle-trigger"
      type="button"
      :aria-label="label"
      :title="label"
      :aria-expanded="open"
      :aria-controls="contentId"
      @click="toggle"
    >
      <slot name="trigger"></slot>
    </button>
    <div
      v-if="open"
      :id="contentId"
      class="toggle-content"
      :aria-label="label"
    >
      <slot></slot>
    </div>
  </span>
</template>

<style scoped>
.toggle-panel {
  position: relative;
  display: inline-flex;
}

.toggle-trigger {
  display: grid;
  width: 2.35rem;
  height: 2.35rem;
  padding: 0;
  place-items: center;
  border: 0;
  border-radius: 0.25rem;
  color: #163832;
  background: #fff;
  box-shadow: 0 1px 5px rgb(0 0 0 / 40%);
  font: inherit;
  font-size: 1.25rem;
  cursor: pointer;
}

.toggle-trigger:hover,
.toggle-trigger:focus-visible,
.open .toggle-trigger {
  background: #f4f4f4;
}

.toggle-trigger:focus-visible {
  outline: 2px solid #a34521;
  outline-offset: 1px;
}

.toggle-content {
  position: absolute;
  bottom: calc(100% + 0.55rem);
  z-index: 20;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  width: max-content;
  padding: 0.9rem;
  border: 1px solid rgb(103 125 116 / 45%);
  border-radius: 0.55rem;
  color: #142c28;
  background: rgb(255 255 255 / 97%);
  box-shadow: 0 0.65rem 1.75rem rgb(24 54 45 / 24%);
  text-align: left;
}

.align-start .toggle-content {
  left: 0;
}

.align-end .toggle-content {
  right: 0;
}
</style>
