export interface NamedMapSet {
  id: string;
  name: string;
}

export interface MapSetNameGroupItem<T extends NamedMapSet> {
  mapSet: T;
  label: string;
}

export interface MapSetNameFolder<T extends NamedMapSet> {
  kind: "folder";
  key: string;
  label: string;
  virtual: boolean;
  items: MapSetNameGroupItem<T>[];
}

export interface MapSetNameRootItem<T extends NamedMapSet>
  extends MapSetNameGroupItem<T> {
  kind: "map-set";
  key: string;
}

export type MapSetNameEntry<T extends NamedMapSet> =
  | MapSetNameFolder<T>
  | MapSetNameRootItem<T>;

const groupNameCollator = new Intl.Collator(undefined, { sensitivity: "base" });
const maximumDirectRootMapSets = 8;

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

export function createMapSetNameEntries<T extends NamedMapSet>(
  mapSets: readonly T[],
): MapSetNameEntry<T>[] {
  const namedGroups = new Map<string, MapSetNameFolder<T>>();
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
        kind: "folder",
        key: `named:${name.group}`,
        label: name.group,
        virtual: false,
        items: [item],
      });
    } else {
      group.items.push(item);
    }
  }

  const entries: MapSetNameEntry<T>[] = [...namedGroups.values()];
  for (const group of entries) {
    if (group.kind === "folder") {
      group.items.sort((left, right) =>
        groupNameCollator.compare(left.label, right.label),
      );
    }
  }

  ungroupedItems.sort((left, right) =>
    groupNameCollator.compare(left.label, right.label),
  );
  if (ungroupedItems.length > maximumDirectRootMapSets) {
    entries.push({
      kind: "folder",
      key: "ungrouped",
      label: "Other Maps",
      virtual: true,
      items: ungroupedItems,
    });
  } else {
    entries.push(
      ...ungroupedItems.map(({ mapSet, label }) => ({
        kind: "map-set" as const,
        key: `map-set:${mapSet.id}`,
        mapSet,
        label,
      })),
    );
  }

  return entries.sort(
    (left, right) =>
      (left.kind === right.kind ? 0 : left.kind === "folder" ? -1 : 1) ||
      groupNameCollator.compare(left.label, right.label),
  );
}
