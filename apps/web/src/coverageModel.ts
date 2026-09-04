import type {
  CoverageCell,
  CoverageResponse,
  CoverageSelection,
  Job,
} from "@maptoy/contracts";
import { xyzTileBounds } from "@maptoy/map-core";
import type {
  GeographicCoordinate,
  MapLayerDescriptor,
  MapRectangleFeature,
  ScreenPoint,
} from "@maptoy/map-adapter-sdk";

export const COVERAGE_LAYER_ID = "cache-coverage";
export const TILE_DOWNLOAD_LAYER_ID = "tile-download-activity";

export const FRESH_COVERAGE_STEPS = [
  { minimumPercent: 0, color: "#b8ddc5", label: ">0–<25%" },
  { minimumPercent: 25, color: "#a8d2b8", label: "25–<50%" },
  { minimumPercent: 50, color: "#72b58e", label: "50–<75%" },
  { minimumPercent: 75, color: "#3f936a", label: "75–<100%" },
  { minimumPercent: 100, color: "#176443", label: "completely fresh" },
] as const;

export const STALE_COVERAGE_STEPS = [
  { minimumPercent: 0, color: "#e8d09f", label: ">0–<25%" },
  { minimumPercent: 25, color: "#dfb964", label: "25–<50%" },
  { minimumPercent: 50, color: "#d59a2d", label: "50–<75%" },
  { minimumPercent: 75, color: "#b86f18", label: "75–<100%" },
  { minimumPercent: 100, color: "#81470d", label: "completely stale" },
] as const;

export const COVERAGE_STATUS_SCALES = [
  { label: "Fresh", steps: FRESH_COVERAGE_STEPS },
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

export function coveragePreviewGridZoomRange(
  sourceZoom: number,
  minimumSourceZoom: number,
  previewMinimumSourceZoom: number,
  previewMaximumSourceZoom: number,
): { minimum: number; maximum: number } | null {
  const minimum = Math.max(minimumSourceZoom - 1, previewMinimumSourceZoom);
  const maximum = Math.min(sourceZoom - 1, previewMaximumSourceZoom);
  return minimum <= maximum ? { minimum, maximum } : null;
}

export function intersectedCoveragePreviewZoomRange(
  sourceZoom: number,
  minimumSourceZoom: number,
  previewMinimumSourceZoom: number,
  previewMaximumSourceZoom: number,
  zoomOffset: number,
): { minimum: number; maximum: number } | null {
  const range = coveragePreviewGridZoomRange(
    sourceZoom,
    minimumSourceZoom,
    previewMinimumSourceZoom,
    previewMaximumSourceZoom,
  );
  return range === null
    ? null
    : {
        minimum: coverageViewportZoom(range.minimum, zoomOffset),
        maximum: coverageViewportZoom(range.maximum, zoomOffset),
      };
}

export function coverageGridCellTileCapacity(
  sourceZoom: number,
  gridZoom: number,
): number {
  return 4 ** Math.max(0, sourceZoom - gridZoom);
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

export function screenRectangleBounds(
  projection: ScreenProjection,
  start: ScreenPoint,
  end: ScreenPoint,
): CoverageResponse["bounds"] {
  const minimumX = Math.min(start.x, end.x);
  const maximumX = Math.max(start.x, end.x);
  const minimumY = Math.min(start.y, end.y);
  const maximumY = Math.max(start.y, end.y);
  const middleX = (minimumX + maximumX) / 2;
  const middleY = (minimumY + maximumY) / 2;
  const left = projection.screenToGeographic({ x: minimumX, y: middleY });
  const right = projection.screenToGeographic({ x: maximumX, y: middleY });
  const top = projection.screenToGeographic({ x: middleX, y: minimumY });
  const bottom = projection.screenToGeographic({ x: middleX, y: maximumY });
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

export function downloadCoordinatePrecision(maximumZoom: number): number {
  const pixelsAroundWorld = 256 * 2 ** Math.max(0, maximumZoom);
  return Math.min(
    6,
    Math.max(2, Math.ceil(Math.log10(pixelsAroundWorld / 360))),
  );
}

export function roundedDownloadBounds(
  bounds: CoverageResponse["bounds"],
  maximumZoom: number,
): CoverageResponse["bounds"] {
  const precision = downloadCoordinatePrecision(maximumZoom);
  const rounded = {
    west: Number(bounds.west.toFixed(precision)),
    south: Number(bounds.south.toFixed(precision)),
    east: Number(bounds.east.toFixed(precision)),
    north: Number(bounds.north.toFixed(precision)),
  };
  return rounded.west === rounded.east || rounded.south >= rounded.north
    ? bounds
    : rounded;
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
  if (cell.statuses.stale > 0) {
    return {
      fillColor: staleCoverageColor(cell.statuses.stale, cell.tileCount),
      strokeColor: "#765113",
    };
  }
  if (cell.statuses.fresh > 0) {
    return {
      fillColor: freshCoverageColor(cell.statuses.fresh, cell.tileCount),
      strokeColor: "#235c47",
    };
  }
  return { fillColor: "#d9dedb", strokeColor: "#738079" };
}

export function freshCoverageColor(fresh: number, tileCount: number): string {
  return coveragePercentageColor(fresh, tileCount, FRESH_COVERAGE_STEPS);
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
  return `${cell.id} · ${cell.statuses.fresh} fresh · ${cell.statuses.stale} stale · ${cell.statuses.missing} missing`;
}

export function coverageCellIsColored(cell: CoverageCell): boolean {
  return cell.statuses.fresh > 0 || cell.statuses.stale > 0;
}

export function coverageLayer(
  response: CoverageResponse,
  options: { showGrid?: boolean; dimmed?: boolean } = {},
): MapLayerDescriptor {
  const showGrid = options.showGrid ?? true;
  const dimmed = options.dimmed ?? true;
  const features: MapRectangleFeature[] = response.cells.map((cell) => {
    const colors = cellColors(cell);
    return {
      id: cell.id,
      bounds: cell.bounds,
      ...colors,
      strokeColor: showGrid ? colors.strokeColor : "transparent",
      fillOpacity:
        !dimmed && !coverageCellIsColored(cell)
          ? 0
          : cell.statuses.missing === cell.tileCount
            ? 0.58
            : 0.76,
      label: cellLabel(cell),
    };
  });
  return {
    id: COVERAGE_LAYER_ID,
    type: "rectangle-grid",
    visible: true,
    opacity: 1,
    data: { kind: "rectangle-grid", features },
  };
}

export function tileDownloadLayer(
  selection: CoverageResponse["bounds"] | null,
  jobs: readonly Job[],
): MapLayerDescriptor {
  const activeTiles = jobs.flatMap((job) => {
    if (job.type !== "tile-download" || job.status !== "running") return [];
    const { currentZoom, currentX, currentY } = job.summary;
    if (
      currentZoom === undefined ||
      currentX === undefined ||
      currentY === undefined
    ) {
      return [];
    }
    const bounds = xyzTileBounds({
      zoom: currentZoom,
      x: currentX,
      y: currentY,
    });
    return [
      {
        id: job.id,
        coordinate: {
          longitude: (bounds.west + bounds.east) / 2,
          latitude: (bounds.south + bounds.north) / 2,
        },
        title: `Downloading ${currentZoom}/${currentX}/${currentY}`,
        symbolizer: {
          radius: 8,
          fillColor: "#7c3aed",
          strokeColor: "#ffffff",
          strokeWidth: 2,
          fillOpacity: 0.95,
        },
      },
    ];
  });
  return {
    id: TILE_DOWNLOAD_LAYER_ID,
    type: "composite",
    visible: true,
    opacity: 1,
    data: {
      kind: "composite",
      layers: [
        {
          kind: "rectangle-grid",
          features:
            selection === null
              ? []
              : [
                  {
                    id: "download-selection-halo",
                    bounds: selection,
                    fillColor: "transparent",
                    strokeColor: "#ffffff",
                    strokeWidth: 7,
                    fillOpacity: 0,
                  },
                  {
                    id: "download-selection",
                    bounds: selection,
                    fillColor: "#b44cff",
                    strokeColor: "#6d00d9",
                    strokeWidth: 4,
                    fillOpacity: 0.22,
                    label: "Selected Tile Download area",
                  },
                ],
        },
        { kind: "point-collection", features: activeTiles },
      ],
    },
  };
}
