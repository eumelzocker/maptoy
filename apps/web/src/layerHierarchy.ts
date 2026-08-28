import type { Layer } from "@maptoy/contracts";

export interface LayerCategoryDefinition {
  id: string;
  label: string;
  pluginIds: readonly string[];
}

export type LayerHierarchyRow =
  | {
      kind: "category" | "folder";
      key: string;
      label: string;
      depth: number;
      categoryId: string;
    }
  | {
      kind: "layer";
      key: string;
      label: string;
      depth: number;
      categoryId: string;
      layer: Layer;
    };

interface HierarchyNode {
  folders: Map<string, HierarchyNode>;
  layers: Layer[];
}

function node(): HierarchyNode {
  return { folders: new Map(), layers: [] };
}

export function layerNameSegments(name: string): string[] {
  return name.split("/").map((segment) => segment.trim());
}

export function layerParentPath(name: string): string {
  return layerNameSegments(name).slice(0, -1).join("/");
}

export function nextNumberedLayerName(
  layers: readonly Layer[],
  pluginIds: readonly string[],
  baseName: string,
): string {
  const existingNames = new Set(
    layers
      .filter((layer) => pluginIds.includes(layer.pluginId))
      .map((layer) => layer.name),
  );
  let number = 1;
  while (existingNames.has(`${baseName} ${number}`)) {
    number += 1;
  }
  return `${baseName} ${number}`;
}

export function layerHierarchyAncestorKeys(
  categoryId: string,
  name: string,
): string[] {
  const keys = [`category:${categoryId}`];
  const path: string[] = [];
  for (const segment of layerNameSegments(name).slice(0, -1)) {
    path.push(segment);
    keys.push(`folder:${categoryId}:${path.join("/")}`);
  }
  return keys;
}

export function visibleLayerHierarchyRows(
  rows: readonly LayerHierarchyRow[],
  collapsedKeys: ReadonlySet<string>,
): LayerHierarchyRow[] {
  const visible: LayerHierarchyRow[] = [];
  let hiddenBelowDepth: number | null = null;
  for (const row of rows) {
    if (hiddenBelowDepth !== null) {
      if (row.depth > hiddenBelowDepth) {
        continue;
      }
      hiddenBelowDepth = null;
    }
    visible.push(row);
    if (row.kind !== "layer" && collapsedKeys.has(row.key)) {
      hiddenBelowDepth = row.depth;
    }
  }
  return visible;
}

function appendNodeRows(
  rows: LayerHierarchyRow[],
  categoryId: string,
  current: HierarchyNode,
  path: readonly string[],
  depth: number,
): void {
  const folders = [...current.folders.entries()].sort(([left], [right]) =>
    left.localeCompare(right),
  );
  for (const [label, child] of folders) {
    const childPath = [...path, label];
    rows.push({
      kind: "folder",
      key: `folder:${categoryId}:${childPath.join("/")}`,
      label,
      depth,
      categoryId,
    });
    appendNodeRows(rows, categoryId, child, childPath, depth + 1);
  }
  for (const layer of [...current.layers].sort(
    (left, right) =>
      left.displayOrder - right.displayOrder ||
      left.name.localeCompare(right.name),
  )) {
    rows.push({
      kind: "layer",
      key: `layer:${layer.id}`,
      label: layerNameSegments(layer.name).at(-1) ?? layer.name,
      depth,
      categoryId,
      layer,
    });
  }
}

export function buildLayerHierarchyRows(
  layers: readonly Layer[],
  categories: readonly LayerCategoryDefinition[],
): LayerHierarchyRow[] {
  const categoryByPlugin = new Map(
    categories.flatMap((category) =>
      category.pluginIds.map((pluginId) => [pluginId, category] as const),
    ),
  );
  const roots = new Map<
    string,
    { definition: LayerCategoryDefinition; root: HierarchyNode }
  >();

  for (const layer of layers) {
    const definition = categoryByPlugin.get(layer.pluginId) ?? {
      id: layer.pluginId,
      label: layer.pluginId,
      pluginIds: [layer.pluginId],
    };
    let category = roots.get(definition.id);
    if (category === undefined) {
      category = { definition, root: node() };
      roots.set(definition.id, category);
    }
    const segments = layerNameSegments(layer.name);
    let parent = category.root;
    for (const segment of segments.slice(0, -1)) {
      let folder = parent.folders.get(segment);
      if (folder === undefined) {
        folder = node();
        parent.folders.set(segment, folder);
      }
      parent = folder;
    }
    parent.layers.push(layer);
  }

  const categoryOrder = new Map(
    categories.map((category, index) => [category.id, index]),
  );
  const sortedRoots = [...roots.values()].sort(
    (left, right) =>
      (categoryOrder.get(left.definition.id) ?? Number.MAX_SAFE_INTEGER) -
        (categoryOrder.get(right.definition.id) ?? Number.MAX_SAFE_INTEGER) ||
      left.definition.label.localeCompare(right.definition.label),
  );
  const rows: LayerHierarchyRow[] = [];
  for (const { definition, root } of sortedRoots) {
    rows.push({
      kind: "category",
      key: `category:${definition.id}`,
      label: definition.label,
      depth: 0,
      categoryId: definition.id,
    });
    appendNodeRows(rows, definition.id, root, [], 1);
  }
  return rows;
}
