import { describe, expect, it } from "vitest";
import {
  type CoveragePagePreferences,
  loadCoveragePagePreferences,
  resolvedCoverageMapSetIds,
  saveCoveragePagePreferences,
} from "./coveragePreferences.js";

function memoryStorage(): Pick<Storage, "getItem" | "setItem"> {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
}

const fallback: CoveragePagePreferences = {
  selectedMapSetId: null,
  previewMapSetId: null,
  previewViewport: null,
  sourceZoom: 4,
  selectionMode: "current",
  selectionSnapshotId: "",
  selectionTimestamp: "2026-08-26T12:00",
  showGrid: true,
  showSelection: true,
  dimmed: true,
};

describe("Coverage page preferences", () => {
  it("restores a separate Preview Map Set when reloading the current Coverage URL", () => {
    expect(
      resolvedCoverageMapSetIds("coverage-a", "coverage-a", "preview-b", null),
    ).toEqual({ mapSetId: "coverage-a", previewMapSetId: "preview-b" });
  });

  it("synchronizes the Preview Map Set for a deep link to another Coverage Map Set", () => {
    expect(
      resolvedCoverageMapSetIds("coverage-c", "coverage-a", "preview-b", null),
    ).toEqual({ mapSetId: "coverage-c", previewMapSetId: "coverage-c" });
  });

  it("returns independent defaults when nothing is stored", () => {
    const loaded = loadCoveragePagePreferences(fallback, memoryStorage());
    expect(loaded).toEqual(fallback);
    expect(loaded).not.toBe(fallback);
  });

  it("round-trips one shared set of Coverage view settings", () => {
    const storage = memoryStorage();
    const preferences: CoveragePagePreferences = {
      ...fallback,
      selectedMapSetId: "map-set-a",
      previewMapSetId: "map-set-b",
      previewViewport: {
        center: { longitude: 13.4, latitude: 52.5 },
        gridZoom: 6.25,
      },
      sourceZoom: 8,
      selectionMode: "snapshot",
      selectionSnapshotId: "snapshot-a",
      showGrid: false,
      showSelection: false,
      dimmed: false,
    };
    saveCoveragePagePreferences(preferences, storage);

    expect(loadCoveragePagePreferences(fallback, storage)).toEqual(preferences);
  });

  it("falls back field by field for malformed storage", () => {
    const storage = {
      getItem: () =>
        JSON.stringify({
          sourceZoom: 4.5,
          selectionMode: "invalid",
        }),
      setItem: () => undefined,
    };

    expect(loadCoveragePagePreferences(fallback, storage)).toEqual(fallback);
  });

  it("uses the selected Map Set as Preview for preferences saved before it existed", () => {
    const storage = memoryStorage();
    storage.setItem(
      "maptoy:coverage",
      JSON.stringify({
        selectedMapSetId: "map-set-a",
        sourceZoom: 8,
      }),
    );

    expect(loadCoveragePagePreferences(fallback, storage)).toMatchObject({
      selectedMapSetId: "map-set-a",
      previewMapSetId: "map-set-a",
      sourceZoom: 8,
    });
  });
});
