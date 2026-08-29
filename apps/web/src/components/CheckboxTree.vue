<script setup lang="ts">
// biome-ignore-all lint/correctness/noUnusedImports: Vue template references are not detected by Biome.
// biome-ignore-all lint/correctness/noUnusedVariables: Vue template references are not detected by Biome.
import type { CheckboxTreeNode } from "../checkboxTree.js";

defineOptions({ name: "CheckboxTree" });

const props = withDefaults(
  defineProps<{
    nodes: readonly CheckboxTreeNode[];
    selectedId?: string | null;
    expandedIds?: readonly string[];
    forceExpanded?: boolean;
    disabled?: boolean;
    nested?: boolean;
  }>(),
  {
    selectedId: null,
    expandedIds: () => [],
    forceExpanded: false,
    disabled: false,
    nested: false,
  },
);

const emit = defineEmits<{
  select: [id: string];
  check: [id: string, checked: boolean];
  toggle: [id: string];
}>();

function isExpanded(node: CheckboxTreeNode): boolean {
  return props.forceExpanded || props.expandedIds.includes(node.id);
}

function activate(node: CheckboxTreeNode): void {
  if (node.children?.length) {
    emit("toggle", node.id);
  } else if (node.selectable !== false && !node.disabled) {
    emit("select", node.id);
  }
}

function onLabelKeydown(event: KeyboardEvent, node: CheckboxTreeNode): void {
  if (!node.children?.length) {
    return;
  }
  if (event.key === "ArrowRight" && !isExpanded(node)) {
    event.preventDefault();
    emit("toggle", node.id);
  } else if (event.key === "ArrowLeft" && isExpanded(node)) {
    event.preventDefault();
    emit("toggle", node.id);
  }
}
</script>

<template>
  <ul class="checkbox-tree" :role="nested ? 'group' : 'tree'">
    <li
      v-for="node in nodes"
      :key="node.id"
      class="checkbox-tree-item"
      role="treeitem"
      :aria-expanded="node.children?.length ? isExpanded(node) : undefined"
      :aria-selected="node.selectable !== false ? node.id === selectedId : undefined"
    >
      <div class="checkbox-tree-row" :class="{ selected: node.id === selectedId }">
        <button
          type="button"
          class="tree-expander"
          :class="{ placeholder: !node.children?.length }"
          :aria-label="node.children?.length ? `${isExpanded(node) ? 'Collapse' : 'Expand'} ${node.label}` : undefined"
          :disabled="disabled || !node.children?.length"
          tabindex="-1"
          @click="node.children?.length && emit('toggle', node.id)"
        >
          <i
            v-if="node.children?.length"
            class="mdi"
            :class="isExpanded(node) ? 'mdi-chevron-down' : 'mdi-chevron-right'"
            aria-hidden="true"
          ></i>
        </button>
        <input
          type="checkbox"
          :checked="node.checked"
          :indeterminate="node.indeterminate"
          :disabled="disabled || node.disabled || node.checkDisabled"
          :aria-label="`${node.checked ? 'Hide' : 'Show'} ${node.label}`"
          @change="emit('check', node.id, ($event.target as HTMLInputElement).checked)"
        />
        <button
          type="button"
          class="tree-label"
          :disabled="disabled || node.disabled"
          @click="activate(node)"
          @keydown="onLabelKeydown($event, node)"
        >
          <span>{{ node.label }}</span>
          <small v-if="node.secondaryText">{{ node.secondaryText }}</small>
        </button>
      </div>
      <CheckboxTree
        v-if="node.children?.length && isExpanded(node)"
        :nodes="node.children"
        :selected-id="selectedId"
        :expanded-ids="expandedIds"
        :force-expanded="forceExpanded"
        :disabled="disabled"
        nested
        @select="emit('select', $event)"
        @check="(id, checked) => emit('check', id, checked)"
        @toggle="emit('toggle', $event)"
      />
    </li>
  </ul>
</template>

<style scoped>
.checkbox-tree {
  display: grid;
  gap: 0.12rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.checkbox-tree[role="group"] {
  margin-left: 1.15rem;
}

.checkbox-tree-row {
  display: grid;
  grid-template-columns: 1.35rem 1.25rem minmax(0, 1fr);
  align-items: center;
  min-height: 2rem;
  border-radius: 0.3rem;
}

.checkbox-tree-row:hover,
.checkbox-tree-row:focus-within,
.checkbox-tree-row.selected {
  background: #edf4f1;
}

.checkbox-tree-row.selected {
  box-shadow: inset 0.18rem 0 #286b5d;
}

.tree-expander,
.tree-label {
  min-width: 0;
  padding: 0.2rem;
  border: 0;
  color: inherit;
  background: transparent;
  font: inherit;
}

.tree-expander {
  display: grid;
  place-items: center;
}

.tree-expander.placeholder {
  visibility: hidden;
}

.tree-label {
  display: flex;
  gap: 0.35rem;
  align-items: baseline;
  width: 100%;
  overflow: hidden;
  text-align: left;
  cursor: pointer;
}

.tree-label span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tree-label small {
  margin-left: auto;
  color: #8b3d22;
  font-size: 0.72rem;
}

button:disabled {
  cursor: default;
}
</style>
