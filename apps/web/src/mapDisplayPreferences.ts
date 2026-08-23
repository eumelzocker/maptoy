import { getItem, setItem } from "./localStorage.js";

type PreferenceStorage = Pick<Storage, "getItem" | "setItem">;

const showCoordinatesKey = "maptoy:show-coordinates";
const showAttributionKey = "maptoy:show-attribution";
const showTitleBarKey = "maptoy:show-title-bar";

function loadBooleanPreference(
  key: string,
  fallback: boolean,
  storage: PreferenceStorage,
): boolean {
  const stored = getItem(key, storage);
  return stored === "true" ? true : stored === "false" ? false : fallback;
}

function saveBooleanPreference(
  key: string,
  value: boolean,
  storage: PreferenceStorage,
): void {
  setItem(key, value ? "true" : "false", storage);
}

export function loadShowCoordinates(storage: PreferenceStorage): boolean {
  return loadBooleanPreference(showCoordinatesKey, true, storage);
}

export function saveShowCoordinates(
  value: boolean,
  storage: PreferenceStorage,
): void {
  saveBooleanPreference(showCoordinatesKey, value, storage);
}

export function loadShowAttribution(storage: PreferenceStorage): boolean {
  return loadBooleanPreference(showAttributionKey, true, storage);
}

export function saveShowAttribution(
  value: boolean,
  storage: PreferenceStorage,
): void {
  saveBooleanPreference(showAttributionKey, value, storage);
}

export function loadShowTitleBar(storage: PreferenceStorage): boolean {
  return loadBooleanPreference(showTitleBarKey, true, storage);
}

export function saveShowTitleBar(
  value: boolean,
  storage: PreferenceStorage,
): void {
  saveBooleanPreference(showTitleBarKey, value, storage);
}
