<script setup lang="ts">
import { computed } from "vue";
import { formatLatitude, formatLongitude } from "../coordinateFormat.js";

const props = defineProps<{
  axis: "latitude" | "longitude";
  value: number | string;
}>();

// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
const formattedValue = computed(() => {
  const value =
    typeof props.value === "number"
      ? props.value
      : props.value.trim() === ""
        ? Number.NaN
        : Number(props.value);
  return props.axis === "latitude"
    ? formatLatitude(value, "dms")
    : formatLongitude(value, "dms");
});
</script>

<template>
  <span class="coordinate-dms-readout">{{ formattedValue }}</span>
</template>

<style scoped>
.coordinate-dms-readout {
  color: #597068;
  font-size: 0.72rem;
  font-weight: 400;
}
</style>
