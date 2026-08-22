import type { MapViewport } from "@maptoy/map-adapter-sdk";

const storageKey = "maptoy:viewport";
const maximumMercatorLatitude = 85.05112878;

type ViewportStorage = Pick<Storage, "getItem" | "setItem">;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isStoredViewport(value: unknown): value is MapViewport {
  if (typeof value !== "object" || value === null || !("center" in value)) {
    return false;
  }
  const center = value.center;
  return (
    typeof center === "object" &&
    center !== null &&
    "longitude" in center &&
    isFiniteNumber(center.longitude) &&
    center.longitude >= -180 &&
    center.longitude <= 180 &&
    "latitude" in center &&
    isFiniteNumber(center.latitude) &&
    center.latitude >= -maximumMercatorLatitude &&
    center.latitude <= maximumMercatorLatitude &&
    "zoom" in value &&
    isFiniteNumber(value.zoom)
  );
}

export function loadMapViewport(
  storage: ViewportStorage,
  fallback: MapViewport,
  minimumZoom: number,
  maximumZoom: number,
): MapViewport {
  try {
    const stored = storage.getItem(storageKey);
    if (stored === null) {
      return fallback;
    }
    const candidate: unknown = JSON.parse(stored);
    if (!isStoredViewport(candidate)) {
      return fallback;
    }
    return {
      center: candidate.center,
      zoom: Math.min(maximumZoom, Math.max(minimumZoom, candidate.zoom)),
    };
  } catch {
    return fallback;
  }
}

export function saveMapViewport(
  storage: ViewportStorage,
  viewport: MapViewport,
): void {
  try {
    storage.setItem(storageKey, JSON.stringify(viewport));
  } catch {
    // Browsing modes or storage quotas may reject writes; the map remains usable.
  }
}
