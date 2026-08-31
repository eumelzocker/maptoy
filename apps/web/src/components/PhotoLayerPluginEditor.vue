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
}>();

const emit = defineEmits<{
  configurationChange: [key: string, value: string | number | boolean];
  "update:scanDirectory": [value: string];
  "update:recursiveScan": [value: boolean];
  startScan: [];
  scanJobAction: [action: "pause" | "resume" | "cancel"];
  managePhotos: [];
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
    @configuration-change="(key, value) => emit('configurationChange', key, value)"
    @update:scan-directory="emit('update:scanDirectory', $event)"
    @update:recursive="emit('update:recursiveScan', $event)"
    @start-scan="emit('startScan')"
    @job-action="emit('scanJobAction', $event)"
    @manage-photos="emit('managePhotos')"
  />
</template>
