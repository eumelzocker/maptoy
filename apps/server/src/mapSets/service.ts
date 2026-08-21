import { randomUUID } from "node:crypto";
import type {
  MapSet,
  MapSetInput,
  MapSetPatch,
  MapSetTestResponse,
} from "@maptoy/contracts";
import { mapSetInputValidationErrors } from "@maptoy/contracts";
import { wgs84ToXyz } from "@maptoy/map-core";
import type { MapRendererManifestRegistry } from "@maptoy/map-adapter-sdk";
import type { ProviderClient, ProviderResponse } from "../providerClient.js";
import { ProviderRequestError } from "../providerClient.js";
import type { MapSetRepository } from "./repository.js";
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

export class MapSetTileError extends Error {
  readonly code = "PROVIDER_TILE_INVALID";
  readonly statusCode = 502;

  constructor(message: string) {
    super(message);
    this.name = "MapSetTileError";
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
    private readonly options: {
      allowPrivateTileHosts: boolean;
      environment: NodeJS.ProcessEnv;
    },
  ) {}

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
    const updated: MapSet = {
      ...updatedInput,
      id,
      createdAt: current.createdAt,
      updatedAt: new Date().toISOString(),
    };
    this.repository.update(updated);
    return updated;
  }

  delete(id: string): void {
    if (!this.repository.delete(id)) {
      throw new MapSetNotFoundError();
    }
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
  ): Promise<ProviderResponse> {
    const mapSet = this.get(id);
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
    const response = await this.requestTile(mapSet, tile);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw new MapSetTileError(
        `The provider returned HTTP ${response.statusCode} for the requested tile.`,
      );
    }
    const contentTypeHeader = response.headers["content-type"];
    const contentType = Array.isArray(contentTypeHeader)
      ? contentTypeHeader[0]
      : contentTypeHeader;
    const normalizedContentType = contentType?.split(";", 1)[0]?.toLowerCase();
    if (
      normalizedContentType === undefined ||
      !acceptedTileContentTypes.has(normalizedContentType)
    ) {
      throw new MapSetTileError(
        "The provider response is not a supported PNG, JPEG, or WebP tile.",
      );
    }
    return response;
  }

  private requestTile(
    input: MapSetInput,
    tile: { zoom: number; x: number; y: number },
  ): Promise<ProviderResponse> {
    return this.providerClient.request(
      tileUrl(input, tile, this.options.environment),
      providerHeaders(input, this.options.environment),
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
