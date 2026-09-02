import { getItem, setItem } from "./localStorage.js";

export type MapComparisonCount = 2 | 4;
export type MapComparisonMode = "continuous" | "synchronized";

export type MapComparisonTileSelection =
  | Readonly<{ kind: "current" }>
  | Readonly<{ kind: "snapshot"; snapshotId: string }>
  | Readonly<{ kind: "asOf"; timestamp: string }>;

export interface MapComparisonSource {
  mapSetId: string | null;
  tileSelection: MapComparisonTileSelection;
}

export interface MapComparisonPreferences {
  enabled: boolean;
  count: MapComparisonCount;
  mode: MapComparisonMode;
  sources: readonly MapComparisonSource[];
  verticalSplit: number;
  horizontalSplit: number;
}

type PreferenceStorage = Pick<Storage, "getItem" | "setItem">;

const storageKey = "maptoy:map-comparison";
const defaultSplit = 50;
const minimumSplit = 15;
const maximumSplit = 85;

function currentSource(mapSetId: string | null = null): MapComparisonSource {
  return { mapSetId, tileSelection: { kind: "current" } };
}

export function defaultMapComparisonPreferences(): MapComparisonPreferences {
  return {
    enabled: false,
    count: 2,
    mode: "continuous",
    sources: Array.from({ length: 4 }, () => currentSource()),
    verticalSplit: defaultSplit,
    horizontalSplit: defaultSplit,
  };
}

function finiteSplit(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(maximumSplit, Math.max(minimumSplit, value))
    : defaultSplit;
}

function tileSelection(value: unknown): MapComparisonTileSelection {
  if (typeof value !== "object" || value === null || !("kind" in value)) {
    return { kind: "current" };
  }
  if (
    value.kind === "snapshot" &&
    "snapshotId" in value &&
    typeof value.snapshotId === "string" &&
    value.snapshotId !== ""
  ) {
    return { kind: "snapshot", snapshotId: value.snapshotId };
  }
  if (
    value.kind === "asOf" &&
    "timestamp" in value &&
    typeof value.timestamp === "string" &&
    value.timestamp !== ""
  ) {
    return { kind: "asOf", timestamp: value.timestamp };
  }
  return { kind: "current" };
}

function source(value: unknown): MapComparisonSource {
  if (typeof value !== "object" || value === null) {
    return currentSource();
  }
  return {
    mapSetId:
      "mapSetId" in value && typeof value.mapSetId === "string"
        ? value.mapSetId
        : null,
    tileSelection:
      "tileSelection" in value
        ? tileSelection(value.tileSelection)
        : { kind: "current" },
  };
}

export function loadMapComparisonPreferences(
  storage?: PreferenceStorage | null,
): MapComparisonPreferences {
  const fallback = defaultMapComparisonPreferences();
  const stored = getItem(storageKey, storage);
  if (stored === null) return fallback;
  try {
    const value: unknown = JSON.parse(stored);
    if (typeof value !== "object" || value === null) return fallback;
    const storedSources =
      "sources" in value && Array.isArray(value.sources) ? value.sources : [];
    return {
      enabled:
        "enabled" in value && typeof value.enabled === "boolean"
          ? value.enabled
          : fallback.enabled,
      count: "count" in value && value.count === 4 ? 4 : 2,
      mode:
        "mode" in value && value.mode === "synchronized"
          ? "synchronized"
          : "continuous",
      sources: Array.from({ length: 4 }, (_, index) =>
        source(storedSources[index]),
      ),
      verticalSplit: finiteSplit(
        "verticalSplit" in value ? value.verticalSplit : undefined,
      ),
      horizontalSplit: finiteSplit(
        "horizontalSplit" in value ? value.horizontalSplit : undefined,
      ),
    };
  } catch {
    return fallback;
  }
}

export function saveMapComparisonPreferences(
  value: MapComparisonPreferences,
  storage?: PreferenceStorage | null,
): void {
  setItem(storageKey, JSON.stringify(value), storage);
}
