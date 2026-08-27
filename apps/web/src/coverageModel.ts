import type {
  CoverageCell,
  CoverageResponse,
  CoverageSelection,
} from "@maptoy/contracts";
import type {
  GeographicCoordinate,
  MapLayerDescriptor,
  MapRectangleFeature,
  ScreenPoint,
} from "@maptoy/map-adapter-sdk";

export const COVERAGE_LAYER_ID = "cache-coverage";

export const AVAILABLE_COVERAGE_STEPS = [
  { minimumPercent: 0, color: "#d8eadf", label: "0.0001–24.9999% available" },
  { minimumPercent: 25, color: "#a8d2b8", label: "25–49.9999% available" },
  { minimumPercent: 50, color: "#72b58e", label: "50–74.9999% available" },
  { minimumPercent: 75, color: "#3f936a", label: "75–99.9999% available" },
  { minimumPercent: 100, color: "#176443", label: "100% available" },
] as const;

export const STALE_COVERAGE_STEPS = [
  { minimumPercent: 0, color: "#f6e5bd", label: "0.0001–24.9999% stale" },
  { minimumPercent: 25, color: "#efcb7a", label: "25–49.9999% stale" },
  { minimumPercent: 50, color: "#e3ad42", label: "50–74.9999% stale" },
  { minimumPercent: 75, color: "#ca8423", label: "75–99.9999% stale" },
  { minimumPercent: 100, color: "#965511", label: "100% stale" },
] as const;

export const COVERAGE_STATUS_SCALES = [
  { label: "Available", steps: AVAILABLE_COVERAGE_STEPS },
  { label: "Stale", steps: STALE_COVERAGE_STEPS },
] as const;

export interface CoveragePreviewViewport {
  center: GeographicCoordinate;
  gridZoom: number;
}

export function hasCoveragePreviewZoomRange(
  minimumSourceZoom: number,
  maximumSourceZoom: number,
): boolean {
  return minimumSourceZoom < maximumSourceZoom;
}

export function constrainedCoverageSourceZoom(
  sourceZoom: number,
  minimumMapZoom: number,
  maximumMapZoom: number,
): number {
  return Math.min(maximumMapZoom, Math.max(minimumMapZoom + 1, sourceZoom));
}

export function constrainedCoveragePreviewViewport(
  viewport: CoveragePreviewViewport,
  minimumGridZoom: number,
  maximumGridZoom: number,
): CoveragePreviewViewport {
  return {
    center: {
      longitude: normalizedLongitude(viewport.center.longitude),
      latitude: Math.min(
        85.05112878,
        Math.max(-85.05112878, viewport.center.latitude),
      ),
    },
    gridZoom: Math.min(
      maximumGridZoom,
      Math.max(minimumGridZoom, viewport.gridZoom),
    ),
  };
}

export function coverageGridZoom(
  viewportZoom: number,
  zoomOffset: number,
): number {
  return viewportZoom + zoomOffset;
}

export function coverageViewportZoom(
  gridZoom: number,
  zoomOffset: number,
): number {
  return gridZoom - zoomOffset;
}

export function coveragePreviewZoomRange(
  sourceZoom: number,
  minimumSourceZoom: number,
  zoomOffset: number,
): { minimum: number; maximum: number } {
  return {
    minimum: coverageViewportZoom(minimumSourceZoom - 1, zoomOffset),
    maximum: coverageViewportZoom(sourceZoom - 1, zoomOffset),
  };
}

interface ScreenProjection {
  screenToGeographic(point: ScreenPoint): GeographicCoordinate;
}

function normalizedLongitude(longitude: number): number {
  const wrapped = ((((longitude + 180) % 360) + 360) % 360) - 180;
  return wrapped === -180 && longitude > 0 ? 180 : wrapped;
}

export function visibleCoverageBounds(
  projection: ScreenProjection,
  width: number,
  height: number,
): CoverageResponse["bounds"] {
  const left = projection.screenToGeographic({ x: 0, y: height / 2 });
  const right = projection.screenToGeographic({ x: width, y: height / 2 });
  const top = projection.screenToGeographic({ x: width / 2, y: 0 });
  const bottom = projection.screenToGeographic({ x: width / 2, y: height });
  const longitudeSpan = right.longitude - left.longitude;
  const west =
    longitudeSpan >= 359.999 ? -180 : normalizedLongitude(left.longitude);
  const east =
    longitudeSpan >= 359.999 ? 180 : normalizedLongitude(right.longitude);
  const south = Math.max(-85.05112878, Math.min(85.05112878, bottom.latitude));
  const north = Math.max(-85.05112878, Math.min(85.05112878, top.latitude));
  return {
    west,
    south: Math.min(south, north - 1e-9),
    east: west === east ? Math.min(180, east + 1e-9) : east,
    north,
  };
}

export function coverageSelection(
  mode: CoverageSelection["kind"],
  snapshotId: string,
  timestamp: string,
): CoverageSelection {
  if (mode === "current") {
    return { kind: "current" };
  }
  if (mode === "snapshot") {
    if (snapshotId === "") {
      throw new Error("Select a Cache Snapshot.");
    }
    return { kind: "snapshot", snapshotId };
  }
  const date = new Date(timestamp);
  if (timestamp === "" || Number.isNaN(date.getTime())) {
    throw new Error("Enter a valid point in time.");
  }
  return { kind: "asOf", timestamp: date.toISOString() };
}

function cellColors(cell: CoverageCell): {
  fillColor: string;
  strokeColor: string;
} {
  if (cell.comparison !== null) {
    if (cell.comparison.changed > 0) {
      return { fillColor: "#d8792d", strokeColor: "#7a3414" };
    }
    if (cell.comparison.added > 0) {
      return { fillColor: "#3188a8", strokeColor: "#16506b" };
    }
    if (cell.comparison.missing > 0) {
      return { fillColor: "#c94d46", strokeColor: "#7f2624" };
    }
    if (cell.comparison.identical > 0) {
      return { fillColor: "#4e9b79", strokeColor: "#235c47" };
    }
  }
  if (cell.statuses.stale > 0) {
    return {
      fillColor: staleCoverageColor(cell.statuses.stale, cell.tileCount),
      strokeColor: "#765113",
    };
  }
  if (cell.statuses.available > 0) {
    return {
      fillColor: availableCoverageColor(
        cell.statuses.available,
        cell.tileCount,
      ),
      strokeColor: "#235c47",
    };
  }
  return { fillColor: "#d9dedb", strokeColor: "#738079" };
}

export function availableCoverageColor(
  available: number,
  tileCount: number,
): string {
  return coveragePercentageColor(
    available,
    tileCount,
    AVAILABLE_COVERAGE_STEPS,
  );
}

export function staleCoverageColor(stale: number, tileCount: number): string {
  return coveragePercentageColor(stale, tileCount, STALE_COVERAGE_STEPS);
}

function coveragePercentageColor(
  value: number,
  tileCount: number,
  steps: ReadonlyArray<{ minimumPercent: number; color: string }>,
): string {
  const percent = tileCount > 0 ? (value / tileCount) * 100 : 0;
  for (let index = steps.length - 1; index >= 0; index -= 1) {
    const step = steps[index];
    if (step !== undefined && percent >= step.minimumPercent) {
      return step.color;
    }
  }
  return steps[0]?.color ?? "#d9dedb";
}

function cellLabel(cell: CoverageCell): string {
  const status = `${cell.statuses.available} available · ${cell.statuses.stale} stale · ${cell.statuses.missing} missing`;
  if (cell.comparison === null) {
    return `${cell.id} · ${status}`;
  }
  return `${cell.id} · ${status} · ${cell.comparison.changed} changed · ${cell.comparison.added} added · ${cell.comparison.missing} removed`;
}

export function coverageLayer(response: CoverageResponse): MapLayerDescriptor {
  const features: MapRectangleFeature[] = response.cells.map((cell) => ({
    id: cell.id,
    bounds: cell.bounds,
    ...cellColors(cell),
    fillOpacity: cell.statuses.missing === cell.tileCount ? 0.58 : 0.76,
    label: cellLabel(cell),
  }));
  return {
    id: COVERAGE_LAYER_ID,
    type: "rectangle-grid",
    visible: true,
    opacity: 1,
    data: { kind: "rectangle-grid", features },
  };
}
