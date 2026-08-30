<script setup lang="ts">
// biome-ignore-all lint/correctness/noUnusedImports: Vue template references are not detected by Biome.
// biome-ignore-all lint/correctness/noUnusedVariables: Vue template references are not detected by Biome.
import type { Layer } from "@maptoy/contracts";
import TrackLayerEditor from "./TrackLayerEditor.vue";

defineOptions({ inheritAttrs: false });

const props = defineProps<{ layer: Layer; busy: boolean }>();
const emit = defineEmits<{
  configurationChange: [key: string, value: string | number | boolean];
  uploadTrack: [file: File];
}>();

function hasTrack(): boolean {
  return (
    Array.isArray(props.layer.data.features) &&
    props.layer.data.features.length > 0
  );
}
</script>

<template>
  <TrackLayerEditor
    :configuration="layer.configuration"
    :busy="busy"
    :has-track="hasTrack()"
    @configuration-change="(key, value) => emit('configurationChange', key, value)"
    @upload="emit('uploadTrack', $event)"
  />
</template>
