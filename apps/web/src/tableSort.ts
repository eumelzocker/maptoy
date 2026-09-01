export type SortDirection = "ascending" | "descending";

export type SortValue = bigint | number | string | null;

export interface TableSortState<Column extends string> {
  column: Column | null;
  direction: SortDirection | null;
}

export function nextTableSort<Column extends string>(
  current: TableSortState<Column>,
  column: Column,
): TableSortState<Column> {
  if (current.column !== column || current.direction === null) {
    return { column, direction: "descending" };
  }
  if (current.direction === "descending") {
    return { column, direction: "ascending" };
  }
  return { column: null, direction: null };
}

const textCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

function compareValues(left: SortValue, right: SortValue): number {
  if (left === right) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  if (typeof left === "string" && typeof right === "string") {
    return textCollator.compare(left, right);
  }
  return left < right ? -1 : 1;
}

export function stableSortBy<Item>(
  items: readonly Item[],
  valueFor: (item: Item) => SortValue,
  direction: SortDirection,
): Item[] {
  const multiplier = direction === "ascending" ? 1 : -1;

  return items
    .map((item, index) => ({ item, index, value: valueFor(item) }))
    .sort((left, right) => {
      const compared = compareValues(left.value, right.value);
      if (compared === 0) return left.index - right.index;

      // Missing values stay at the end in both directions.
      if (left.value === null || right.value === null) return compared;
      return compared * multiplier;
    })
    .map(({ item }) => item);
}
