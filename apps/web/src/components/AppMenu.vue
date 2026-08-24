<script setup lang="ts">
import {
  type CSSProperties,
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
} from "vue";
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
const openSubmenuDirection = ref<"start" | "end">(props.submenuDirection);
const submenuStyle = ref<CSSProperties>();
let scheduledClose: ReturnType<typeof setTimeout> | null = null;
let activePointerType: string | null = null;
// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
const leafSubmenu = computed(
  () => props.nested && !props.items.some((item) => item.children?.length),
);

onMounted(() => {
  if (!props.nested || window.matchMedia("(max-width: 700px)").matches) {
    return;
  }
  void nextTick(() => {
    const box = root.value?.getBoundingClientRect();
    if (box === undefined) {
      return;
    }
    const edge = 8;
    const offset =
      box.bottom > window.innerHeight - edge
        ? window.innerHeight - edge - box.bottom
        : box.top < edge
          ? edge - box.top
          : 0;
    if (offset !== 0) {
      submenuStyle.value = { transform: `translateY(${offset}px)` };
    }
  });
});

onBeforeUnmount(() => {
  if (scheduledClose !== null) {
    clearTimeout(scheduledClose);
  }
});

function cancelScheduledClose(): void {
  if (scheduledClose !== null) {
    clearTimeout(scheduledClose);
    scheduledClose = null;
  }
}

// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
function recordPointerType(event: PointerEvent): void {
  activePointerType = event.pointerType;
}

function resolveSubmenuDirection(itemId: string): void {
  const entry = directButtons().find(
    ({ dataset }) => dataset.menuItemId === itemId,
  )?.parentElement;
  const submenu = entry?.querySelector<HTMLElement>(":scope > .app-menu");
  if (
    entry === undefined ||
    entry === null ||
    submenu === undefined ||
    submenu === null
  ) {
    return;
  }
  const entryBox = entry.getBoundingClientRect();
  const submenuWidth = submenu.getBoundingClientRect().width;
  const edge = 8;
  const spaceRight = window.innerWidth - entryBox.right - edge;
  const spaceLeft = entryBox.left - edge;
  openSubmenuDirection.value =
    spaceRight >= submenuWidth || spaceRight >= spaceLeft ? "end" : "start";
}

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
  cancelScheduledClose();
  const button = directButtons().find(
    ({ dataset }) => dataset.menuItemId === item.id,
  );
  const buttonBox = button?.getBoundingClientRect();
  openSubmenuDirection.value =
    buttonBox !== undefined && window.innerWidth - buttonBox.right >= 224
      ? "end"
      : props.submenuDirection;
  openSubmenuId.value = item.id;
  void nextTick(() => {
    resolveSubmenuDirection(item.id);
    if (focusChild) {
      button?.parentElement
        ?.querySelector<HTMLButtonElement>(
          ":scope > .app-menu > .menu-entry > .menu-item:not(:disabled)",
        )
        ?.focus();
    }
  });
}

function closeSubmenu(itemId: string, restoreFocus = false): void {
  cancelScheduledClose();
  if (openSubmenuId.value !== itemId) {
    return;
  }
  openSubmenuId.value = null;
  if (restoreFocus) {
    void nextTick(() => focusItem(itemId));
  }
}

// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
function scheduleSubmenuClose(itemId: string, event: PointerEvent): void {
  if (event.pointerType === "touch") {
    return;
  }
  cancelScheduledClose();
  scheduledClose = setTimeout(() => {
    scheduledClose = null;
    closeSubmenu(itemId);
  }, 150);
}

// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
function selectItem(item: MenuItem): void {
  emit("select", item);
}

// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
function activate(item: MenuItem, event: MouseEvent): void {
  if (item.disabled) {
    return;
  }
  if (item.children?.length) {
    openSubmenu(item, event.detail === 0);
    return;
  }
  emit("select", item);
  emit("close");
}

// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
function closeAfterFocusLeaves(item: MenuItem, event: FocusEvent): void {
  if (activePointerType === "touch") {
    return;
  }
  const entry = event.currentTarget;
  if (!(entry instanceof HTMLElement)) {
    return;
  }
  void nextTick(() => {
    const activeElement = document.activeElement;
    if (!(activeElement instanceof Node) || !entry.contains(activeElement)) {
      closeSubmenu(item.id);
    }
  });
}

// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
function onItemKeydown(event: KeyboardEvent, item: MenuItem): void {
  activePointerType = null;
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
    :class="[
      `submenu-${submenuDirection}`,
      { submenu: nested, 'submenu-leaf': leafSubmenu },
    ]"
    :style="submenuStyle"
    role="menu"
    :aria-label="ariaLabel"
    @pointerdown.capture="recordPointerType"
  >
    <li
      v-for="item in items"
      :key="item.id"
      class="menu-entry"
      role="none"
      @pointerenter="openSubmenu(item)"
      @pointerleave="scheduleSubmenuClose(item.id, $event)"
      @focusout="closeAfterFocusLeaves(item, $event)"
    >
      <button
        class="menu-item"
        type="button"
        :role="item.checked === undefined ? 'menuitem' : 'menuitemcheckbox'"
        :title="item.title"
        :disabled="item.disabled"
        :data-menu-item-id="item.id"
        :aria-current="item.selected ? 'true' : undefined"
        :aria-checked="item.checked"
        :aria-haspopup="item.children?.length ? 'menu' : undefined"
        :aria-expanded="item.children?.length ? openSubmenuId === item.id : undefined"
        @click="activate(item, $event)"
        @keydown="onItemKeydown($event, item)"
      >
        <span class="item-icon" aria-hidden="true">
          <i v-if="item.icon" class="mdi" :class="item.icon"></i>
          <i v-else-if="item.selected || item.checked" class="mdi mdi-check"></i>
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
        :submenu-direction="openSubmenuDirection"
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

.app-menu.submenu-leaf {
  max-height: min(24rem, calc(100dvh - 1rem));
  overflow-y: auto;
}

.app-menu.submenu-end {
  left: 100%;
}

.app-menu.submenu-start {
  right: 100%;
}

@media (max-width: 700px) {
  .app-menu.submenu {
    position: static;
    min-width: 0;
    margin: 0.15rem 0.25rem 0.35rem 1.15rem;
    border: 0;
    border-left: 0.15rem solid #bfd0c7;
    border-radius: 0;
    box-shadow: none;
    transform: none !important;
  }

  .menu-item {
    min-height: 2.6rem;
  }

  .submenu-indicator {
    transform: rotate(90deg);
  }
}
</style>
