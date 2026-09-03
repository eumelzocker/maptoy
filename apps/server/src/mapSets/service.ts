import { randomUUID } from "node:crypto";
import type {
  MapSet,
  MapSetInput,
  MapSetPatch,
  MapSetTestResponse,
  TileUploadResponse,
} from "@maptoy/contracts";
import { mapSetInputValidationErrors } from "@maptoy/contracts";
import { wgs84ToXyz } from "@maptoy/map-core";
import type { MapRendererManifestRegistry } from "@maptoy/map-adapter-sdk";
import type { ProviderClient, ProviderResponse } from "../providerClient.js";
import { ProviderRequestError } from "../providerClient.js";
import type { TileSelection } from "../tiles/repository.js";
import type {
  ArchivedTileResponse,
  TileArchiveService,
} from "../tiles/service.js";
import type { MapSetRepository } from "./repository.js";
import { createDefaultOpenTopoMapInput } from "./defaults.js";
import {
  MapSetValidationError,
  providerHeaders,
  tileUrl,
  validateMapSetSemantics,
} from "./validation.js";

export class MapSetNotFoundError extends Error {
  readonly code = "MAP_SET_NOT_FOUND";
  readonly statusCode = 404;

  constructor() {
    super("The requested Map Set does not exist.");
    this.name = "MapSetNotFoundError";
  }
}

export class MapSetSourceLockedError extends Error {
  readonly code = "MAP_SET_SOURCE_LOCKED";
  readonly statusCode = 409;

  constructor() {
    super(
      "Tile source settings cannot be changed after this Map Set has cached tiles. Duplicate the Map Set to use a different source.",
    );
    this.name = "MapSetSourceLockedError";
  }
}

function inputFromMapSet(mapSet: MapSet): MapSetInput {
  const {
    id: _id,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    ...input
  } = mapSet;
  return input;
}

function tileSourceIdentity(mapSet: MapSetInput): string {
  // A Map Set is the stable source boundary once its first Tile Revision exists.
  // Sorting headers avoids treating a harmless object-key reordering as a change.
  return JSON.stringify({
    sourceType: mapSet.sourceType,
    urlTemplate: mapSet.urlTemplate,
    headers: Object.entries(mapSet.headers).sort(([left], [right]) =>
      left.localeCompare(right),
    ),
    subdomains: mapSet.subdomains,
    tileSize: mapSet.tileSize,
    tileFormat: mapSet.tileFormat,
    sourceProjection: mapSet.sourceProjection,
  });
}

const acceptedTileContentTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export class MapSetService {
  constructor(
    private readonly repository: MapSetRepository,
    private readonly renderers: MapRendererManifestRegistry,
    private readonly providerClient: ProviderClient,
    private readonly tileArchive: TileArchiveService,
    private readonly options: {
      allowPrivateTileHosts: boolean;
      environment: NodeJS.ProcessEnv;
      maximumTileBytes: number;
    },
  ) {}

  initialize(): void {
    if (this.repository.list().length === 0) {
      this.create(createDefaultOpenTopoMapInput());
    }
  }

  list(): MapSet[] {
    return this.repository.list();
  }

  get(id: string): MapSet {
    const mapSet = this.repository.get(id);
    if (mapSet === undefined) {
      throw new MapSetNotFoundError();
    }
    return mapSet;
  }

  create(input: MapSetInput): MapSet {
    const validated = this.validateAndNormalize(input);
    const timestamp = new Date().toISOString();
    const mapSet: MapSet = {
      ...validated,
      id: randomUUID(),
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.repository.insert(mapSet);
    return mapSet;
  }

  update(id: string, patch: MapSetPatch): MapSet {
    const current = this.get(id);
    const updatedInput = this.validateAndNormalize({
      ...inputFromMapSet(current),
      ...patch,
    });
    if (
      this.tileArchive.hasCachedTiles(id) &&
      tileSourceIdentity(current) !== tileSourceIdentity(updatedInput)
    ) {
      throw new MapSetSourceLockedError();
    }
    const updated: MapSet = {
      ...updatedInput,
      id,
      createdAt: current.createdAt,
      updatedAt: new Date().toISOString(),
    };
    this.repository.update(updated);
    return updated;
  }

  async delete(id: string): Promise<void> {
    if (!this.repository.delete(id)) {
      throw new MapSetNotFoundError();
    }
    await this.tileArchive.deleteMapSetFiles(id);
  }

  async test(id: string): Promise<MapSetTestResponse> {
    const mapSet = this.get(id);
    const zoom = Math.floor(mapSet.defaultZoom);
    const xyz = wgs84ToXyz(mapSet.defaultCenter, zoom);
    const tile = { zoom, x: Math.floor(xyz.x), y: Math.floor(xyz.y) };
    const startedAt = performance.now();
    try {
      const response = await this.requestTile(mapSet, tile);
      const contentType =
        response.headers["content-type"]?.split(";", 1)[0] ?? null;
      const ok =
        response.statusCode >= 200 &&
        response.statusCode < 300 &&
        contentType !== null &&
        acceptedTileContentTypes.has(contentType.toLowerCase());
      return {
        ok,
        tile,
        statusCode: response.statusCode,
        contentType,
        byteLength: response.body.byteLength,
        durationMilliseconds: Math.round(performance.now() - startedAt),
        message: ok
          ? "The provider returned a supported raster tile."
          : response.statusCode < 200 || response.statusCode >= 300
            ? `The provider returned HTTP ${response.statusCode}.`
            : "The provider response is not a supported PNG, JPEG, or WebP tile.",
      };
    } catch (error) {
      const providerError =
        error instanceof ProviderRequestError ? error : undefined;
      return {
        ok: false,
        tile,
        statusCode: null,
        contentType: null,
        byteLength: null,
        durationMilliseconds: Math.round(performance.now() - startedAt),
        message:
          providerError?.message ?? "The provider request failed unexpectedly.",
      };
    }
  }

  async tile(
    id: string,
    tile: { zoom: number; x: number; y: number },
    options: {
      refresh: import("@maptoy/contracts").TileRefreshMode;
      selection: TileSelection;
    },
  ): Promise<ArchivedTileResponse> {
    const mapSet = this.get(id);
    this.validateTileCoordinate(mapSet, tile);
    return this.tileArchive.tile(mapSet, tile, options, (additionalHeaders) =>
      this.requestTile(mapSet, tile, additionalHeaders),
    );
  }

  async uploadTile(
    id: string,
    tile: { zoom: number; x: number; y: number },
    body: Buffer,
    contentType: string | undefined,
    validators: {
      etag?: string | undefined;
      lastModified?: string | undefined;
    } = {},
  ): Promise<TileUploadResponse> {
    const mapSet = this.get(id);
    this.validateTileCoordinate(mapSet, tile);
    return this.tileArchive.upload(mapSet, tile, {
      body,
      contentType,
      maximumTileBytes: this.options.maximumTileBytes,
      etag: validators.etag,
      lastModified: validators.lastModified,
    });
  }

  private validateTileCoordinate(
    mapSet: MapSet,
    tile: { zoom: number; x: number; y: number },
  ): void {
    if (tile.zoom < mapSet.minZoom || tile.zoom > mapSet.maxZoom) {
      throw new MapSetValidationError(
        "The requested tile zoom is outside the Map Set zoom range.",
      );
    }
    const scale = 2 ** tile.zoom;
    if (tile.x < 0 || tile.y < 0 || tile.x >= scale || tile.y >= scale) {
      throw new MapSetValidationError(
        "The requested XYZ tile is out of range.",
      );
    }
  }

  private requestTile(
    input: MapSetInput,
    tile: { zoom: number; x: number; y: number },
    additionalHeaders: Readonly<Record<string, string>> = {},
  ): Promise<ProviderResponse> {
    return this.providerClient.request(
      tileUrl(input, tile, this.options.environment),
      {
        ...providerHeaders(input, this.options.environment),
        ...additionalHeaders,
      },
    );
  }

  private validateAndNormalize(input: MapSetInput): MapSetInput {
    const structureErrors = mapSetInputValidationErrors(input);
    if (structureErrors.length > 0) {
      throw new MapSetValidationError(structureErrors[0] ?? "Invalid Map Set.");
    }
    validateMapSetSemantics(input, {
      ...this.options,
      rendererExists: (id) => this.renderers.get(id) !== undefined,
    });
    const renderer = this.renderers.get(input.rendererId);
    if (renderer === undefined) {
      throw new MapSetValidationError(
        "The renderer adapter is not registered.",
      );
    }
    return {
      ...input,
      name: input.name.trim(),
      attribution: input.attribution.trim(),
      capabilities: {
        interactive:
          input.capabilities.interactive && renderer.capabilities.interactive,
        tileArchive:
          input.capabilities.tileArchive && renderer.capabilities.tileArchive,
        batchDownload:
          input.capabilities.batchDownload &&
          renderer.capabilities.batchDownload,
        serverExport:
          input.capabilities.serverExport && renderer.capabilities.serverExport,
        layerRendering:
          input.capabilities.layerRendering &&
          renderer.capabilities.layerRendering,
      },
    };
  }
}
