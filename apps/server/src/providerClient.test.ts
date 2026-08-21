import { describe, expect, it } from "vitest";
import { createPinnedLookup, SafeProviderClient } from "./providerClient.js";

describe("SafeProviderClient", () => {
  it("blocks a hostname when any resolved address is private", async () => {
    const client = new SafeProviderClient({
      allowPrivateHosts: false,
      timeoutMilliseconds: 100,
      maximumResponseBytes: 1024,
      resolve: async () => [
        { address: "203.0.113.1", family: 4 },
        { address: "127.0.0.1", family: 4 },
      ],
    });

    await expect(
      client.request(new URL("https://example.test/tile"), {}),
    ).rejects.toMatchObject({
      code: "PROVIDER_HOST_BLOCKED",
    });
  });

  it("returns the pinned address in the list format requested by Node 24", async () => {
    const pinnedAddress = { address: "203.0.113.1", family: 4 as const };
    const pinnedLookup = createPinnedLookup(pinnedAddress);
    const result = await new Promise<unknown>((resolve, reject) => {
      pinnedLookup("tiles.example.test", { all: true }, (error, addresses) => {
        if (error) {
          reject(error);
        } else {
          resolve(addresses);
        }
      });
    });

    expect(result).toEqual([pinnedAddress]);
  });
});
