import type { Layer } from "@maptoy/contracts";
import { describe, expect, it } from "vitest";
import {
  buildLayerHierarchyRows,
  layerHierarchyAncestorKeys,
  layerParentPath,
  nextNumberedLayerName,
  visibleLayerHierarchyRows,
} from "./layerHierarchy.js";

function layer(
  id: string,
  pluginId: string,
  name: string,
  displayOrder: number,
): Layer {
  return {
    id,
    pluginId,
    name,
    pluginVersion: "1.0.0",
    schemaVersion: 1,
    configuration: {},
    data: {},
    visible: true,
    displayOrder,
    opacity: 1,
    minimumZoom: null,
    maximumZoom: null,
    status: "ready",
    diagnostic: null,
    createdAt: "2026-08-28T00:00:00.000Z",
    updatedAt: "2026-08-28T00:00:00.000Z",
  };
}

describe("Layer hierarchy", () => {
  const categories = [
    { id: "tracks", label: "Tracks", pluginIds: ["track-layer"] },
    { id: "images", label: "Images", pluginIds: ["image-layer"] },
  ];

  it("groups by plugin category and slash-separated name segments", () => {
    const rows = buildLayerHierarchyRows(
      [
        layer("berlin", "track-layer", "Trips/2026/Berlin", 1),
        layer("alps", "track-layer", "Trips/2026/Alps", 0),
        layer("photo", "image-layer", "Trips/Day 1", 2),
      ],
      categories,
    );

    expect(
      rows.map(({ kind, label, depth }) => ({ kind, label, depth })),
    ).toEqual([
      { kind: "category", label: "Tracks", depth: 0 },
      { kind: "folder", label: "Trips", depth: 1 },
      { kind: "folder", label: "2026", depth: 2 },
      { kind: "layer", label: "Alps", depth: 3 },
      { kind: "layer", label: "Berlin", depth: 3 },
      { kind: "category", label: "Images", depth: 0 },
      { kind: "folder", label: "Trips", depth: 1 },
      { kind: "layer", label: "Day 1", depth: 2 },
    ]);
  });

  it("identifies siblings by their parent path", () => {
    expect(layerParentPath("Trips/2026/Alps")).toBe("Trips/2026");
    expect(layerParentPath("Overview")).toBe("");
  });

  it("provides the next free numbered name within a plugin category", () => {
    expect(
      nextNumberedLayerName(
        [
          layer("first", "track-layer", "Track 1", 0),
          layer("nested", "track-layer", "Trips/Track 2", 1),
          layer("image", "image-layer", "Track 2", 2),
        ],
        ["track-layer"],
        "Track",
      ),
    ).toBe("Track 2");
  });

  it("collapses categories and nested folders across the complete hierarchy", () => {
    const rows = buildLayerHierarchyRows(
      [
        layer("alps", "track-layer", "Trips/2026/Alps", 0),
        layer("berlin", "track-layer", "Trips/Berlin", 1),
        layer("photo", "image-layer", "Trips/Day 1", 2),
      ],
      categories,
    );

    expect(
      visibleLayerHierarchyRows(rows, new Set(["folder:tracks:Trips"])).map(
        ({ key }) => key,
      ),
    ).toEqual([
      "category:tracks",
      "folder:tracks:Trips",
      "category:images",
      "folder:images:Trips",
      "layer:photo",
    ]);
    expect(
      visibleLayerHierarchyRows(rows, new Set(["category:tracks"])).map(
        ({ key }) => key,
      ),
    ).toEqual([
      "category:tracks",
      "category:images",
      "folder:images:Trips",
      "layer:photo",
    ]);
    expect(layerHierarchyAncestorKeys("tracks", "Trips/2026/Alps")).toEqual([
      "category:tracks",
      "folder:tracks:Trips",
      "folder:tracks:Trips/2026",
    ]);
  });
});
