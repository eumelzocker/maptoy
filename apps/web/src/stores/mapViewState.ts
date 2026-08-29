import { defineStore } from "pinia";
import { ref } from "vue";

export const useMapViewStateStore = defineStore("map-view-state", () => {
  const sourceZoom = ref<number | null>(null);

  function setSourceZoom(value: number | null): void {
    sourceZoom.value = value;
  }

  return { sourceZoom, setSourceZoom };
});
