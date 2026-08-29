import {
  createDefaultMapSetInput,
  type MapSetListItem,
} from "@maptoy/contracts";
import { createPinia, setActivePinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMapSetsStore } from "./mapSets.js";

const { apiRequestMock } = vi.hoisted(() => ({ apiRequestMock: vi.fn() }));
vi.mock("../api.js", () => ({ apiRequest: apiRequestMock }));

function mapSet(id: string, name: string): MapSetListItem {
  return {
    ...createDefaultMapSetInput(),
    id,
    name,
    createdAt: "2026-08-29T00:00:00.000Z",
    updatedAt: "2026-08-29T00:00:00.000Z",
    logicalTileCount: 0,
  };
}

function throwingLocalStorage(): Storage {
  return {
    length: 0,
    clear: () => undefined,
    key: () => null,
    getItem: () => {
      throw new Error("Storage disabled");
    },
    setItem: () => {
      throw new Error("Storage disabled");
    },
    removeItem: () => {
      throw new Error("Storage disabled");
    },
  } as Storage;
}

describe("map sets store selection persistence", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    apiRequestMock.mockReset();
  });

  afterEach(() => {
    Reflect.deleteProperty(globalThis, "localStorage");
  });

  it("stays usable when no localStorage global is available", () => {
    const store = useMapSetsStore();
    expect(store.selectedId).toBeNull();
    expect(() => store.select("map-set-a")).not.toThrow();
    expect(store.selectedId).toBe("map-set-a");
  });

  it("stays usable when localStorage rejects reads and writes", () => {
    globalThis.localStorage = throwingLocalStorage();
    const store = useMapSetsStore();
    expect(store.selectedId).toBeNull();
    expect(() => store.select("map-set-a")).not.toThrow();
    expect(store.selectedId).toBe("map-set-a");
  });

  it("keeps the active Map Set selected when another one is created", async () => {
    const active = mapSet("00000000-0000-4000-8000-000000000001", "Active");
    const created = mapSet("00000000-0000-4000-8000-000000000002", "Created");
    apiRequestMock
      .mockResolvedValueOnce({ items: [active] })
      .mockResolvedValueOnce(created);
    const store = useMapSetsStore();
    await store.load();

    await store.create(createDefaultMapSetInput());

    expect(store.selectedId).toBe(active.id);
    expect(store.items.map(({ id }) => id)).toContain(created.id);
  });
});
