import { describe, expect, it } from "vitest";
import {
  type CheckboxTreeNode,
  checkboxTreeBranchIds,
  filterCheckboxTree,
  findCheckboxTreePath,
} from "./checkboxTree.js";

const nodes: CheckboxTreeNode[] = [
  {
    id: "tracks",
    label: "Tracks",
    checked: false,
    children: [
      {
        id: "trips",
        label: "Trips",
        checked: false,
        children: [
          {
            id: "alps",
            label: "Alps",
            searchText: "Trips/2026/Alps",
            checked: true,
            selectable: true,
          },
        ],
      },
    ],
  },
  {
    id: "photos",
    label: "Photos",
    checked: true,
    children: [],
  },
];

describe("Checkbox tree", () => {
  it("retains ancestors while filtering by a descendant path", () => {
    expect(filterCheckboxTree(nodes, "2026")).toEqual([
      {
        ...nodes[0],
        children: [
          {
            ...nodes[0]?.children?.[0],
            children: [nodes[0]?.children?.[0]?.children?.[0]],
          },
        ],
      },
    ]);
  });

  it("finds the complete path used by the dropdown trigger", () => {
    expect(
      findCheckboxTreePath(nodes, "alps").map(({ label }) => label),
    ).toEqual(["Tracks", "Trips", "Alps"]);
  });

  it("collects expandable branches", () => {
    expect(checkboxTreeBranchIds(nodes)).toEqual(["tracks", "trips"]);
  });
});
