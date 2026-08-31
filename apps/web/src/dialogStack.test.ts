import { describe, expect, it } from "vitest";
import {
  activateDialog,
  deactivateDialog,
  isTopDialog,
} from "./dialogStack.js";

describe("dialog stack", () => {
  it("assigns successively higher stacking positions", () => {
    const firstDialog = Symbol("first");
    const secondDialog = Symbol("second");
    const first = activateDialog(firstDialog);
    const second = activateDialog(secondDialog);

    expect(second).toBeGreaterThan(first);

    deactivateDialog(firstDialog);
    deactivateDialog(secondDialog);
  });

  it("keeps only the foremost active dialog on top", () => {
    const firstDialog = Symbol("first");
    const secondDialog = Symbol("second");

    activateDialog(firstDialog);
    expect(isTopDialog(firstDialog)).toBe(true);

    activateDialog(secondDialog);
    expect(isTopDialog(firstDialog)).toBe(false);
    expect(isTopDialog(secondDialog)).toBe(true);

    activateDialog(firstDialog);
    expect(isTopDialog(firstDialog)).toBe(true);
    expect(isTopDialog(secondDialog)).toBe(false);

    deactivateDialog(firstDialog);
    expect(isTopDialog(firstDialog)).toBe(false);
    expect(isTopDialog(secondDialog)).toBe(true);

    deactivateDialog(secondDialog);
    expect(isTopDialog(secondDialog)).toBe(false);
  });
});
