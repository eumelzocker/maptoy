import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, rename, stat, unlink } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import sharp from "sharp";
import { isWithin } from "./pathSafety.js";

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
      maximumFileBytes: number;
      maximumDecodedPixels: number;
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
      limitInputPixels: this.options.maximumDecodedPixels,
      sequentialRead: true,
    });
    const metadata = await image.metadata();
    if (
      metadata.width === undefined ||
      metadata.height === undefined ||
      metadata.width * metadata.height > this.options.maximumDecodedPixels
    ) {
      throw new Error(
        "The image dimensions exceed MAPTOY_PHOTOS_MAX_DECODED_PIXELS.",
      );
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
        limitInputPixels: this.options.maximumDecodedPixels,
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
    if (file.size > this.options.maximumFileBytes) {
      throw new Error("The image exceeds MAPTOY_PHOTOS_MAX_FILE_BYTES.");
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
      throw new Error("The preview path is invalid.");
    }
    return absolute;
  }
}
