import { describe, expect, it } from "vitest";
import { nextTableSort, stableSortBy } from "./tableSort.js";

describe("stable table sorting", () => {
  const rows = [
    { id: "first-b", value: "B" },
    { id: "first-a", value: "A" },
    { id: "second-b", value: "B" },
    { id: "missing", value: null },
  ];

  it("sorts ascending while preserving the source order of equal values", () => {
    expect(
      stableSortBy(rows, ({ value }) => value, "ascending").map(({ id }) => id),
    ).toEqual(["first-a", "first-b", "second-b", "missing"]);
  });

  it("sorts descending without reversing equal or missing values", () => {
    expect(
      stableSortBy(rows, ({ value }) => value, "descending").map(
        ({ id }) => id,
      ),
    ).toEqual(["first-b", "second-b", "first-a", "missing"]);
  });

  it("sorts bigint values without converting them to imprecise numbers", () => {
    const values = [2n ** 60n, 3n, 2n ** 61n];

    expect(stableSortBy(values, (value) => value, "ascending")).toEqual([
      3n,
      2n ** 60n,
      2n ** 61n,
    ]);
  });

  it("cycles each column through descending, ascending, and unsorted", () => {
    const unsorted = { column: null, direction: null } as const;
    const descending = nextTableSort(unsorted, "storage");
    const ascending = nextTableSort(descending, "storage");

    expect(descending).toEqual({ column: "storage", direction: "descending" });
    expect(ascending).toEqual({ column: "storage", direction: "ascending" });
    expect(nextTableSort(ascending, "storage")).toEqual(unsorted);
    expect(nextTableSort(ascending, "zoom")).toEqual({
      column: "zoom",
      direction: "descending",
    });
  });
});
