import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import {
  access,
  mkdir,
  opendir,
  realpath,
  rename,
  stat,
  unlink,
} from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import type { ImageRootConfig } from "@maptoy/config";
import sharp from "sharp";

export class ImageRootError extends Error {
  readonly code = "IMAGE_ROOT_INVALID";
  readonly statusCode = 400;

  constructor(message: string) {
    super(message);
    this.name = "ImageRootError";
  }
}

function isWithin(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return (
    relative === "" ||
    (!relative.startsWith(`..${path.sep}`) &&
      relative !== ".." &&
      !path.isAbsolute(relative))
  );
}

function normalizeRelative(value: string): string {
  if (path.isAbsolute(value) || value.includes("\0")) {
    throw new ImageRootError("Image paths must be relative.");
  }
  const normalized = path.normalize(value || ".");
  if (normalized === ".." || normalized.startsWith(`..${path.sep}`)) {
    throw new ImageRootError(
      "The image path leaves its configured image root.",
    );
  }
  return normalized;
}

const supportedImageExtensions = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".tif",
  ".tiff",
]);

export interface ResolvedImageFile {
  absolutePath: string;
  relativePath: string;
}

export class ImageRootResolver {
  private readonly roots: ReadonlyMap<string, string>;

  constructor(roots: readonly ImageRootConfig[]) {
    this.roots = new Map(roots.map((root) => [root.id, root.path]));
  }

  async list(): Promise<Array<{ id: string; available: boolean }>> {
    return Promise.all(
      [...this.roots].map(async ([id, rootPath]) => {
        try {
          await access(rootPath);
          return { id, available: true };
        } catch {
          return { id, available: false };
        }
      }),
    );
  }

  async resolveDirectory(
    rootId: string,
    relativeDirectory: string,
  ): Promise<{
    rootPath: string;
    directoryPath: string;
    relativeDirectory: string;
  }> {
    const configuredRoot = this.roots.get(rootId);
    if (configuredRoot === undefined) {
      throw new ImageRootError("The requested image root is not configured.");
    }
    const normalized = normalizeRelative(relativeDirectory);
    let rootPath: string;
    let directoryPath: string;
    try {
      [rootPath, directoryPath] = await Promise.all([
        realpath(configuredRoot),
        realpath(path.resolve(configuredRoot, normalized)),
      ]);
    } catch {
      throw new ImageRootError(
        "The requested image root or directory is not available.",
      );
    }
    if (!isWithin(rootPath, directoryPath)) {
      throw new ImageRootError(
        "The requested directory leaves its configured image root.",
      );
    }
    return {
      rootPath,
      directoryPath,
      relativeDirectory: normalized === "." ? "" : normalized,
    };
  }

  async resolveFile(
    rootId: string,
    relativePath: string,
  ): Promise<ResolvedImageFile> {
    const directory = await this.resolveDirectory(rootId, ".");
    const normalized = normalizeRelative(relativePath);
    let absolutePath: string;
    try {
      absolutePath = await realpath(
        path.resolve(directory.rootPath, normalized),
      );
    } catch {
      throw new ImageRootError("The requested image file is not available.");
    }
    if (!isWithin(directory.rootPath, absolutePath)) {
      throw new ImageRootError(
        "The requested file leaves its configured image root.",
      );
    }
    return { absolutePath, relativePath: normalized };
  }

  async files(
    rootId: string,
    relativeDirectory: string,
    recursive: boolean,
  ): Promise<ResolvedImageFile[]> {
    const resolved = await this.resolveDirectory(rootId, relativeDirectory);
    const files: ResolvedImageFile[] = [];
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
          supportedImageExtensions.has(path.extname(entry.name).toLowerCase())
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

async function hashFile(filePath: string): Promise<string> {
  const hash = createHash("sha256");
  await pipeline(createReadStream(filePath), hash);
  return hash.digest("hex");
}

function contentType(format: string | undefined): string | null {
  if (format === "jpeg") {
    return "image/jpeg";
  }
  if (format === "png") {
    return "image/png";
  }
  if (format === "webp") {
    return "image/webp";
  }
  if (format === "tiff") {
    return "image/tiff";
  }
  return null;
}

export interface ProcessedImage {
  byteLength: number;
  contentHash: string;
  contentType: string;
  width: number;
  height: number;
  sourceModifiedAt: string;
  sourceFingerprint: string;
  previewPath: string;
  metadata: Readonly<Record<string, unknown>>;
}

export interface ImageSourceFingerprint {
  byteLength: number;
  sourceModifiedAt: string;
  sourceFingerprint: string;
}

export class ImagePreviewStorage {
  private readonly previewDirectory: string;
  private readonly temporaryDirectory: string;

  constructor(
    private readonly dataDirectory: string,
    private readonly options: {
      maximumImageBytes: number;
      maximumImagePixels: number;
      previewMaximumEdge: number;
    },
  ) {
    this.previewDirectory = path.join(dataDirectory, "layer-previews");
    this.temporaryDirectory = path.join(dataDirectory, "tmp", "image-previews");
  }

  async initialize(): Promise<void> {
    await Promise.all([
      mkdir(this.previewDirectory, { recursive: true }),
      mkdir(this.temporaryDirectory, { recursive: true }),
    ]);
  }

  async process(assetId: string, filePath: string): Promise<ProcessedImage> {
    const source = await this.fingerprint(filePath);
    const file = await stat(filePath);
    const image = sharp(filePath, {
      limitInputPixels: this.options.maximumImagePixels,
      sequentialRead: true,
    });
    const metadata = await image.metadata();
    if (
      metadata.width === undefined ||
      metadata.height === undefined ||
      metadata.width * metadata.height > this.options.maximumImagePixels
    ) {
      throw new Error("The image dimensions exceed MAPTOY_MAX_IMAGE_PIXELS.");
    }
    const detectedContentType = contentType(metadata.format);
    if (detectedContentType === null) {
      throw new Error("The image format is not supported.");
    }
    const contentHash = await hashFile(filePath);
    const relativePreviewPath = path.join(
      "layer-previews",
      `${assetId}.${contentHash}.webp`,
    );
    const finalPath = path.join(this.dataDirectory, relativePreviewPath);
    const temporaryPath = path.join(
      this.temporaryDirectory,
      `${assetId}.${contentHash}.tmp`,
    );
    try {
      await sharp(filePath, {
        limitInputPixels: this.options.maximumImagePixels,
        sequentialRead: true,
      })
        .rotate()
        .resize({
          width: this.options.previewMaximumEdge,
          height: this.options.previewMaximumEdge,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: 82 })
        .toFile(temporaryPath);
      await rename(temporaryPath, finalPath);
    } catch (error) {
      await unlink(temporaryPath).catch(() => undefined);
      throw error;
    }
    return {
      byteLength: file.size,
      contentHash,
      contentType: detectedContentType,
      width: metadata.width,
      height: metadata.height,
      sourceModifiedAt: source.sourceModifiedAt,
      sourceFingerprint: source.sourceFingerprint,
      previewPath: relativePreviewPath,
      metadata: {
        orientation: metadata.orientation ?? null,
        pages: metadata.pages ?? null,
      },
    };
  }

  async fingerprint(filePath: string): Promise<ImageSourceFingerprint> {
    const file = await stat(filePath);
    if (!file.isFile()) {
      throw new Error("The image source is not a regular file.");
    }
    if (file.size > this.options.maximumImageBytes) {
      throw new Error("The image exceeds MAPTOY_MAX_IMAGE_BYTES.");
    }
    return {
      byteLength: file.size,
      sourceModifiedAt: file.mtime.toISOString(),
      sourceFingerprint: `${file.size}:${file.mtimeMs}`,
    };
  }

  async remove(relativePath: string): Promise<void> {
    await unlink(this.resolvePreview(relativePath)).catch(() => undefined);
  }

  resolvePreview(relativePath: string): string {
    const absolute = path.resolve(this.dataDirectory, relativePath);
    if (!isWithin(path.resolve(this.previewDirectory), absolute)) {
      throw new ImageRootError("The preview path is invalid.");
    }
    return absolute;
  }
}
