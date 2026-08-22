import { createDefaultMapSetInput } from "@maptoy/contracts";
import { describe, expect, it } from "vitest";
import {
  isPrivateOrLocalAddress,
  resolveSecretReferences,
  tileUrl,
  validateMapSetSemantics,
} from "./validation.js";

const baseOptions = {
  allowPrivateTileHosts: false,
  environment: {},
  rendererExists: (id: string) => id === "leaflet-xyz",
};

describe("Map Set validation", () => {
  it.each([
    "127.0.0.1",
    "10.0.0.1",
    "169.254.1.2",
    "192.168.1.2",
    "::1",
    "[::1]",
    "fd00::1",
    "::ffff:7f00:1",
  ])("recognizes a private or local address: %s", (address) => {
    expect(isPrivateOrLocalAddress(address)).toBe(true);
  });

  it("rejects insecure URLs and inconsistent zooms", () => {
    expect(() =>
      validateMapSetSemantics(
        {
          ...createDefaultMapSetInput(),
          urlTemplate: "http://example.com/{z}/{x}/{y}.png",
        },
        baseOptions,
      ),
    ).toThrow("HTTPS");
    expect(() =>
      validateMapSetSemantics(
        { ...createDefaultMapSetInput(), minZoom: 12, maxZoom: 10 },
        baseOptions,
      ),
    ).toThrow("Minimum zoom");
    expect(() =>
      validateMapSetSemantics(
        { ...createDefaultMapSetInput(), minZoom: 1, defaultZoom: 0 },
        baseOptions,
      ),
    ).toThrow("Default zoom");
    expect(() =>
      validateMapSetSemantics(
        {
          ...createDefaultMapSetInput(),
          urlTemplate: "https://127.0.0.1/{z}/{x}/{y}.png",
        },
        baseOptions,
      ),
    ).toThrow("Private");
  });

  it("requires configured MAPTOY secret references without resolving them in storage", () => {
    const input = {
      ...createDefaultMapSetInput(),
      urlTemplate:
        "https://example.com/{z}/{x}/{y}.png?key=$" + "{MAPTOY_PROVIDER_KEY}",
    };
    expect(() => validateMapSetSemantics(input, baseOptions)).toThrow(
      "MAPTOY_PROVIDER_KEY",
    );
    expect(
      resolveSecretReferences(input.urlTemplate, {
        MAPTOY_PROVIDER_KEY: "secret-value",
      }),
    ).toContain("secret-value");
    expect(
      tileUrl(
        input,
        { zoom: 3, x: 4, y: 5 },
        {
          MAPTOY_PROVIDER_KEY: "secret-value",
        },
      ).pathname,
    ).toBe("/3/4/5.png");
  });
});
