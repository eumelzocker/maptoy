<script setup lang="ts">
// biome-ignore-all lint/correctness/noUnusedImports: Vue template references are not detected by Biome.
// biome-ignore-all lint/correctness/noUnusedVariables: Vue template references are not detected by Biome.
import type { Job, Layer } from "@maptoy/contracts";
import ImageLayerEditor from "./ImageLayerEditor.vue";

defineOptions({ inheritAttrs: false });

defineProps<{
  layer: Layer;
  busy: boolean;
  imageRoots: readonly { id: string; available: boolean }[];
  imageRootId: string;
  scanDirectory: string;
  recursiveScan: boolean;
  activeScanJob: Job | undefined;
  displayedScanJob: Job | undefined;
  imageCount: number;
}>();

const emit = defineEmits<{
  configurationChange: [key: string, value: string | number | boolean];
  "update:imageRootId": [value: string];
  "update:scanDirectory": [value: string];
  "update:recursiveScan": [value: boolean];
  startScan: [];
  scanJobAction: [action: "pause" | "resume" | "cancel"];
  manageImages: [];
}>();
</script>

<template>
  <ImageLayerEditor
    :configuration="layer.configuration"
    :busy="busy"
    :image-roots="imageRoots"
    :root-id="imageRootId"
    :scan-directory="scanDirectory"
    :recursive="recursiveScan"
    :active-job="activeScanJob"
    :displayed-job="displayedScanJob"
    :image-count="imageCount"
    @configuration-change="(key, value) => emit('configurationChange', key, value)"
    @update:root-id="emit('update:imageRootId', $event)"
    @update:scan-directory="emit('update:scanDirectory', $event)"
    @update:recursive="emit('update:recursiveScan', $event)"
    @start-scan="emit('startScan')"
    @job-action="emit('scanJobAction', $event)"
    @manage-images="emit('manageImages')"
  />
</template>
