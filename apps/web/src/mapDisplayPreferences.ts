import {
  type CoordinateFormat,
  isCoordinateFormat,
} from "./coordinateFormat.js";
import { getItem, setItem } from "./localStorage.js";

type PreferenceStorage = Pick<Storage, "getItem" | "setItem">;

const showCoordinatesKey = "maptoy:show-coordinates";
const showAttributionKey = "maptoy:show-attribution";
const showTitleBarKey = "maptoy:show-title-bar";
const showMapSelectorKey = "maptoy:show-map-selector";
const cachedTilesOnlyKey = "maptoy:cached-tiles-only";
const showTileGridKey = "maptoy:show-tile-grid";
const coordinateFormatKey = "maptoy:coordinate-format";

function loadBooleanPreference(
  key: string,
  fallback: boolean,
  storage?: PreferenceStorage | null,
): boolean {
  const stored = getItem(key, storage);
  return stored === "true" ? true : stored === "false" ? false : fallback;
}

function saveBooleanPreference(
  key: string,
  value: boolean,
  storage?: PreferenceStorage | null,
): void {
  setItem(key, value ? "true" : "false", storage);
}

export function loadShowCoordinates(
  storage?: PreferenceStorage | null,
): boolean {
  return loadBooleanPreference(showCoordinatesKey, true, storage);
}

export function saveShowCoordinates(
  value: boolean,
  storage?: PreferenceStorage | null,
): void {
  saveBooleanPreference(showCoordinatesKey, value, storage);
}

export function loadShowAttribution(
  storage?: PreferenceStorage | null,
): boolean {
  return loadBooleanPreference(showAttributionKey, true, storage);
}

export function saveShowAttribution(
  value: boolean,
  storage?: PreferenceStorage | null,
): void {
  saveBooleanPreference(showAttributionKey, value, storage);
}

export function loadShowTitleBar(storage?: PreferenceStorage | null): boolean {
  return loadBooleanPreference(showTitleBarKey, true, storage);
}

export function saveShowTitleBar(
  value: boolean,
  storage?: PreferenceStorage | null,
): void {
  saveBooleanPreference(showTitleBarKey, value, storage);
}

export function loadShowMapSelector(
  storage?: PreferenceStorage | null,
): boolean {
  return loadBooleanPreference(showMapSelectorKey, true, storage);
}

export function saveShowMapSelector(
  value: boolean,
  storage?: PreferenceStorage | null,
): void {
  saveBooleanPreference(showMapSelectorKey, value, storage);
}

export function loadCoordinateFormat(
  storage?: PreferenceStorage | null,
): CoordinateFormat {
  const stored = getItem(coordinateFormatKey, storage);
  return isCoordinateFormat(stored) ? stored : "dd";
}

export function saveCoordinateFormat(
  value: CoordinateFormat,
  storage?: PreferenceStorage | null,
): void {
  setItem(coordinateFormatKey, value, storage);
}

export function loadCachedTilesOnly(
  storage?: PreferenceStorage | null,
): boolean {
  return loadBooleanPreference(cachedTilesOnlyKey, false, storage);
}

export function saveCachedTilesOnly(
  value: boolean,
  storage?: PreferenceStorage | null,
): void {
  saveBooleanPreference(cachedTilesOnlyKey, value, storage);
}

export function loadShowTileGrid(storage?: PreferenceStorage | null): boolean {
  return loadBooleanPreference(showTileGridKey, false, storage);
}

export function saveShowTileGrid(
  value: boolean,
  storage?: PreferenceStorage | null,
): void {
  saveBooleanPreference(showTileGridKey, value, storage);
}
