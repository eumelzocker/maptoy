import { getItem, setItem } from "./localStorage.js";

type PreferenceStorage = Pick<Storage, "getItem" | "setItem">;

const expandedLayerConfigurationsKey = "maptoy:expanded-layer-configurations";
const collapsedLayerHierarchyKey = "maptoy:collapsed-layer-hierarchy";
const legacyCollapsedLayerCategoriesKey = "maptoy:collapsed-layer-categories";

function loadStringArray(
  key: string,
  storage?: PreferenceStorage | null,
): string[] {
  const stored = getItem(key, storage);
  if (stored === null) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return [
      ...new Set(
        parsed.filter((value): value is string => typeof value === "string"),
      ),
    ];
  } catch {
    return [];
  }
}

function saveStringArray(
  key: string,
  values: readonly string[],
  storage?: PreferenceStorage | null,
): void {
  setItem(key, JSON.stringify([...new Set(values)]), storage);
}

export function loadExpandedLayerConfigurations(
  storage?: PreferenceStorage | null,
): string[] {
  return loadStringArray(expandedLayerConfigurationsKey, storage);
}

export function saveExpandedLayerConfigurations(
  layerIds: readonly string[],
  storage?: PreferenceStorage | null,
): void {
  saveStringArray(expandedLayerConfigurationsKey, layerIds, storage);
}

export function loadCollapsedLayerHierarchy(
  storage?: PreferenceStorage | null,
): string[] {
  if (getItem(collapsedLayerHierarchyKey, storage) !== null) {
    return loadStringArray(collapsedLayerHierarchyKey, storage);
  }
  return loadStringArray(legacyCollapsedLayerCategoriesKey, storage).map(
    (categoryId) => `category:${categoryId}`,
  );
}

export function saveCollapsedLayerHierarchy(
  nodeKeys: readonly string[],
  storage?: PreferenceStorage | null,
): void {
  saveStringArray(collapsedLayerHierarchyKey, nodeKeys, storage);
}
