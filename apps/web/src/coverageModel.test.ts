import type { CoverageResponse } from "@maptoy/contracts";
import { describe, expect, it } from "vitest";
import {
  FRESH_COVERAGE_STEPS,
  constrainedCoverageSourceZoom,
  constrainedCoveragePreviewViewport,
  coverageGridCellTileCapacity,
  coverageGridZoom,
  coverageCellIsColored,
  coverageLayer,
  coveragePreviewZoomRange,
  coverageSelection,
  coverageViewportZoom,
  freshCoverageColor,
  hasCoveragePreviewZoomRange,
  staleCoverageColor,
  visibleCoverageBounds,
} from "./coverageModel.js";

describe("Coverage view model", () => {
  it("maps fresh coverage to five discrete green steps", () => {
    expect(FRESH_COVERAGE_STEPS).toHaveLength(5);
    expect(freshCoverageColor(1, 10_000)).toBe("#b8ddc5");
    expect(freshCoverageColor(1, 4)).toBe("#a8d2b8");
    expect(freshCoverageColor(1, 2)).toBe("#72b58e");
    expect(freshCoverageColor(3, 4)).toBe("#3f936a");
    expect(freshCoverageColor(4, 4)).toBe("#176443");
  });

  it("maps stale shares to their status scale", () => {
    expect(staleCoverageColor(1, 10)).toBe("#e8d09f");
    expect(staleCoverageColor(3, 4)).toBe("#b86f18");
    expect(staleCoverageColor(10, 10)).toBe("#81470d");
  });

  it("keeps grid zoom at least one level below source zoom", () => {
    expect(coveragePreviewZoomRange(8, 4, 0)).toEqual({
      minimum: 3,
      maximum: 7,
    });
    expect(coveragePreviewZoomRange(8, 4, -1)).toEqual({
      minimum: 4,
      maximum: 8,
    });
    expect(coveragePreviewZoomRange(1, 1, 0)).toEqual({
      minimum: 0,
      maximum: 0,
    });
    expect(coverageGridZoom(8, -1)).toBe(7);
    expect(coverageViewportZoom(7, -1)).toBe(8);
  });

  it("calculates the source Tiles represented by one grid cell", () => {
    expect(coverageGridCellTileCapacity(8, 8)).toBe(1);
    expect(coverageGridCellTileCapacity(8, 7)).toBe(4);
    expect(coverageGridCellTileCapacity(8, 4)).toBe(256);
  });

  it("rejects Map Sets with only one configured source zoom", () => {
    expect(hasCoveragePreviewZoomRange(3, 3)).toBe(false);
    expect(hasCoveragePreviewZoomRange(3, 4)).toBe(true);
  });

  it("keeps a view-wide source zoom unless the selected Map Set requires clamping", () => {
    expect(constrainedCoverageSourceZoom(8, 3, 16)).toBe(8);
    expect(constrainedCoverageSourceZoom(2, 3, 16)).toBe(4);
    expect(constrainedCoverageSourceZoom(18, 3, 16)).toBe(16);
  });

  it("normalizes a stored Coverage preview viewport", () => {
    expect(
      constrainedCoveragePreviewViewport(
        {
          center: { longitude: 373, latitude: 90 },
          gridZoom: 12,
        },
        3,
        7,
      ),
    ).toEqual({
      center: { longitude: 13, latitude: 85.05112878 },
      gridZoom: 7,
    });
  });

  it("derives antimeridian-aware bounds through the neutral projection", () => {
    const bounds = visibleCoverageBounds(
      {
        screenToGeographic: ({ x, y }) => ({
          longitude: 170 + x / 5,
          latitude: 60 - y / 10,
        }),
      },
      100,
      100,
    );

    expect(bounds).toEqual({ west: 170, south: 50, east: -170, north: 60 });
  });

  it("normalizes current, Snapshot, and time selections", () => {
    expect(coverageSelection("current", "", "")).toEqual({ kind: "current" });
    expect(coverageSelection("snapshot", "snapshot-id", "")).toEqual({
      kind: "snapshot",
      snapshotId: "snapshot-id",
    });
    expect(coverageSelection("asOf", "", "2026-08-26T10:00:00.000Z")).toEqual({
      kind: "asOf",
      timestamp: "2026-08-26T10:00:00.000Z",
    });
  });

  it("creates a neutral rectangle layer from Coverage status", () => {
    const response = {
      mapSetId: "map-set",
      sourceZoom: 4,
      aggregationZoom: 4,
      bounds: { west: 0, south: 0, east: 1, north: 1 },
      selection: { kind: "current" },
      compareTo: null,
      totals: {
        tileCount: 1,
        revisionCount: 2,
        byteLength: 10,
        statuses: { fresh: 1, stale: 0, missing: 0 },
        comparison: null,
      },
      cells: [
        {
          id: "4/8/7",
          zoom: 4,
          x: 8,
          y: 7,
          bounds: { west: 0, south: 0, east: 1, north: 1 },
          tileCount: 1,
          revisionCount: 2,
          byteLength: 10,
          newestValidatedAt: "2026-08-26T10:00:00.000Z",
          oldestValidatedAt: "2026-08-26T09:00:00.000Z",
          statuses: { fresh: 1, stale: 0, missing: 0 },
          comparison: null,
        },
      ],
    } satisfies CoverageResponse;

    expect(coverageLayer(response)).toMatchObject({
      type: "rectangle-grid",
      data: {
        kind: "rectangle-grid",
        features: [{ id: "4/8/7", fillColor: "#176443" }],
      },
    });
    const firstCell = response.cells[0];
    if (firstCell === undefined) throw new Error("expected a coverage cell");
    expect(coverageCellIsColored(firstCell)).toBe(true);
    expect(coverageLayer(response, { showGrid: false })).toMatchObject({
      data: { features: [{ strokeColor: "transparent" }] },
    });
    const missingResponse = {
      ...response,
      cells: [
        {
          ...firstCell,
          statuses: { fresh: 0, stale: 0, missing: firstCell.tileCount },
        },
      ],
    } satisfies CoverageResponse;
    expect(
      coverageLayer(missingResponse, { showGrid: true, dimmed: false }),
    ).toMatchObject({
      data: { features: [{ fillOpacity: 0 }] },
    });
  });
});
