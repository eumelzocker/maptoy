<script setup lang="ts">
import { nextTick, ref } from "vue";
import type { MenuItem } from "../menuModels.js";

const props = withDefaults(
  defineProps<{
    items: readonly MenuItem[];
    ariaLabel?: string;
    nested?: boolean;
    submenuDirection?: "start" | "end";
  }>(),
  {
    ariaLabel: "Menu",
    nested: false,
    submenuDirection: "end",
  },
);

const emit = defineEmits<{
  select: [item: MenuItem];
  close: [];
  back: [];
}>();

const root = ref<HTMLElement | null>(null);
const openSubmenuId = ref<string | null>(null);

function directButtons(): HTMLButtonElement[] {
  if (root.value === null) {
    return [];
  }
  return Array.from(
    root.value.querySelectorAll<HTMLButtonElement>(
      ":scope > .menu-entry > .menu-item:not(:disabled)",
    ),
  );
}

function focusFirst(): void {
  directButtons()[0]?.focus();
}

function focusRelative(current: HTMLButtonElement, offset: number): void {
  const buttons = directButtons();
  const currentIndex = buttons.indexOf(current);
  if (buttons.length === 0 || currentIndex === -1) {
    return;
  }
  buttons[(currentIndex + offset + buttons.length) % buttons.length]?.focus();
}

function focusEdge(edge: "first" | "last"): void {
  const buttons = directButtons();
  buttons[edge === "first" ? 0 : buttons.length - 1]?.focus();
}

function focusItem(itemId: string): void {
  directButtons()
    .find(({ dataset }) => dataset.menuItemId === itemId)
    ?.focus();
}

function openSubmenu(item: MenuItem, focusChild = false): void {
  if (!item.children?.length || item.disabled) {
    return;
  }
  openSubmenuId.value = item.id;
  if (focusChild) {
    void nextTick(() => {
      const button = directButtons().find(
        ({ dataset }) => dataset.menuItemId === item.id,
      );
      button?.parentElement
        ?.querySelector<HTMLButtonElement>(
          ".app-menu .menu-item:not(:disabled)",
        )
        ?.focus();
    });
  }
}

function closeSubmenu(itemId: string, restoreFocus = false): void {
  if (openSubmenuId.value !== itemId) {
    return;
  }
  openSubmenuId.value = null;
  if (restoreFocus) {
    void nextTick(() => focusItem(itemId));
  }
}

// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
function selectItem(item: MenuItem): void {
  emit("select", item);
}

// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
function activate(item: MenuItem): void {
  if (item.disabled) {
    return;
  }
  if (item.children?.length) {
    openSubmenu(item, true);
    return;
  }
  emit("select", item);
  emit("close");
}

// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
function closeAfterFocusLeaves(item: MenuItem, event: FocusEvent): void {
  const nextTarget = event.relatedTarget;
  const entry = event.currentTarget;
  if (
    entry instanceof HTMLElement &&
    (!(nextTarget instanceof Node) || !entry.contains(nextTarget))
  ) {
    closeSubmenu(item.id);
  }
}

// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
function onItemKeydown(event: KeyboardEvent, item: MenuItem): void {
  const current = event.currentTarget;
  if (!(current instanceof HTMLButtonElement)) {
    return;
  }

  switch (event.key) {
    case "ArrowDown":
      event.preventDefault();
      focusRelative(current, 1);
      break;
    case "ArrowUp":
      event.preventDefault();
      focusRelative(current, -1);
      break;
    case "Home":
      event.preventDefault();
      focusEdge("first");
      break;
    case "End":
      event.preventDefault();
      focusEdge("last");
      break;
    case "ArrowRight":
      if (item.children?.length) {
        event.preventDefault();
        openSubmenu(item, true);
      }
      break;
    case "ArrowLeft":
      if (props.nested) {
        event.preventDefault();
        emit("back");
      }
      break;
    case "Escape":
      event.preventDefault();
      emit("close");
      break;
    case "Tab":
      emit("close");
      break;
  }
}

defineExpose({ focusFirst });
</script>

<template>
  <ul
    ref="root"
    class="app-menu"
    :class="[`submenu-${submenuDirection}`, { submenu: nested }]"
    role="menu"
    :aria-label="ariaLabel"
  >
    <li
      v-for="item in items"
      :key="item.id"
      class="menu-entry"
      role="none"
      @mouseenter="openSubmenu(item)"
      @mouseleave="closeSubmenu(item.id)"
      @focusout="closeAfterFocusLeaves(item, $event)"
    >
      <button
        class="menu-item"
        type="button"
        role="menuitem"
        :title="item.title"
        :disabled="item.disabled"
        :data-menu-item-id="item.id"
        :aria-current="item.selected ? 'true' : undefined"
        :aria-haspopup="item.children?.length ? 'menu' : undefined"
        :aria-expanded="item.children?.length ? openSubmenuId === item.id : undefined"
        @click="activate(item)"
        @keydown="onItemKeydown($event, item)"
      >
        <span class="item-icon" aria-hidden="true">
          <i v-if="item.icon" class="mdi" :class="item.icon"></i>
          <i v-else-if="item.selected" class="mdi mdi-check"></i>
        </span>
        <span class="item-label">{{ item.label }}</span>
        <i
          v-if="item.children?.length"
          class="mdi mdi-chevron-right submenu-indicator"
          aria-hidden="true"
        ></i>
      </button>

      <AppMenu
        v-if="item.children?.length && openSubmenuId === item.id"
        :items="item.children"
        :aria-label="`${item.label} submenu`"
        :submenu-direction="submenuDirection"
        nested
        @select="selectItem"
        @close="emit('close')"
        @back="closeSubmenu(item.id, true)"
      />
    </li>
  </ul>
</template>

<style scoped>
.app-menu {
  display: grid;
  min-width: 14rem;
  max-width: min(22rem, calc(100vw - 1rem));
  margin: 0;
  padding: 0.35rem;
  border: 1px solid rgb(103 125 116 / 55%);
  border-radius: 0.55rem;
  color: #142c28;
  background: rgb(255 255 255 / 98%);
  box-shadow: 0 0.65rem 1.75rem rgb(24 54 45 / 24%);
  list-style: none;
}

.menu-entry {
  position: relative;
}

.menu-item {
  display: grid;
  grid-template-columns: 1.15rem minmax(0, 1fr) 1rem;
  gap: 0.45rem;
  align-items: center;
  width: 100%;
  min-height: 2.35rem;
  padding: 0.45rem 0.55rem;
  border: 0;
  border-radius: 0.35rem;
  color: inherit;
  background: transparent;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.menu-item:hover,
.menu-item:focus-visible,
.menu-item[aria-expanded="true"] {
  outline: 0;
  background: #e3ede7;
}

.menu-item[aria-current="true"] {
  color: #174b3e;
  background: #edf5f0;
  font-weight: 750;
}

.menu-item:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.item-icon,
.submenu-indicator {
  display: grid;
  place-items: center;
  color: #a34521;
}

.item-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.submenu-indicator {
  color: #617870;
}

.app-menu.submenu {
  position: absolute;
  top: -0.35rem;
  z-index: 1;
}

.app-menu.submenu-end {
  left: 100%;
}

.app-menu.submenu-start {
  right: 100%;
}

@media (max-width: 600px) {
  .app-menu.submenu {
    position: static;
    min-width: 0;
    margin: 0.15rem 0.25rem 0.35rem 1.15rem;
    border: 0;
    border-left: 0.15rem solid #bfd0c7;
    border-radius: 0;
    box-shadow: none;
  }

  .menu-item {
    min-height: 2.6rem;
  }

  .submenu-indicator {
    transform: rotate(90deg);
  }
}
</style>
