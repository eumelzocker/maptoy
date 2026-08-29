<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import { useAnchoredOverlayPosition } from "../composables/useAnchoredOverlayPosition.js";
import { useDisclosure } from "../composables/useDisclosure.js";
import type { MenuItem } from "../menuModels.js";
// biome-ignore lint/correctness/noUnusedImports: referenced by the Vue template
import AppMenu from "./AppMenu.vue";

const props = withDefaults(
  defineProps<{
    modelValue: string;
    items: readonly MenuItem[];
    ariaLabel?: string;
    placeholder?: string;
    align?: "start" | "end";
    variant?: "field" | "topbar";
  }>(),
  {
    ariaLabel: "Select option",
    placeholder: "Select",
    align: "end",
    variant: "field",
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: string];
}>();

const {
  // biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
  contentId,
  open,
  toggle,
  close,
} = useDisclosure();
const {
  root,
  content,
  // biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
  style,
  reposition,
} = useAnchoredOverlayPosition();
const trigger = ref<HTMLButtonElement | null>(null);
const menu = ref<{ focusFirst(): void } | null>(null);

function selectedMenuItem(
  items: readonly MenuItem[],
  selectedId: string,
): MenuItem | undefined {
  for (const item of items) {
    if (item.id === selectedId) {
      return item;
    }
    const child = selectedMenuItem(item.children ?? [], selectedId);
    if (child !== undefined) {
      return child;
    }
  }
  return undefined;
}

function markSelected(
  items: readonly MenuItem[],
  selectedId: string,
): MenuItem[] {
  return items.map(({ children, ...item }) => ({
    ...item,
    selected: item.id === selectedId,
    ...(children === undefined
      ? {}
      : { children: markSelected(children, selectedId) }),
  }));
}

// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
const selected = computed(() =>
  selectedMenuItem(props.items, props.modelValue),
);
// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
const menuItems = computed(() => markSelected(props.items, props.modelValue));

function positionMenu(): void {
  reposition(props.align);
}

function openMenu(): void {
  if (open.value || props.items.length === 0) {
    return;
  }
  toggle();
  void nextTick(() => {
    positionMenu();
    menu.value?.focusFirst();
  });
}

// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
function toggleMenu(): void {
  if (open.value) {
    close();
  } else {
    openMenu();
  }
}

function closeMenu(restoreFocus = false): void {
  close();
  if (restoreFocus) {
    void nextTick(() => trigger.value?.focus());
  }
}

// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
function selectItem(item: MenuItem): void {
  if (!item.children?.length && !item.disabled) {
    emit("update:modelValue", item.id);
  }
}

// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
function onTriggerKeydown(event: KeyboardEvent): void {
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    openMenu();
  } else if (event.key === "Escape") {
    closeMenu();
  }
}

function onOutsidePointer(event: MouseEvent): void {
  const target = event.target;
  if (
    target instanceof Node &&
    !root.value?.contains(target) &&
    !content.value?.contains(target)
  ) {
    closeMenu();
  }
}

watch(open, (isOpen) => {
  if (isOpen) {
    document.addEventListener("mousedown", onOutsidePointer);
    window.addEventListener("resize", positionMenu);
    window.addEventListener("scroll", positionMenu, true);
  } else {
    document.removeEventListener("mousedown", onOutsidePointer);
    window.removeEventListener("resize", positionMenu);
    window.removeEventListener("scroll", positionMenu, true);
  }
});

onBeforeUnmount(() => {
  document.removeEventListener("mousedown", onOutsidePointer);
  window.removeEventListener("resize", positionMenu);
  window.removeEventListener("scroll", positionMenu, true);
});
</script>

<template>
  <span ref="root" class="app-menu-select" :class="[`variant-${variant}`, { open }]">
    <button
      ref="trigger"
      class="select-trigger"
      type="button"
      :disabled="items.length === 0"
      :aria-label="ariaLabel"
      aria-haspopup="menu"
      :aria-expanded="open"
      :aria-controls="contentId"
      @click="toggleMenu"
      @keydown="onTriggerKeydown"
    >
      <i
        v-if="selected?.icon"
        class="mdi select-icon"
        :class="selected.icon"
        aria-hidden="true"
      ></i>
      <span class="selected-label">{{ selected?.label ?? placeholder }}</span>
      <i class="mdi mdi-chevron-down chevron" aria-hidden="true"></i>
    </button>
  </span>

  <Teleport v-if="open" to="body">
    <div :id="contentId" ref="content" class="app-menu-select-overlay" :style="style">
      <AppMenu
        ref="menu"
        :items="menuItems"
        :aria-label="ariaLabel"
        :submenu-direction="align === 'end' ? 'start' : 'end'"
        @select="selectItem"
        @close="closeMenu(true)"
      />
    </div>
  </Teleport>
</template>

<style scoped>
.app-menu-select {
  display: inline-flex;
  min-width: 0;
}

.select-trigger {
  display: grid;
  grid-template-columns: 1.2rem minmax(0, 1fr) 1rem;
  gap: 0.45rem;
  align-items: center;
  width: 100%;
  min-height: 2.4rem;
  padding: 0.45rem 0.65rem;
  border: 1px solid #9eb1a7;
  border-radius: 0.45rem;
  color: #142c28;
  background: #fff;
  font: inherit;
  font-weight: 750;
  text-align: left;
  cursor: pointer;
  transition:
    color 0.15s ease,
    background 0.15s ease,
    border-color 0.15s ease;
}

.select-trigger:hover,
.open .select-trigger {
  background: #e3ede7;
}

.select-trigger:focus-visible {
  outline: 2px solid #a34521;
  outline-offset: 2px;
}

.variant-topbar .select-trigger {
  min-width: min(12rem, 55vw);
  border-color: #9fd8c2;
  color: #163832;
  background: #9fd8c2;
}

.variant-topbar .select-trigger:hover,
.variant-topbar.open .select-trigger {
  border-color: #d8f3e7;
  background: #c1ead9;
}

.variant-topbar .select-trigger:focus-visible {
  outline-color: #f2c96e;
}

.select-trigger:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.select-icon,
.chevron {
  display: grid;
  place-items: center;
}

.selected-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chevron {
  transition: transform 120ms ease;
}

.open .chevron {
  transform: rotate(180deg);
}
</style>

<style>
.app-menu-select-overlay {
  position: fixed;
  z-index: 4000;
}
</style>
