import type { MapViewport } from "@maptoy/map-adapter-sdk";
import { describe, expect, it } from "vitest";
import { loadMapViewport, saveMapViewport } from "./mapViewportStorage.js";

function memoryStorage(): Pick<Storage, "getItem" | "setItem"> {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
}

const fallback: MapViewport = {
  center: { longitude: 13.405, latitude: 52.52 },
  zoom: 10,
};

describe("Map viewport storage", () => {
  it("restores one shared viewport across Map Sets", () => {
    const storage = memoryStorage();
    const saved: MapViewport = {
      center: { longitude: 9.4043, latitude: 53.79267 },
      zoom: 12.25,
    };

    saveMapViewport(storage, saved);

    expect(loadMapViewport(storage, fallback, 0, 15)).toEqual(saved);
  });

  it("uses the fallback for malformed stored values", () => {
    const malformed = {
      getItem: () => "not JSON",
      setItem: () => undefined,
    };

    expect(loadMapViewport(malformed, fallback, 0, 15)).toBe(fallback);
  });

  it("clamps the shared zoom to the selected Map Set range", () => {
    const storage = {
      getItem: () =>
        JSON.stringify({
          center: { longitude: 9.4, latitude: 53.8 },
          zoom: 16,
        }),
      setItem: () => undefined,
    };

    expect(loadMapViewport(storage, fallback, 0, 15)).toEqual({
      center: { longitude: 9.4, latitude: 53.8 },
      zoom: 15,
    });
  });

  it("clamps a stored latitude outside the Mercator range instead of falling back", () => {
    const storage = {
      getItem: () =>
        JSON.stringify({
          center: { longitude: 9.4, latitude: 90 },
          zoom: 10,
        }),
      setItem: () => undefined,
    };

    expect(loadMapViewport(storage, fallback, 0, 15)).toEqual({
      center: { longitude: 9.4, latitude: 85.05112878 },
      zoom: 10,
    });
  });

  it("wraps a stored longitude outside -180..180 instead of falling back", () => {
    const storage = {
      getItem: () =>
        JSON.stringify({
          center: { longitude: 190, latitude: 53.8 },
          zoom: 10,
        }),
      setItem: () => undefined,
    };

    expect(loadMapViewport(storage, fallback, 0, 15)).toEqual({
      center: { longitude: -170, latitude: 53.8 },
      zoom: 10,
    });
  });

  it("does not break the map when browser storage rejects writes", () => {
    const storage = {
      getItem: () => null,
      setItem: () => {
        throw new Error("Storage disabled");
      },
    };

    expect(() => saveMapViewport(storage, fallback)).not.toThrow();
  });

  it("uses the fallback when no browser storage is available", () => {
    expect(loadMapViewport(null, fallback, 0, 15)).toBe(fallback);
    expect(() => saveMapViewport(null, fallback)).not.toThrow();
  });
});
