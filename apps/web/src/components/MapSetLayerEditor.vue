<script setup lang="ts">
// biome-ignore-all lint/correctness/noUnusedVariables: Vue template references are not detected by Biome.
import { computed } from "vue";
import { useMapSetsStore } from "../stores/mapSets.js";

defineOptions({ inheritAttrs: false });

const props = defineProps<{
  configuration: Readonly<Record<string, unknown>>;
  busy: boolean;
}>();

const emit = defineEmits<{
  configurationChange: [key: string, value: string | number | boolean];
}>();

const mapSets = useMapSetsStore();
const mapSetId = computed(() =>
  typeof props.configuration.mapSetId === "string"
    ? props.configuration.mapSetId
    : "",
);
const selectedMapSet = computed(
  () => mapSets.items.find(({ id }) => id === mapSetId.value) ?? null,
);
</script>

<template>
  <fieldset class="map-set-layer-editor">
    <legend>Map Set source</legend>
    <label>
      <span>Map Set</span>
      <select
        :value="mapSetId"
        :disabled="busy"
        @change="emit('configurationChange', 'mapSetId', ($event.target as HTMLSelectElement).value)"
      >
        <option
          v-if="mapSetId !== '' && selectedMapSet === null"
          :value="mapSetId"
          disabled
        >
          Unavailable Map Set
        </option>
        <option v-for="mapSet in mapSets.items" :key="mapSet.id" :value="mapSet.id">
          {{ mapSet.name }}
        </option>
      </select>
    </label>

    <label class="provider-access">
      <input
        type="checkbox"
        :checked="configuration.allowProviderRequests === true"
        :disabled="busy"
        @change="emit('configurationChange', 'allowProviderRequests', ($event.target as HTMLInputElement).checked)"
      />
      <span>Load missing Tiles from provider</span>
    </label>
    <small>Off uses only archived Tiles; missing Tiles remain transparent.</small>

    <dl v-if="selectedMapSet" class="source-details">
      <div>
        <dt>Format</dt>
        <dd>{{ selectedMapSet.tileFormat.toUpperCase() }} · {{ selectedMapSet.tileSize }} px</dd>
      </div>
      <div>
        <dt>Attribution</dt>
        <dd v-html="selectedMapSet.attribution"></dd>
      </div>
    </dl>
    <p v-else class="missing-source">The referenced Map Set is unavailable.</p>
  </fieldset>
</template>

<style scoped>
.map-set-layer-editor {
  display: grid;
  gap: 0.55rem;
  min-width: 0;
  margin: 0;
  padding: 0.65rem;
  border: 1px solid #d2ded9;
  border-radius: 0.4rem;
}

.map-set-layer-editor > label:not(.provider-access) {
  display: grid;
  gap: 0.25rem;
}

.map-set-layer-editor select {
  min-width: 0;
  width: 100%;
  padding: 0.4rem 0.5rem;
  border: 1px solid #b8c8c1;
  border-radius: 0.3rem;
  background: #ffffff;
  font: inherit;
}

.provider-access {
  display: flex;
  gap: 0.4rem;
  align-items: center;
}

.map-set-layer-editor > small,
.source-details dt {
  color: #617870;
  font-size: 0.78rem;
}

.source-details {
  display: grid;
  gap: 0.45rem;
  margin: 0.15rem 0 0;
}

.source-details div {
  display: grid;
  gap: 0.1rem;
}

.source-details dd {
  min-width: 0;
  margin: 0;
  overflow-wrap: anywhere;
}

.missing-source {
  margin: 0;
  color: #8b3d22;
  font-size: 0.78rem;
}
</style>
