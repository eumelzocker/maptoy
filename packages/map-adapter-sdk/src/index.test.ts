import { describe, expect, it } from "vitest";
import {
  createFakeMapRendererFactory,
  createMapRendererFactoryRegistry,
  createMapRendererManifestRegistry,
  exerciseMapRendererContract,
} from "./index.js";

describe("map renderer contract", () => {
  it("is satisfied by the SDK fake adapter", async () => {
    await expect(
      exerciseMapRendererContract(fakeFactory(), {
        host: {} as HTMLElement,
        configuration: {},
      }),
    ).resolves.toBeUndefined();
  });

  it("registers factories by manifest id", () => {
    const factory = createFakeMapRendererFactory();
    expect(createMapRendererFactoryRegistry([factory]).get("fake")).toBe(
      factory,
    );
  });

  it("rejects duplicate registrations", () => {
    const manifest = createFakeMapRendererFactory().manifest;
    expect(() =>
      createMapRendererManifestRegistry([manifest, manifest]),
    ).toThrow("duplicate adapter id");
  });
});

function fakeFactory() {
  return createFakeMapRendererFactory();
}
