<script setup lang="ts">
// biome-ignore-all lint/correctness/noUnusedImports: Vue template references are not detected by Biome.
// biome-ignore-all lint/correctness/noUnusedVariables: Vue template references are not detected by Biome.
import type { Job, Layer } from "@maptoy/contracts";
import PhotoLayerEditor from "./PhotoLayerEditor.vue";

defineOptions({ inheritAttrs: false });

defineProps<{
  layer: Layer;
  busy: boolean;
  photoDirectory: { configured: boolean; available: boolean };
  scanDirectory: string;
  recursiveScan: boolean;
  activeScanJob: Job | undefined;
  displayedScanJob: Job | undefined;
  photoCount: number;
  photosLoaded: boolean;
  hasMorePhotos: boolean;
}>();

const emit = defineEmits<{
  configurationChange: [key: string, value: string | number | boolean];
  "update:recursiveScan": [value: boolean];
  browseScanDirectory: [];
  scanJobAction: [action: "pause" | "resume" | "cancel"];
  managePhotos: [];
  fitPhotos: [];
}>();
</script>

<template>
  <PhotoLayerEditor
    :configuration="layer.configuration"
    :busy="busy"
    :photo-directory="photoDirectory"
    :scan-directory="scanDirectory"
    :recursive="recursiveScan"
    :active-job="activeScanJob"
    :displayed-job="displayedScanJob"
    :photo-count="photoCount"
    :photos-loaded="photosLoaded"
    :has-more-photos="hasMorePhotos"
    @configuration-change="(key, value) => emit('configurationChange', key, value)"
    @update:recursive="emit('update:recursiveScan', $event)"
    @browse-directory="emit('browseScanDirectory')"
    @job-action="emit('scanJobAction', $event)"
    @manage-photos="emit('managePhotos')"
    @fit-photos="emit('fitPhotos')"
  />
</template>
