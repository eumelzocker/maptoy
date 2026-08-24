import type { MapViewport } from "@maptoy/map-adapter-sdk";
import { describe, expect, it, vi } from "vitest";
import { applyMapCenter } from "./mapViewportActions.js";

describe("Map viewport actions", () => {
  it("always reapplies an unchanged dialog center after the map has moved", async () => {
    const dialogCenter = { longitude: 13.405, latitude: 52.52 };
    const movedViewport: MapViewport = {
      center: { longitude: 100, latitude: 13 },
      zoom: 11,
    };
    const setViewport = vi.fn();

    await applyMapCenter(
      { getViewport: () => movedViewport, setViewport },
      dialogCenter,
    );

    expect(setViewport).toHaveBeenCalledOnce();
    expect(setViewport).toHaveBeenCalledWith({
      center: dialogCenter,
      zoom: movedViewport.zoom,
    });
  });

  it("does not skip the renderer call when the map is already at the target", async () => {
    const viewport: MapViewport = {
      center: { longitude: 13.405, latitude: 52.52 },
      zoom: 10,
    };
    const setViewport = vi.fn();

    await applyMapCenter(
      { getViewport: () => viewport, setViewport },
      viewport.center,
    );

    expect(setViewport).toHaveBeenCalledOnce();
  });
});
