export interface CheckboxTreeNode {
  id: string;
  label: string;
  icon?: string;
  checked: boolean;
  indeterminate?: boolean;
  disabled?: boolean;
  checkDisabled?: boolean;
  selectable?: boolean;
  secondaryText?: string;
  searchText?: string;
  children?: CheckboxTreeNode[];
}

export function filterCheckboxTree(
  nodes: readonly CheckboxTreeNode[],
  query: string,
): CheckboxTreeNode[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (normalizedQuery === "") {
    return [...nodes];
  }

  const matches: CheckboxTreeNode[] = [];
  for (const node of nodes) {
    const ownText =
      `${node.label} ${node.searchText ?? ""}`.toLocaleLowerCase();
    if (ownText.includes(normalizedQuery)) {
      matches.push(node);
      continue;
    }
    const children = filterCheckboxTree(node.children ?? [], normalizedQuery);
    if (children.length > 0) {
      matches.push({ ...node, children });
    }
  }
  return matches;
}

export function findCheckboxTreePath(
  nodes: readonly CheckboxTreeNode[],
  id: string,
): CheckboxTreeNode[] {
  for (const node of nodes) {
    if (node.id === id) {
      return [node];
    }
    const childPath = findCheckboxTreePath(node.children ?? [], id);
    if (childPath.length > 0) {
      return [node, ...childPath];
    }
  }
  return [];
}

export function checkboxTreeBranchIds(
  nodes: readonly CheckboxTreeNode[],
): string[] {
  return nodes.flatMap((node) =>
    node.children?.length
      ? [node.id, ...checkboxTreeBranchIds(node.children)]
      : [],
  );
}
