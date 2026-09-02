import { describe, expect, it } from "vitest";
import {
  defaultMapComparisonPreferences,
  loadMapComparisonPreferences,
  saveMapComparisonPreferences,
} from "./mapComparisonPreferences.js";

function memoryStorage(initial?: string): Pick<Storage, "getItem" | "setItem"> {
  let stored = initial ?? null;
  return {
    getItem: () => stored,
    setItem: (_key, value) => {
      stored = value;
    },
  };
}

describe("Map comparison preferences", () => {
  it("uses a two-way continuous comparison by default", () => {
    expect(loadMapComparisonPreferences(memoryStorage())).toEqual(
      defaultMapComparisonPreferences(),
    );
  });

  it("round-trips duplicate Map Sets and future Tile selections", () => {
    const storage = memoryStorage();
    saveMapComparisonPreferences(
      {
        enabled: true,
        count: 4,
        mode: "synchronized",
        sources: [
          { mapSetId: "same", tileSelection: { kind: "current" } },
          {
            mapSetId: "same",
            tileSelection: { kind: "snapshot", snapshotId: "snapshot-a" },
          },
          {
            mapSetId: "same",
            tileSelection: {
              kind: "asOf",
              timestamp: "2026-09-02T10:00:00.000Z",
            },
          },
          { mapSetId: "other", tileSelection: { kind: "current" } },
        ],
        verticalSplit: 42,
        horizontalSplit: 61,
      },
      storage,
    );

    const loaded = loadMapComparisonPreferences(storage);
    expect(loaded.enabled).toBe(true);
    expect(loaded.count).toBe(4);
    expect(loaded.sources[1]?.tileSelection).toEqual({
      kind: "snapshot",
      snapshotId: "snapshot-a",
    });
    expect(loaded.sources[2]?.tileSelection).toEqual({
      kind: "asOf",
      timestamp: "2026-09-02T10:00:00.000Z",
    });
  });

  it("repairs malformed values and constrains split positions", () => {
    const storage = memoryStorage(
      JSON.stringify({
        enabled: "yes",
        count: 3,
        mode: "unknown",
        sources: [{ mapSetId: 42 }],
        verticalSplit: -20,
        horizontalSplit: 120,
      }),
    );

    const loaded = loadMapComparisonPreferences(storage);
    expect(loaded.enabled).toBe(false);
    expect(loaded.count).toBe(2);
    expect(loaded.mode).toBe("continuous");
    expect(loaded.sources).toHaveLength(4);
    expect(loaded.sources[0]?.mapSetId).toBeNull();
    expect(loaded.verticalSplit).toBe(15);
    expect(loaded.horizontalSplit).toBe(85);
  });
});
