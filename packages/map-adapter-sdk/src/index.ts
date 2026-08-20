export interface MapRendererCapabilities {
  interactive: boolean;
  layerRendering: boolean;
  serverExport: boolean;
  tileArchive: boolean;
}

export interface MapRendererManifest {
  id: string;
  version: string;
  sdkVersion: string;
  capabilities: MapRendererCapabilities;
}
