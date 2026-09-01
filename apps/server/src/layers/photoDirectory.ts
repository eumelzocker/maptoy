import { opendir, realpath } from "node:fs/promises";
import path from "node:path";
import { isWithin } from "./pathSafety.js";

export class PhotoDirectoryError extends Error {
  readonly code = "PHOTO_DIRECTORY_INVALID";
  readonly statusCode = 400;

  constructor(message: string) {
    super(message);
    this.name = "PhotoDirectoryError";
  }
}

function normalizeRelative(value: string): string {
  if (path.isAbsolute(value) || value.includes("\0")) {
    throw new PhotoDirectoryError("Photo paths must be relative.");
  }
  const normalized = path.normalize(value || ".");
  if (normalized === ".." || normalized.startsWith(`..${path.sep}`)) {
    throw new PhotoDirectoryError(
      "The photo path leaves the configured photo directory.",
    );
  }
  return normalized;
}

const supportedPhotoExtensions = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".tif",
  ".tiff",
]);

export interface ResolvedPhotoFile {
  absolutePath: string;
  relativePath: string;
}

export interface PhotoDirectoryListing {
  relativeDirectory: string;
  parentDirectory: string | null;
  items: Array<{ name: string; relativePath: string }>;
}

export class PhotoDirectory {
  constructor(private readonly configuredPath: string | null) {}

  async status(): Promise<{ configured: boolean; available: boolean }> {
    if (this.configuredPath === null) {
      return { configured: false, available: false };
    }
    try {
      const directory = await opendir(this.configuredPath);
      await directory.close();
      return { configured: true, available: true };
    } catch {
      return { configured: true, available: false };
    }
  }

  async resolveDirectory(relativeDirectory: string): Promise<{
    directoryPath: string;
    rootPath: string;
    relativeDirectory: string;
  }> {
    if (this.configuredPath === null) {
      throw new PhotoDirectoryError("The photo directory is not configured.");
    }
    const normalized = normalizeRelative(relativeDirectory);
    let rootPath: string;
    let directoryPath: string;
    try {
      [rootPath, directoryPath] = await Promise.all([
        realpath(this.configuredPath),
        realpath(path.resolve(this.configuredPath, normalized)),
      ]);
    } catch {
      throw new PhotoDirectoryError(
        "The configured photo directory is not available.",
      );
    }
    if (!isWithin(rootPath, directoryPath)) {
      throw new PhotoDirectoryError(
        "The requested directory leaves the configured photo directory.",
      );
    }
    return {
      rootPath,
      directoryPath,
      relativeDirectory: normalized === "." ? "" : normalized,
    };
  }

  async directories(relativeDirectory: string): Promise<PhotoDirectoryListing> {
    const resolved = await this.resolveDirectory(relativeDirectory);
    const items: PhotoDirectoryListing["items"] = [];
    let directory: Awaited<ReturnType<typeof opendir>>;
    try {
      directory = await opendir(resolved.directoryPath);
    } catch {
      throw new PhotoDirectoryError(
        "The requested photo directory is not available.",
      );
    }
    for await (const entry of directory) {
      if (!entry.isSymbolicLink() && entry.isDirectory()) {
        items.push({
          name: entry.name,
          relativePath: path.relative(
            resolved.rootPath,
            path.join(resolved.directoryPath, entry.name),
          ),
        });
      }
    }
    items.sort((left, right) => left.name.localeCompare(right.name));

    const parent = path.dirname(resolved.relativeDirectory);
    return {
      relativeDirectory: resolved.relativeDirectory,
      parentDirectory:
        resolved.relativeDirectory === "" ? null : parent === "." ? "" : parent,
      items,
    };
  }

  async files(
    relativeDirectory: string,
    recursive: boolean,
  ): Promise<ResolvedPhotoFile[]> {
    const resolved = await this.resolveDirectory(relativeDirectory);
    const files: ResolvedPhotoFile[] = [];
    const visit = async (directoryPath: string): Promise<void> => {
      const directory = await opendir(directoryPath);
      for await (const entry of directory) {
        if (entry.isSymbolicLink()) {
          continue;
        }
        const entryPath = path.join(directoryPath, entry.name);
        if (entry.isDirectory()) {
          if (recursive) {
            await visit(entryPath);
          }
          continue;
        }
        if (
          entry.isFile() &&
          supportedPhotoExtensions.has(path.extname(entry.name).toLowerCase())
        ) {
          files.push({
            absolutePath: entryPath,
            relativePath: path.relative(resolved.rootPath, entryPath),
          });
        }
      }
    };
    await visit(resolved.directoryPath);
    files.sort((left, right) =>
      left.relativePath.localeCompare(right.relativePath),
    );
    return files;
  }
}
