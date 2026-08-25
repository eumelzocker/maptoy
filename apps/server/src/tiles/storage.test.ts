import {
  access,
  mkdtemp,
  mkdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { TileStorage } from "./storage.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("TileStorage", () => {
  it("promotes complete files atomically and removes abandoned partial files", async () => {
    const directory = await mkdtemp(
      path.join(tmpdir(), "maptoy-storage-test-"),
    );
    temporaryDirectories.push(directory);
    const temporaryDirectory = path.join(directory, "tmp", "tiles");
    await mkdir(temporaryDirectory, { recursive: true });
    await writeFile(
      path.join(temporaryDirectory, "abandoned.partial"),
      "partial",
    );

    const storage = new TileStorage(directory);
    await storage.initialize();
    const relativePath = storage.relativeTilePath(
      "00000000-0000-4000-8000-000000000000",
      { zoom: 3, x: 4, y: 2 },
      "abc123",
      "png",
    );
    await storage.writeAtomic(relativePath, Buffer.from("complete"));

    expect(await storage.read(relativePath)).toEqual(Buffer.from("complete"));
    await expect(
      readFile(path.join(temporaryDirectory, "abandoned.partial")),
    ).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("rejects paths outside the managed tile directory", async () => {
    const directory = await mkdtemp(
      path.join(tmpdir(), "maptoy-storage-test-"),
    );
    temporaryDirectories.push(directory);
    const storage = new TileStorage(directory);
    await storage.initialize();
    await expect(storage.read("../maptoy.sqlite")).rejects.toThrow(
      "managed tile directory",
    );
  });

  it("prunes empty Tile directories without removing non-empty siblings or the root", async () => {
    const directory = await mkdtemp(
      path.join(tmpdir(), "maptoy-storage-test-"),
    );
    temporaryDirectories.push(directory);
    const storage = new TileStorage(directory);
    await storage.initialize();
    const mapSetId = "00000000-0000-4000-8000-000000000000";
    const firstPath = storage.relativeTilePath(
      mapSetId,
      { zoom: 3, x: 4, y: 2 },
      "first",
      "png",
    );
    const siblingPath = storage.relativeTilePath(
      mapSetId,
      { zoom: 3, x: 4, y: 3 },
      "sibling",
      "png",
    );
    await storage.writeAtomic(firstPath, Buffer.from("first"));
    await storage.writeAtomic(siblingPath, Buffer.from("sibling"));

    await storage.delete(firstPath);
    expect(await storage.exists(siblingPath)).toBe(true);
    await access(path.join(storage.tileDirectory, mapSetId, "3", "4"));

    await storage.delete(siblingPath);
    await expect(
      access(path.join(storage.tileDirectory, mapSetId)),
    ).rejects.toMatchObject({ code: "ENOENT" });
    await expect(access(storage.tileDirectory)).resolves.toBeUndefined();
  });
});
