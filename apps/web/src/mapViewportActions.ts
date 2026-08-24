import type {
  GeographicCoordinate,
  MapRendererInstance,
} from "@maptoy/map-adapter-sdk";

type ViewportController = Pick<
  MapRendererInstance,
  "getViewport" | "setViewport"
>;

export async function applyMapCenter(
  renderer: ViewportController,
  center: GeographicCoordinate,
): Promise<void> {
  const currentViewport = renderer.getViewport();
  // Apply unconditionally: a non-modal dialog can retain its original values
  // while the map beneath it has since moved elsewhere.
  await renderer.setViewport({
    center: { ...center },
    zoom: currentViewport.zoom,
  });
}
