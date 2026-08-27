import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";
import {
  CoverageQuerySchema,
  CoverageResponseSchema,
  createDefaultMapSetInput,
  MapSetInputSchema,
  TileRevisionSummarySchema,
  TileUploadResponseSchema,
} from "./index.js";

describe("Map Set contracts", () => {
  it("provides a valid XYZ default", () => {
    expect(Value.Check(MapSetInputSchema, createDefaultMapSetInput())).toBe(
      true,
    );
  });

  it("rejects invalid zoom and coordinate ranges", () => {
    expect(
      Value.Check(MapSetInputSchema, {
        ...createDefaultMapSetInput(),
        defaultCenter: { longitude: 181, latitude: 0 },
      }),
    ).toBe(false);
    expect(
      Value.Check(MapSetInputSchema, {
        ...createDefaultMapSetInput(),
        maxZoom: 25,
      }),
    ).toBe(false);
  });

  it("defines Tile upload and revision-origin contracts", () => {
    expect(
      Value.Check(TileUploadResponseSchema, {
        revisionId: "revision-id",
        created: true,
      }),
    ).toBe(true);
    expect(
      Value.Check(TileRevisionSummarySchema, {
        id: "revision-id",
        zoom: 1,
        x: 1,
        y: 0,
        contentHash: "hash",
        contentType: "image/png",
        byteLength: 10,
        firstSeenAt: "2026-08-24T00:00:00.000Z",
        lastSeenAt: "2026-08-24T00:00:00.000Z",
        lastValidatedAt: "2026-08-24T00:00:00.000Z",
        origin: "upload",
        current: true,
      }),
    ).toBe(true);
    expect(
      Value.Check(TileRevisionSummarySchema, {
        id: "revision-id",
        zoom: 1,
        x: 1,
        y: 0,
        contentHash: "hash",
        contentType: "image/png",
        byteLength: 10,
        firstSeenAt: "2026-08-24T00:00:00.000Z",
        lastSeenAt: "2026-08-24T00:00:00.000Z",
        lastValidatedAt: "2026-08-24T00:00:00.000Z",
        origin: "external",
        current: true,
      }),
    ).toBe(false);
  });

  it("defines bounded, aggregated Coverage contracts with future job state", () => {
    expect(
      Value.Check(CoverageQuerySchema, {
        bounds: { west: 13, south: 52, east: 14, north: 53 },
        zoom: 12,
        selection: { kind: "current" },
        compareTo: {
          kind: "asOf",
          timestamp: "2026-08-26T10:00:00.000Z",
        },
        maximumCells: 256,
      }),
    ).toBe(true);
    expect(
      Value.Check(CoverageResponseSchema, {
        mapSetId: "map-set",
        sourceZoom: 12,
        aggregationZoom: 10,
        bounds: { west: 13, south: 52, east: 14, north: 53 },
        selection: { kind: "current" },
        compareTo: null,
        totals: {
          tileCount: 16,
          revisionCount: 1,
          byteLength: 100,
          statuses: {
            fresh: 1,
            missing: 14,
            stale: 1,
          },
          comparison: null,
        },
        cells: [],
      }),
    ).toBe(true);
  });
});
