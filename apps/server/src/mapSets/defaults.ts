import type { MapSetInput } from "@maptoy/contracts";

export function createDefaultOpenTopoMapInput(): MapSetInput {
  return {
    name: "OpenTopoMap",
    sourceType: "xyz-raster",
    urlTemplate: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    attribution:
      '© <a href="http://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>) | Map data © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors.',
    termsUrl: "https://opentopomap.org/about",
    notes: "",
    termsReviewedAt: "2026-08-23",
    minZoom: 0,
    maxZoom: 17,
    tileSize: 256,
    tileFormat: "png",
    subdomains: ["a", "b", "c"],
    headers: {},
    sourceProjection: "EPSG:3857",
    defaultCenter: { longitude: 10, latitude: 53.55 },
    defaultZoom: 11,
    rendererId: "leaflet-xyz",
    capabilities: {
      interactive: true,
      tileArchive: true,
      batchDownload: true,
      serverExport: true,
      layerRendering: true,
    },
    cachePolicy: {
      enabled: true,
      maximumAgeSeconds: 2_592_000,
      maximumStorageBytes: null,
    },
    downloadPolicy: {
      requestsPerSecond: 5,
      concurrency: 2,
      retryLimit: 3,
      dailyRequestLimit: null,
    },
  };
}
