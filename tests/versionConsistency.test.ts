import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));

const ignoredDirectories = new Set([
  ".agents",
  ".codex",
  ".data",
  ".direnv",
  ".git",
  ".pnpm-store",
  ".tmp",
  "blob-report",
  "build",
  "coverage",
  "data",
  "dist",
  "node_modules",
  "playwright-report",
  "spikes",
  "test-results",
  "tmp",
]);

interface PackageManifest {
  name?: string;
  version?: string;
}

async function findPackageManifests(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const manifests: string[] = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) {
        manifests.push(
          ...(await findPackageManifests(path.join(directory, entry.name))),
        );
      }
    } else if (entry.isFile() && entry.name === "package.json") {
      manifests.push(path.join(directory, entry.name));
    }
  }

  return manifests;
}

async function readManifest(manifestPath: string): Promise<PackageManifest> {
  return JSON.parse(await readFile(manifestPath, "utf8")) as PackageManifest;
}

describe("package versions", () => {
  it("uses the root version in every release package manifest", async () => {
    const rootManifestPath = path.join(repositoryRoot, "package.json");
    const rootManifest = await readManifest(rootManifestPath);
    const manifestPaths = await findPackageManifests(repositoryRoot);
    const mismatches: string[] = [];

    for (const manifestPath of manifestPaths) {
      const manifest = await readManifest(manifestPath);
      if (manifest.version !== rootManifest.version) {
        mismatches.push(
          `${path.relative(repositoryRoot, manifestPath)}: ${manifest.version ?? "missing"}`,
        );
      }
    }

    expect(rootManifest.version).toBeDefined();
    expect(manifestPaths.length).toBeGreaterThan(1);
    expect(mismatches).toEqual([]);
  });
});
