export interface NamedMapSet {
  id: string;
  name: string;
}

export interface MapSetNameGroupItem<T extends NamedMapSet> {
  mapSet: T;
  label: string;
}

export interface MapSetNameGroup<T extends NamedMapSet> {
  key: string;
  label: string;
  ungrouped: boolean;
  items: MapSetNameGroupItem<T>[];
}

const groupNameCollator = new Intl.Collator(undefined, { sensitivity: "base" });

export interface MapSetNameParts {
  group: string | null;
  label: string;
}

export function splitMapSetName(name: string): MapSetNameParts {
  const separatorIndex = name.indexOf("/");
  if (separatorIndex <= 0 || separatorIndex >= name.length - 1) {
    return { group: null, label: name };
  }
  return {
    group: name.slice(0, separatorIndex),
    label: name.slice(separatorIndex + 1),
  };
}

export function groupMapSetsByFirstNameSegment<T extends NamedMapSet>(
  mapSets: readonly T[],
): MapSetNameGroup<T>[] {
  const namedGroups = new Map<string, MapSetNameGroup<T>>();
  const ungroupedItems: MapSetNameGroupItem<T>[] = [];

  for (const mapSet of mapSets) {
    const name = splitMapSetName(mapSet.name);

    if (name.group === null) {
      ungroupedItems.push({ mapSet, label: name.label });
      continue;
    }

    const item = {
      mapSet,
      label: name.label,
    };
    const group = namedGroups.get(name.group);

    if (group === undefined) {
      namedGroups.set(name.group, {
        key: `named:${name.group}`,
        label: name.group,
        ungrouped: false,
        items: [item],
      });
    } else {
      group.items.push(item);
    }
  }

  const groups = [...namedGroups.values()].sort((left, right) =>
    groupNameCollator.compare(left.label, right.label),
  );

  if (ungroupedItems.length > 0) {
    groups.push({
      key: "ungrouped",
      label: "Other Map Sets",
      ungrouped: true,
      items: ungroupedItems,
    });
  }

  return groups;
}
