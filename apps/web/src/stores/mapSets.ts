import type {
  MapSet,
  MapSetInput,
  MapSetListItem,
  MapSetListResponse,
  MapSetPatch,
  MapSetTestResponse,
} from "@maptoy/contracts";
import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { apiRequest } from "../api.js";
import { getItem, removeItem, setItem } from "../localStorage.js";

const selectedMapSetStorageKey = "maptoy:selected-map-set";

export const useMapSetsStore = defineStore("map-sets", () => {
  const items = ref<MapSetListItem[]>([]);
  const loading = ref(false);
  const loaded = ref(false);
  const error = ref<string | null>(null);
  const selectedId = ref<string | null>(getItem(selectedMapSetStorageKey));
  const selected = computed(
    () => items.value.find(({ id }) => id === selectedId.value) ?? null,
  );

  function select(id: string | null): void {
    selectedId.value = id;
    if (id === null) {
      removeItem(selectedMapSetStorageKey);
    } else {
      setItem(selectedMapSetStorageKey, id);
    }
  }

  function replace(mapSet: MapSet): void {
    const index = items.value.findIndex(({ id }) => id === mapSet.id);
    const listItem: MapSetListItem = {
      ...mapSet,
      logicalTileCount:
        index === -1 ? 0 : (items.value[index]?.logicalTileCount ?? 0),
    };
    if (index === -1) {
      items.value.push(listItem);
    } else {
      items.value[index] = listItem;
    }
    items.value.sort((left, right) => left.name.localeCompare(right.name));
  }

  async function load(): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      const response = await apiRequest<MapSetListResponse>("api/map-sets");
      items.value = response.items;
      loaded.value = true;
      if (
        selectedId.value === null ||
        !items.value.some(({ id }) => id === selectedId.value)
      ) {
        select(items.value[0]?.id ?? null);
      }
    } catch (cause) {
      error.value =
        cause instanceof Error
          ? cause.message
          : "Map Sets could not be loaded.";
      throw cause;
    } finally {
      loading.value = false;
    }
  }

  async function create(input: MapSetInput): Promise<MapSet> {
    const mapSet = await apiRequest<MapSet>("api/map-sets", {
      method: "POST",
      body: JSON.stringify(input),
    });
    replace(mapSet);
    select(mapSet.id);
    return mapSet;
  }

  async function update(id: string, patch: MapSetPatch): Promise<MapSet> {
    const mapSet = await apiRequest<MapSet>(`api/map-sets/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
    replace(mapSet);
    return mapSet;
  }

  async function remove(id: string): Promise<void> {
    await apiRequest<void>(`api/map-sets/${id}`, { method: "DELETE" });
    items.value = items.value.filter((item) => item.id !== id);
    if (selectedId.value === id) {
      select(items.value[0]?.id ?? null);
    }
  }

  function test(id: string): Promise<MapSetTestResponse> {
    return apiRequest<MapSetTestResponse>(`api/map-sets/${id}/test`, {
      method: "POST",
    });
  }

  return {
    items,
    loading,
    loaded,
    error,
    selectedId,
    selected,
    select,
    load,
    create,
    update,
    remove,
    test,
  };
});
