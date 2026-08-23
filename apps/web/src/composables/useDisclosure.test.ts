import { describe, expect, it } from "vitest";
import { useDisclosure } from "./useDisclosure.js";

describe("useDisclosure", () => {
  it("starts closed", () => {
    const { open } = useDisclosure();
    expect(open.value).toBe(false);
  });

  it("toggles open and closed", () => {
    const { open, toggle } = useDisclosure();
    toggle();
    expect(open.value).toBe(true);
    toggle();
    expect(open.value).toBe(false);
  });

  it("close() forces the state closed regardless of prior toggles", () => {
    const { open, toggle, close } = useDisclosure();
    toggle();
    close();
    expect(open.value).toBe(false);
    close();
    expect(open.value).toBe(false);
  });

  it("gives independent instances independent state", () => {
    const a = useDisclosure();
    const b = useDisclosure();
    a.toggle();
    expect(a.open.value).toBe(true);
    expect(b.open.value).toBe(false);
  });
});
