import type { MapViewport } from "@maptoy/map-adapter-sdk";
import { getItem, setItem } from "./localStorage.js";

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
    "latitude" in center &&
    isFiniteNumber(center.latitude) &&
    "zoom" in value &&
    isFiniteNumber(value.zoom)
  );
}

function wrapLongitude(longitude: number): number {
  if (longitude >= -180 && longitude <= 180) {
    return longitude;
  }
  return ((((longitude + 180) % 360) + 360) % 360) - 180;
}

function clampLatitude(latitude: number): number {
  return Math.min(
    maximumMercatorLatitude,
    Math.max(-maximumMercatorLatitude, latitude),
  );
}

export function loadMapViewport(
  storage: ViewportStorage,
  fallback: MapViewport,
  minimumZoom: number,
  maximumZoom: number,
): MapViewport {
  const stored = getItem(storageKey, storage);
  if (stored === null) {
    return fallback;
  }
  try {
    const candidate: unknown = JSON.parse(stored);
    if (!isStoredViewport(candidate)) {
      return fallback;
    }
    return {
      center: {
        longitude: wrapLongitude(candidate.center.longitude),
        latitude: clampLatitude(candidate.center.latitude),
      },
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
  setItem(storageKey, JSON.stringify(viewport), storage);
}
