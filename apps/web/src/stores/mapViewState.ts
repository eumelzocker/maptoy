import { defineStore } from "pinia";
import { ref } from "vue";

export const useMapViewStateStore = defineStore("map-view-state", () => {
  const sourceZoom = ref<number | null>(null);
  const coverageMapSetName = ref<string | null>(null);
  const coverageSourceZoom = ref<number | null>(null);

  function setSourceZoom(value: number | null): void {
    sourceZoom.value = value;
  }

  function setCoverageSourceZoom(value: number | null): void {
    coverageSourceZoom.value = value;
  }

  function setCoverageMapSetName(value: string | null): void {
    coverageMapSetName.value = value;
  }

  return {
    sourceZoom,
    coverageMapSetName,
    coverageSourceZoom,
    setSourceZoom,
    setCoverageMapSetName,
    setCoverageSourceZoom,
  };
});
