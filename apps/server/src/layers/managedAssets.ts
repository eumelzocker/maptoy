import { createHash, randomUUID } from "node:crypto";
import { mkdir, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { LayerAsset } from "@maptoy/contracts";
import type { LayerPluginRegistry } from "@maptoy/layer-plugin-sdk";
import type { LayerRepository, StoredLayerAsset } from "./repository.js";
import type { LayerService } from "./service.js";
import { LayerValidationError } from "./service.js";

function safeExtension(fileName: string): string {
  const extension = path.extname(fileName).toLowerCase();
  return /^[.][a-z0-9]{1,10}$/.test(extension) ? extension : ".bin";
}

export class ManagedAssetService {
  private readonly assetDirectory: string;
  private readonly temporaryDirectory: string;
  private readonly dataDirectory: string;

  constructor(
    private readonly layers: LayerService,
    private readonly plugins: LayerPluginRegistry,
    private readonly repository: LayerRepository,
    dataDirectory: string,
    private readonly maximumBytes: number,
  ) {
    this.dataDirectory = path.resolve(dataDirectory);
    this.assetDirectory = path.join(dataDirectory, "layer-assets");
    this.temporaryDirectory = path.join(dataDirectory, "tmp", "layer-assets");
  }

  async initialize(): Promise<void> {
    await Promise.all([
      mkdir(this.assetDirectory, { recursive: true }),
      mkdir(this.temporaryDirectory, { recursive: true }),
    ]);
  }

  resolveAssetPath(asset: StoredLayerAsset): string {
    if (asset.kind !== "managed" || asset.managedPath === null) {
      throw new LayerValidationError("The asset is not a managed upload.");
    }
    const absolute = path.resolve(this.dataDirectory, asset.managedPath);
    const relative = path.relative(this.assetDirectory, absolute);
    if (
      relative === ".." ||
      relative.startsWith(`..${path.sep}`) ||
      path.isAbsolute(relative)
    ) {
      throw new LayerValidationError("The managed asset path is invalid.");
    }
    return absolute;
  }

  async deleteLayerFiles(layerId: string): Promise<void> {
    await Promise.all(
      this.repository
        .listAllAssets(layerId)
        .filter((asset) => asset.kind === "managed")
        .map((asset) =>
          unlink(this.resolveAssetPath(asset)).catch(() => undefined),
        ),
    );
  }

  async import(
    layerId: string,
    input: {
      fileName: string;
      mimeType: string;
      bytes: Uint8Array;
    },
  ): Promise<{ layer: import("@maptoy/contracts").Layer; asset: LayerAsset }> {
    if (input.bytes.byteLength > this.maximumBytes) {
      throw new ManagedAssetTooLargeError();
    }
    const layer = this.layers.get(layerId);
    const plugin = this.plugins.get(layer.pluginId);
    if (plugin?.assetImport === undefined) {
      throw new LayerValidationError(
        "The selected layer plugin does not accept managed asset uploads.",
      );
    }
    const assetId = randomUUID();
    const imported = await plugin.assetImport.importAsset({
      assetId,
      fileName: input.fileName,
      mimeType: input.mimeType,
      bytes: input.bytes,
    });
    await plugin.shared.validateConfiguration(imported.configuration);
    await plugin.shared.validateData(imported.data);
    if (!imported.managedAssetIds.includes(assetId)) {
      throw new LayerValidationError(
        "The plugin import did not retain the managed asset.",
      );
    }
    const hash = createHash("sha256").update(input.bytes).digest("hex");
    const layerDirectory = path.join(this.assetDirectory, layerId);
    await mkdir(layerDirectory, { recursive: true });
    const relativePath = path.join(
      "layer-assets",
      layerId,
      `${assetId}.${hash}${safeExtension(input.fileName)}`,
    );
    const finalPath = path.join(
      path.dirname(this.assetDirectory),
      relativePath,
    );
    const temporaryPath = path.join(this.temporaryDirectory, `${assetId}.tmp`);
    await writeFile(temporaryPath, input.bytes, { flag: "wx" });
    try {
      await rename(temporaryPath, finalPath);
      const updatedLayer = await this.layers.update(layerId, {
        configuration: imported.configuration as Record<string, unknown>,
        data: imported.data as Record<string, unknown>,
      });
      const timestamp = new Date().toISOString();
      const stored: StoredLayerAsset = {
        id: assetId,
        layerId,
        kind: "managed",
        status: "ready",
        fileName: path.basename(input.fileName),
        contentType: input.mimeType,
        byteLength: input.bytes.byteLength,
        contentHash: hash,
        sourceRootId: null,
        relativePath: null,
        sourceModifiedAt: null,
        width: null,
        height: null,
        longitude: null,
        latitude: null,
        coordinateSource: "none",
        previewAvailable: false,
        errorCode: null,
        errorMessage: null,
        createdAt: timestamp,
        updatedAt: timestamp,
        managedPath: relativePath,
        previewPath: null,
        sourceFingerprint: null,
        bounds: null,
        metadata: {},
      };
      this.repository.upsertAsset(stored);
      const {
        managedPath: _managedPath,
        previewPath: _previewPath,
        sourceFingerprint: _sourceFingerprint,
        metadata: _metadata,
        ...asset
      } = stored;
      return { layer: updatedLayer, asset };
    } catch (error) {
      await Promise.all([
        unlink(temporaryPath).catch(() => undefined),
        unlink(finalPath).catch(() => undefined),
      ]);
      throw error;
    }
  }
}

export class ManagedAssetTooLargeError extends Error {
  readonly code = "LAYER_ASSET_TOO_LARGE";
  readonly statusCode = 413;

  constructor() {
    super("The upload exceeds MAPTOY_MAX_LAYER_ASSET_BYTES.");
    this.name = "ManagedAssetTooLargeError";
  }
}
