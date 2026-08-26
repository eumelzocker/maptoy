import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

interface VersionManifest {
  version?: string;
}

async function readJson(url: URL): Promise<VersionManifest> {
  return JSON.parse(await readFile(url, "utf8")) as VersionManifest;
}

test("uses the independent extension version in package and Firefox manifests", async () => {
  const packageManifest = await readJson(
    new URL("../package.json", import.meta.url),
  );
  const firefoxManifest = await readJson(
    new URL("../public/manifest.json", import.meta.url),
  );

  assert.match(packageManifest.version ?? "", /^\d+\.\d+\.\d+$/);
  assert.equal(firefoxManifest.version, packageManifest.version);
});
