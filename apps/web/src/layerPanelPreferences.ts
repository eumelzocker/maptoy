import { getItem, setItem } from "./localStorage.js";

type PreferenceStorage = Pick<Storage, "getItem" | "setItem">;

interface LayerSelectionCandidate {
  id: string;
  visible: boolean;
}

const selectedLayerIdKey = "maptoy:selected-layer";
const legacyExpandedLayerConfigurationsKey =
  "maptoy:expanded-layer-configurations";
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

export function loadSelectedLayerId(
  storage?: PreferenceStorage | null,
): string | null {
  const selected = getItem(selectedLayerIdKey, storage);
  if (selected !== null) {
    return selected === "" ? null : selected;
  }
  return (
    loadStringArray(legacyExpandedLayerConfigurationsKey, storage)[0] ?? null
  );
}

export function saveSelectedLayerId(
  layerId: string | null,
  storage?: PreferenceStorage | null,
): void {
  setItem(selectedLayerIdKey, layerId ?? "", storage);
}

export function resolveSelectedLayerId(
  layers: readonly LayerSelectionCandidate[],
  preferredLayerId: string | null | undefined,
): string | null {
  if (
    preferredLayerId !== null &&
    preferredLayerId !== undefined &&
    layers.some(({ id }) => id === preferredLayerId)
  ) {
    return preferredLayerId;
  }
  return layers.find(({ visible }) => visible)?.id ?? null;
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
