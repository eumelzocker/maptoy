<script setup lang="ts">
import type { MapSetListItem } from "@maptoy/contracts";
import type {
  MapComparisonCount,
  MapComparisonMode,
  MapComparisonPreferences,
} from "../mapComparisonPreferences.js";
// biome-ignore lint/correctness/noUnusedImports: referenced by the Vue template
import MapSetSelect from "./MapSetSelect.vue";

defineProps<{
  value: MapComparisonPreferences;
  mapSets: readonly MapSetListItem[];
  canActivate: boolean;
}>();

const emit = defineEmits<{
  enabled: [value: boolean];
  count: [value: MapComparisonCount];
  mode: [value: MapComparisonMode];
  source: [index: number, mapSetId: string | null];
}>();

// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
function changeEnabled(event: Event): void {
  if (event.currentTarget instanceof HTMLInputElement) {
    emit("enabled", event.currentTarget.checked);
  }
}

// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
function changeCount(event: Event): void {
  if (event.currentTarget instanceof HTMLSelectElement) {
    emit("count", Number(event.currentTarget.value) === 4 ? 4 : 2);
  }
}

// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
function changeMode(event: Event): void {
  if (event.currentTarget instanceof HTMLSelectElement) {
    emit(
      "mode",
      event.currentTarget.value === "synchronized"
        ? "synchronized"
        : "continuous",
    );
  }
}
</script>

<template>
  <section class="comparison-options" aria-label="Map comparison options">
    <label class="comparison-active">
      <input
        type="checkbox"
        :checked="value.enabled"
        :disabled="!canActivate"
        @change="changeEnabled"
      />
      <span>Active</span>
    </label>
    <div class="comparison-settings">
      <label class="field compact-field">
        <span>Maps</span>
        <select :value="value.count" @change="changeCount">
          <option value="2">2 Maps</option>
          <option value="4">4 Maps</option>
        </select>
      </label>
      <label class="field compact-field">
        <span>Mode</span>
        <select :value="value.mode" @change="changeMode">
          <option value="continuous">Continuous area</option>
          <option value="synchronized">Same center and scale</option>
        </select>
      </label>
    </div>
    <div class="comparison-sources">
      <label
        v-for="index in value.count"
        :key="index"
        class="comparison-source"
      >
        <span>Map {{ index }}{{ index === 1 ? " · Primary" : "" }}</span>
        <MapSetSelect
          :model-value="value.sources[index - 1]?.mapSetId ?? null"
          :items="mapSets"
          :aria-label="`Map ${index} Map Set`"
          align="start"
          @update:model-value="emit('source', index - 1, $event)"
        />
      </label>
    </div>
    <small v-if="!canActivate" class="comparison-note unavailable">
      Select an interactive Map Set for every area. The selected maps must share a visual zoom range.
    </small>
  </section>
</template>

<style scoped>
.comparison-options {
  display: grid;
  min-width: min(25rem, calc(100vw - 3rem));
  gap: 0.65rem;
}

.comparison-settings {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  justify-content: space-between;
}

.comparison-active {
  display: flex;
  gap: 0.45rem;
  align-items: center;
  min-height: 2.25rem;
  padding: 0 0.6rem;
  border-radius: 0.4rem;
  color: #173f37;
  background: #eef4f0;
  font-size: 0.85rem;
  font-weight: 650;
}

.comparison-active:has(input:disabled) {
  color: #72807a;
  cursor: not-allowed;
}

.comparison-active input:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.comparison-settings > .field {
  flex: 1 1 0;
}

.compact-field {
  display: grid;
  gap: 0.25rem;
  color: #405e56;
  font-size: 0.75rem;
  font-weight: 700;
}

.compact-field select {
  min-height: 2.25rem;
  padding: 0.35rem 0.45rem;
  border: 1px solid #9eb1a7;
  border-radius: 0.4rem;
  color: #142c28;
  background: #fff;
  font: inherit;
}

.comparison-sources {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.5rem;
}

.comparison-source {
  display: grid;
  min-width: 0;
  gap: 0.25rem;
  color: #405e56;
  font-size: 0.75rem;
  font-weight: 700;
}

.comparison-source :deep(.map-set-select) {
  width: 100%;
}

.comparison-note {
  max-width: 34rem;
  color: #617870;
  line-height: 1.35;
}

.comparison-note.unavailable {
  padding: 0.45rem 0.55rem;
  border-radius: 0.4rem;
  color: #6d5146;
  background: #f8eee9;
}

@media (max-width: 700px) {
  .comparison-sources {
    grid-template-columns: 1fr;
  }
}
</style>
