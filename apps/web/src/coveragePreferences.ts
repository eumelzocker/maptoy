import type { CoverageSelection } from "@maptoy/contracts";
import type { CoveragePreviewViewport } from "./coverageModel.js";
import { getItem, setItem } from "./localStorage.js";

type PreferenceStorage = Pick<Storage, "getItem" | "setItem">;

export interface CoveragePagePreferences {
  selectedMapSetId: string | null;
  previewMapSetId: string | null;
  previewViewport: CoveragePreviewViewport | null;
  sourceZoom: number;
  selectionMode: CoverageSelection["kind"];
  selectionSnapshotId: string;
  selectionTimestamp: string;
  showGrid: boolean;
  showSelection: boolean;
  dimmed: boolean;
}

const storageKey = "maptoy:coverage";

export function resolvedCoverageMapSetIds(
  requestedMapSetId: string | null,
  storedMapSetId: string | null,
  storedPreviewMapSetId: string | null,
  fallbackMapSetId: string | null,
): { mapSetId: string | null; previewMapSetId: string | null } {
  const mapSetId = requestedMapSetId ?? storedMapSetId ?? fallbackMapSetId;
  const routeChangesStoredSelection =
    requestedMapSetId !== null && requestedMapSetId !== storedMapSetId;
  return {
    mapSetId,
    previewMapSetId: routeChangesStoredSelection
      ? requestedMapSetId
      : (storedPreviewMapSetId ?? mapSetId),
  };
}

function isSelectionKind(value: unknown): value is CoverageSelection["kind"] {
  return value === "current" || value === "snapshot" || value === "asOf";
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isPreviewViewport(value: unknown): value is CoveragePreviewViewport {
  if (
    typeof value !== "object" ||
    value === null ||
    !("center" in value) ||
    !("gridZoom" in value) ||
    !isFiniteNumber(value.gridZoom)
  ) {
    return false;
  }
  const center = value.center;
  return (
    typeof center === "object" &&
    center !== null &&
    "longitude" in center &&
    isFiniteNumber(center.longitude) &&
    "latitude" in center &&
    isFiniteNumber(center.latitude)
  );
}

function storedObject(value: string | null): Record<string, unknown> | null {
  if (value === null) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    return typeof parsed === "object" && parsed !== null
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export function loadCoveragePagePreferences(
  fallback: CoveragePagePreferences,
  storage?: PreferenceStorage | null,
): CoveragePagePreferences {
  const stored = storedObject(getItem(storageKey, storage));
  if (stored === null) return { ...fallback };
  const selectedMapSetId =
    stored.selectedMapSetId === null ||
    typeof stored.selectedMapSetId === "string"
      ? stored.selectedMapSetId
      : fallback.selectedMapSetId;
  return {
    selectedMapSetId,
    previewMapSetId:
      stored.previewMapSetId === null ||
      typeof stored.previewMapSetId === "string"
        ? stored.previewMapSetId
        : selectedMapSetId,
    previewViewport: isPreviewViewport(stored.previewViewport)
      ? stored.previewViewport
      : fallback.previewViewport,
    sourceZoom:
      Number.isInteger(stored.sourceZoom) &&
      typeof stored.sourceZoom === "number"
        ? stored.sourceZoom
        : fallback.sourceZoom,
    selectionMode: isSelectionKind(stored.selectionMode)
      ? stored.selectionMode
      : fallback.selectionMode,
    selectionSnapshotId:
      typeof stored.selectionSnapshotId === "string"
        ? stored.selectionSnapshotId
        : fallback.selectionSnapshotId,
    selectionTimestamp:
      typeof stored.selectionTimestamp === "string"
        ? stored.selectionTimestamp
        : fallback.selectionTimestamp,
    showGrid:
      typeof stored.showGrid === "boolean"
        ? stored.showGrid
        : fallback.showGrid,
    showSelection:
      typeof stored.showSelection === "boolean"
        ? stored.showSelection
        : fallback.showSelection,
    dimmed:
      typeof stored.dimmed === "boolean" ? stored.dimmed : fallback.dimmed,
  };
}

export function saveCoveragePagePreferences(
  preferences: CoveragePagePreferences,
  storage?: PreferenceStorage | null,
): void {
  setItem(storageKey, JSON.stringify(preferences), storage);
}
