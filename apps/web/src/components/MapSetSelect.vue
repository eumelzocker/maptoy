<script setup lang="ts">
import type { MapSetListItem } from "@maptoy/contracts";
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import { useAnchoredOverlayPosition } from "../composables/useAnchoredOverlayPosition.js";
import { useDisclosure } from "../composables/useDisclosure.js";
import { createMapSetMenuItems } from "../mapSetMenuItems.js";
import { splitMapSetName } from "../mapSetNameGroups.js";
import type { MenuItem } from "../menuModels.js";
// biome-ignore lint/correctness/noUnusedImports: referenced by the Vue template
import AppMenu from "./AppMenu.vue";

const props = withDefaults(
  defineProps<{
    modelValue: string | null;
    items: readonly MapSetListItem[];
    ariaLabel?: string;
    allLabel?: string;
    disabled?: boolean;
    variant?: "field" | "plain";
    align?: "start" | "end";
  }>(),
  {
    ariaLabel: "Map Set",
    disabled: false,
    variant: "field",
    align: "end",
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

const selected = computed(
  () => props.items.find(({ id }) => id === props.modelValue) ?? null,
);
const hasOptions = computed(
  () => props.items.length > 0 || props.allLabel !== undefined,
);
// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
const selectedName = computed(() =>
  selected.value === null
    ? {
        group: null,
        label:
          props.modelValue === "" && props.allLabel !== undefined
            ? props.allLabel
            : "Select Map Set",
      }
    : splitMapSetName(selected.value.name),
);
// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
const menuItems = computed<MenuItem[]>(() => [
  ...(props.allLabel === undefined
    ? []
    : [
        {
          id: "",
          label: props.allLabel,
          icon: "mdi-view-dashboard-outline",
          selected: props.modelValue === "",
        },
      ]),
  ...createMapSetMenuItems(props.items, props.modelValue),
]);

function positionMenu(): void {
  reposition(props.align);
}

function openMenu(): void {
  if (props.disabled || !hasOptions.value || open.value) {
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
  if (!item.children?.length) {
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

watch(
  () => props.disabled,
  (disabled) => {
    if (disabled) {
      closeMenu();
    }
  },
);

onBeforeUnmount(() => {
  document.removeEventListener("mousedown", onOutsidePointer);
  window.removeEventListener("resize", positionMenu);
  window.removeEventListener("scroll", positionMenu, true);
});
</script>

<template>
  <span ref="root" class="map-set-select" :class="[`variant-${variant}`, { open }]">
    <button
      ref="trigger"
      class="select-trigger"
      type="button"
      :disabled="disabled || !hasOptions"
      :aria-label="ariaLabel"
      aria-haspopup="menu"
      :aria-expanded="open"
      :aria-controls="contentId"
      @click="toggleMenu"
      @keydown="onTriggerKeydown"
    >
      <i
        class="mdi select-icon"
        :class="modelValue === '' && allLabel ? 'mdi-view-dashboard-outline' : 'mdi-layers-outline'"
        aria-hidden="true"
      ></i>
      <span class="selected-name" :title="selected?.name">
        <span v-if="selectedName.group" class="selected-group">
          {{ selectedName.group }}<span class="path-separator">/</span>
        </span>
        <span>{{ selectedName.label }}</span>
      </span>
      <i class="mdi mdi-chevron-down chevron" aria-hidden="true"></i>
    </button>
  </span>

  <Teleport v-if="open" to="body">
    <div :id="contentId" ref="content" class="map-set-menu-overlay" :style="style">
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
.map-set-select {
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
  padding: 0.45rem 0.6rem;
  border: 1px solid #9eb1a7;
  border-radius: 0.45rem;
  color: #142c28;
  background: #fff;
  font: inherit;
  font-weight: 700;
  text-align: left;
  cursor: pointer;
}

.variant-plain .select-trigger {
  border-color: transparent;
  background: transparent;
}

.select-trigger:hover,
.select-trigger:focus-visible,
.open .select-trigger {
  outline: 0;
  background: #e3ede7;
}

.select-trigger:focus-visible {
  outline: 2px solid #a34521;
  outline-offset: 1px;
}

.select-trigger:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.select-icon {
  color: #a34521;
  font-size: 1.1rem;
}

.selected-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.selected-group {
  color: #577068;
  font-weight: 650;
}

.path-separator {
  padding-inline: 0.12rem;
  color: #93a59d;
}

.chevron {
  color: #617870;
  transition: transform 120ms ease;
}

.open .chevron {
  transform: rotate(180deg);
}
</style>

<style>
.map-set-menu-overlay {
  position: fixed;
  z-index: 4000;
}
</style>
