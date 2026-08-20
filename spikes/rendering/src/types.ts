import type { OverlayOptions } from "sharp";
import type { LonLat, PixelPoint } from "./geo.js";

export interface RenderContext {
  width: number;
  height: number;
  lonLatToPixel: (coordinate: LonLat) => PixelPoint;
}

export interface ServerLayerPlugin<TConfiguration> {
  id: string;
  validate: (input: unknown) => TConfiguration;
  render: (
    context: RenderContext,
    configuration: TConfiguration,
  ) => Promise<OverlayOptions[]>;
}

export interface LayerInstance<TConfiguration = unknown> {
  pluginId: string;
  configuration: TConfiguration;
}
