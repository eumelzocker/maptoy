<script setup lang="ts">
import { type CSSProperties, nextTick, onBeforeUnmount, ref } from "vue";
import type { MenuItem } from "../menuModels.js";
// biome-ignore lint/correctness/noUnusedImports: referenced by the Vue template
import AppMenu from "./AppMenu.vue";

withDefaults(
  defineProps<{
    items: readonly MenuItem[];
    ariaLabel?: string;
  }>(),
  { ariaLabel: "Context menu" },
);

const emit = defineEmits<{
  select: [item: MenuItem];
}>();

const open = ref(false);
const origin = ref({ x: 0, y: 0 });
const overlay = ref<HTMLElement | null>(null);
const menu = ref<{ focusFirst(): void } | null>(null);
const style = ref<CSSProperties>({
  top: "0",
  left: "0",
  visibility: "hidden",
});
const submenuDirection = ref<"start" | "end">("end");

function removeListeners(): void {
  document.removeEventListener("mousedown", onOutsidePointer, true);
  document.removeEventListener("keydown", onDocumentKeydown);
  window.removeEventListener("resize", close);
  window.removeEventListener("scroll", onWindowScroll, true);
}

function close(): void {
  open.value = false;
  removeListeners();
}

function onOutsidePointer(event: MouseEvent): void {
  const target = event.target;
  if (target instanceof Node && !overlay.value?.contains(target)) {
    close();
  }
}

function onDocumentKeydown(event: KeyboardEvent): void {
  if (event.key === "Escape") {
    event.preventDefault();
    close();
  }
}

function onWindowScroll(event: Event): void {
  const target = event.target;
  if (target instanceof Node && overlay.value?.contains(target)) {
    return;
  }
  close();
}

// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
function onWheel(event: WheelEvent): void {
  event.preventDefault();
  event.stopPropagation();
  const target = event.target;
  const targetMenu =
    target instanceof Element
      ? target.closest<HTMLElement>(".app-menu.submenu-leaf")
      : null;
  const leafMenus = overlay.value?.querySelectorAll<HTMLElement>(
    ".app-menu.submenu-leaf",
  );
  const scrollableMenu =
    targetMenu ?? (leafMenus?.length ? leafMenus[leafMenus.length - 1] : null);
  if (scrollableMenu === null || scrollableMenu === undefined) {
    return;
  }
  const multiplier =
    event.deltaMode === WheelEvent.DOM_DELTA_LINE
      ? 16
      : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
        ? scrollableMenu.clientHeight
        : 1;
  scrollableMenu.scrollTop += event.deltaY * multiplier;
}

function position(): void {
  const element = overlay.value;
  if (element === null) {
    return;
  }
  const box = element.getBoundingClientRect();
  const edge = 8;
  const opensLeft = origin.value.x + box.width > window.innerWidth - edge;
  const desiredLeft = opensLeft ? origin.value.x - box.width : origin.value.x;
  const left = Math.max(
    edge,
    Math.min(desiredLeft, window.innerWidth - box.width - edge),
  );
  const top = Math.max(
    edge,
    Math.min(origin.value.y, window.innerHeight - box.height - edge),
  );
  const spaceRight = window.innerWidth - left - box.width - edge;
  const spaceLeft = left - edge;
  submenuDirection.value =
    spaceRight >= box.width || spaceRight >= spaceLeft ? "end" : "start";
  style.value = {
    top: `${top}px`,
    left: `${left}px`,
    visibility: "visible",
  };
}

function openAt(x: number, y: number): void {
  origin.value = { x, y };
  submenuDirection.value = "end";
  style.value = {
    top: `${y}px`,
    left: `${x}px`,
    visibility: "hidden",
  };
  open.value = true;
  document.addEventListener("mousedown", onOutsidePointer, true);
  document.addEventListener("keydown", onDocumentKeydown);
  window.addEventListener("resize", close);
  window.addEventListener("scroll", onWindowScroll, true);
  void nextTick(async () => {
    position();
    await nextTick();
    menu.value?.focusFirst();
  });
}

// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
function selectItem(item: MenuItem): void {
  emit("select", item);
}

onBeforeUnmount(removeListeners);

defineExpose({ openAt, close });
</script>

<template>
  <Teleport v-if="open" to="body">
    <div
      ref="overlay"
      class="app-context-menu"
      :style="style"
      @contextmenu.prevent
      @wheel="onWheel"
    >
      <AppMenu
        ref="menu"
        :items="items"
        :aria-label="ariaLabel"
        :submenu-direction="submenuDirection"
        @select="selectItem"
        @close="close"
      />
    </div>
  </Teleport>
</template>

<style scoped>
.app-context-menu {
  position: fixed;
  z-index: 5000;
}

@media (max-width: 700px) {
  .app-context-menu {
    max-height: calc(100dvh - 1rem);
    overflow-y: auto;
  }
}
</style>
