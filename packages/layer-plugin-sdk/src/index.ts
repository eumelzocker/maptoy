export interface LayerPluginCapabilities {
  interactive: boolean;
  import: boolean;
  serverRender: boolean;
}

export interface LayerPluginManifest {
  id: string;
  version: string;
  sdkVersion: string;
  schemaVersion: number;
  capabilities: LayerPluginCapabilities;
}
