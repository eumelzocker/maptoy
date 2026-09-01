import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { PhotoDirectory } from "./photoDirectory.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("PhotoDirectory browsing", () => {
  it("lists only direct subdirectories and returns safe navigation paths", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "maptoy-photo-browser-"));
    temporaryDirectories.push(root);
    await Promise.all([
      mkdir(path.join(root, "Trips", "Day 1"), { recursive: true }),
      mkdir(path.join(root, "Archive")),
      writeFile(path.join(root, "photo.jpg"), "not a directory"),
    ]);
    await symlink(
      path.join(root, "Trips"),
      path.join(root, "Trips link"),
      "dir",
    );
    const photos = new PhotoDirectory(root);

    await expect(photos.directories("")).resolves.toEqual({
      relativeDirectory: "",
      parentDirectory: null,
      items: [
        { name: "Archive", relativePath: "Archive" },
        { name: "Trips", relativePath: "Trips" },
      ],
    });
    await expect(photos.directories("Trips")).resolves.toEqual({
      relativeDirectory: "Trips",
      parentDirectory: "",
      items: [{ name: "Day 1", relativePath: path.join("Trips", "Day 1") }],
    });
  });

  it("rejects browsing outside the configured root", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "maptoy-photo-browser-"));
    temporaryDirectories.push(root);
    const photos = new PhotoDirectory(root);

    await expect(photos.directories("../outside")).rejects.toMatchObject({
      code: "PHOTO_DIRECTORY_INVALID",
      statusCode: 400,
    });
  });
});
