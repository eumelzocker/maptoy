<script setup lang="ts">
// biome-ignore-all lint/correctness/noUnusedImports: Vue template references are not detected by Biome.
// biome-ignore-all lint/correctness/noUnusedVariables: Vue template references are not detected by Biome.
import { computed, nextTick, onBeforeUnmount, ref, useId, watch } from "vue";
import {
  type CheckboxTreeNode,
  checkboxTreeBranchIds,
  filterCheckboxTree,
  findCheckboxTreePath,
} from "../checkboxTree.js";
import CheckboxTree from "./CheckboxTree.vue";

const props = withDefaults(
  defineProps<{
    nodes: readonly CheckboxTreeNode[];
    modelValue?: string | null;
    expandedIds?: readonly string[];
    label?: string;
    placeholder?: string;
    disabled?: boolean;
  }>(),
  {
    modelValue: null,
    expandedIds: () => [],
    label: "Select item",
    placeholder: "Select…",
    disabled: false,
  },
);

const emit = defineEmits<{
  "update:modelValue": [id: string];
  "update:expandedIds": [ids: string[]];
  check: [id: string, checked: boolean];
}>();

const open = ref(false);
const query = ref("");
const root = ref<HTMLElement | null>(null);
const searchInput = ref<HTMLInputElement | null>(null);
const contentId = `tree-select-${useId()}`;
const filteredNodes = computed(() =>
  filterCheckboxTree(props.nodes, query.value),
);
const branchIds = computed(() => checkboxTreeBranchIds(props.nodes));
const selectedPath = computed(() =>
  props.modelValue === null
    ? []
    : findCheckboxTreePath(props.nodes, props.modelValue),
);
const selectedLabel = computed(() =>
  selectedPath.value.length > 0
    ? selectedPath.value.map(({ label }) => label).join(" / ")
    : props.placeholder,
);

function close(): void {
  open.value = false;
}

function toggle(): void {
  if (!props.disabled) {
    open.value = !open.value;
  }
}

function select(id: string): void {
  emit("update:modelValue", id);
  close();
}

function toggleBranch(id: string): void {
  const expanded = new Set(props.expandedIds);
  if (expanded.has(id)) {
    expanded.delete(id);
  } else {
    expanded.add(id);
  }
  emit("update:expandedIds", [...expanded]);
}

function setAllExpanded(expanded: boolean): void {
  emit("update:expandedIds", expanded ? branchIds.value : []);
}

function onOutsideMouseDown(event: MouseEvent): void {
  const target = event.target;
  if (target instanceof Node && !root.value?.contains(target)) {
    close();
  }
}

watch(open, async (isOpen) => {
  if (isOpen) {
    document.addEventListener("mousedown", onOutsideMouseDown);
    await nextTick();
    searchInput.value?.focus();
  } else {
    document.removeEventListener("mousedown", onOutsideMouseDown);
    query.value = "";
  }
});

onBeforeUnmount(() => {
  document.removeEventListener("mousedown", onOutsideMouseDown);
});
</script>

<template>
  <div ref="root" class="tree-select-dropdown" @keydown.esc.stop="close">
    <button
      type="button"
      class="tree-select-trigger"
      :disabled="disabled"
      :aria-expanded="open"
      :aria-controls="contentId"
      @click="toggle"
    >
      <span class="trigger-label">{{ label }}</span>
      <span class="trigger-value" :title="selectedLabel">{{ selectedLabel }}</span>
      <i class="mdi mdi-chevron-down" aria-hidden="true"></i>
    </button>
    <div v-if="open" :id="contentId" class="tree-select-popover">
      <div class="tree-search-row">
        <label>
          <span class="visually-hidden">Search {{ label }}</span>
          <i class="mdi mdi-magnify" aria-hidden="true"></i>
          <input ref="searchInput" v-model="query" type="search" placeholder="Search layers…" />
        </label>
        <button type="button" title="Expand all" aria-label="Expand all" @click="setAllExpanded(true)">
          <i class="mdi mdi-unfold-more-horizontal" aria-hidden="true"></i>
        </button>
        <button type="button" title="Collapse all" aria-label="Collapse all" @click="setAllExpanded(false)">
          <i class="mdi mdi-unfold-less-horizontal" aria-hidden="true"></i>
        </button>
      </div>
      <div class="tree-options">
        <CheckboxTree
          v-if="filteredNodes.length > 0"
          :nodes="filteredNodes"
          :selected-id="modelValue"
          :expanded-ids="expandedIds"
          :force-expanded="query.trim() !== ''"
          :disabled="disabled"
          @select="select"
          @check="(id, checked) => emit('check', id, checked)"
          @toggle="toggleBranch"
        />
        <p v-else>No matching layers.</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tree-select-dropdown {
  position: relative;
}

.tree-select-trigger {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 0.5rem;
  align-items: center;
  width: 100%;
  min-height: 2.65rem;
  padding: 0.45rem 0.55rem;
  border: 1px solid #9aada6;
  border-radius: 0.4rem;
  color: #173d35;
  background: #fff;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.trigger-label {
  color: #617870;
  font-size: 0.76rem;
  font-weight: 700;
  text-transform: uppercase;
}

.trigger-value {
  overflow: hidden;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tree-select-popover {
  position: absolute;
  top: calc(100% + 0.3rem);
  right: 0;
  left: 0;
  z-index: 30;
  display: grid;
  gap: 0.45rem;
  min-width: min(23rem, 78vw);
  padding: 0.55rem;
  border: 1px solid #9aada6;
  border-radius: 0.45rem;
  background: #fff;
  box-shadow: 0 0.65rem 1.5rem rgb(24 54 45 / 24%);
}

.tree-search-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  gap: 0.3rem;
}

.tree-search-row label {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 0.35rem;
  align-items: center;
  padding: 0 0.45rem;
  border: 1px solid #c3d1cc;
  border-radius: 0.35rem;
}

.tree-search-row input {
  min-width: 0;
  padding: 0.4rem 0;
  border: 0;
  outline: 0;
  font: inherit;
}

.tree-search-row button {
  display: grid;
  width: 2.15rem;
  padding: 0;
  place-items: center;
  border: 1px solid #c3d1cc;
  border-radius: 0.35rem;
  color: #173d35;
  background: #fff;
}

.tree-options {
  max-height: min(22rem, 48vh);
  overflow: auto;
  overscroll-behavior: contain;
}

.tree-options > p {
  margin: 0;
  padding: 0.6rem;
  color: #617870;
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>
