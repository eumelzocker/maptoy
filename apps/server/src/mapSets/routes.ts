import {
  CacheSnapshotCreateInputSchema,
  type CacheSnapshotCreateInput,
  CacheSnapshotListResponseSchema,
  CacheSnapshotSchema,
  ErrorResponseSchema,
  type MapSet,
  type MapSetInput,
  MapSetInputSchema,
  MapSetListResponseSchema,
  type MapSetPatch,
  MapSetPatchSchema,
  MapSetSchema,
  MapSetTestResponseSchema,
  TileCacheAuditResultSchema,
  TileCacheComparisonSchema,
  TileCacheOverviewAuditResultSchema,
  TileCacheOverviewStatsSchema,
  TileCacheRepairResultSchema,
  TileCacheStatsSchema,
  TileCacheUnsupportedZoomCleanupResultSchema,
  TileCacheUnsupportedZoomInfoSchema,
  TileRevisionListResponseSchema,
  TileUploadBodySchema,
  type TileUploadResponse,
  TileUploadResponseSchema,
} from "@maptoy/contracts";
import type { FastifyInstance } from "fastify";
import { ProviderRequestError } from "../providerClient.js";
import { generateErrorTile } from "../tiles/errorTile.js";
import type { TileSelection } from "../tiles/repository.js";
import { TileArchiveError, type TileArchiveService } from "../tiles/service.js";
import type { MapSetService } from "./service.js";
import { MapSetValidationError } from "./validation.js";

const idParametersSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id"],
  properties: {
    id: {
      type: "string",
      pattern:
        "^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$",
    },
  },
} as const;

const tileParametersSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "z", "x", "y"],
  properties: {
    id: idParametersSchema.properties.id,
    z: { type: "integer", minimum: 0, maximum: 24 },
    x: { type: "integer", minimum: 0 },
    y: { type: "integer", minimum: 0 },
  },
} as const;

const archiveIdParametersSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "archiveId"],
  properties: {
    id: idParametersSchema.properties.id,
    archiveId: idParametersSchema.properties.id,
  },
} as const;

function tileSelection(query: {
  snapshot?: string;
  asOf?: string;
  revision?: string;
}): TileSelection {
  const selectors = [query.snapshot, query.asOf, query.revision].filter(
    (value) => value !== undefined,
  );
  if (selectors.length > 1) {
    throw new MapSetValidationError(
      "Use only one of snapshot, asOf, or revision for a tile request.",
    );
  }
  if (query.snapshot !== undefined) {
    return { kind: "snapshot", snapshotId: query.snapshot };
  }
  if (query.revision !== undefined) {
    return { kind: "revision", revisionId: query.revision };
  }
  if (query.asOf !== undefined) {
    const timestamp = new Date(query.asOf);
    if (Number.isNaN(timestamp.getTime())) {
      throw new MapSetValidationError("asOf must be a valid timestamp.");
    }
    return { kind: "as-of", timestamp: timestamp.toISOString() };
  }
  return { kind: "current" };
}

export function registerMapSetRoutes(
  server: FastifyInstance,
  service: MapSetService,
  tileArchive: TileArchiveService,
  options: { maximumTileBytes: number },
): void {
  server.get(
    "/api/map-sets",
    { schema: { response: { 200: MapSetListResponseSchema } } },
    async () => {
      const logicalTileCounts = tileArchive.logicalTileCounts();
      return {
        items: service.list().map((mapSet) => ({
          ...mapSet,
          logicalTileCount: logicalTileCounts.get(mapSet.id) ?? 0,
        })),
      };
    },
  );

  server.get(
    "/api/cache/stats",
    { schema: { response: { 200: TileCacheOverviewStatsSchema } } },
    async () => tileArchive.overview(),
  );

  server.post(
    "/api/cache/audit",
    { schema: { response: { 200: TileCacheOverviewAuditResultSchema } } },
    async () => tileArchive.auditAll(service.list().map(({ id }) => id)),
  );

  server.post<{ Body: MapSetInput; Reply: MapSet }>(
    "/api/map-sets",
    {
      schema: {
        body: MapSetInputSchema,
        response: { 201: MapSetSchema, 400: ErrorResponseSchema },
      },
    },
    async (request, reply) => {
      const mapSet = service.create(request.body);
      return reply
        .code(201)
        .header("location", `api/map-sets/${mapSet.id}`)
        .send(mapSet);
    },
  );

  server.get<{ Params: { id: string }; Reply: MapSet }>(
    "/api/map-sets/:id",
    {
      schema: {
        params: idParametersSchema,
        response: { 200: MapSetSchema, 404: ErrorResponseSchema },
      },
    },
    async (request) => service.get(request.params.id),
  );

  server.patch<{ Params: { id: string }; Body: MapSetPatch; Reply: MapSet }>(
    "/api/map-sets/:id",
    {
      schema: {
        params: idParametersSchema,
        body: MapSetPatchSchema,
        response: {
          200: MapSetSchema,
          400: ErrorResponseSchema,
          404: ErrorResponseSchema,
          409: ErrorResponseSchema,
        },
      },
    },
    async (request) => service.update(request.params.id, request.body),
  );

  server.delete<{ Params: { id: string } }>(
    "/api/map-sets/:id",
    { schema: { params: idParametersSchema } },
    async (request, reply) => {
      await service.delete(request.params.id);
      return reply.code(204).send();
    },
  );

  server.post<{ Params: { id: string } }>(
    "/api/map-sets/:id/test",
    {
      schema: {
        params: idParametersSchema,
        response: {
          200: MapSetTestResponseSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    async (request) => service.test(request.params.id),
  );

  server.get<{
    Params: { id: string; z: number; x: number; y: number };
    Querystring: {
      refresh?: "auto" | "force" | "cache-only";
      displayGeneration?: number;
      snapshot?: string;
      asOf?: string;
      revision?: string;
    };
  }>(
    "/api/map-sets/:id/tiles/:z/:x/:y",
    {
      schema: {
        params: tileParametersSchema,
        querystring: {
          type: "object",
          additionalProperties: false,
          properties: {
            refresh: {
              type: "string",
              enum: ["auto", "force", "cache-only"],
              default: "auto",
            },
            displayGeneration: { type: "integer", minimum: 0 },
            snapshot: { type: "string" },
            asOf: { type: "string" },
            revision: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const response = await service.tile(
          request.params.id,
          {
            zoom: request.params.z,
            x: request.params.x,
            y: request.params.y,
          },
          {
            refresh: request.query.refresh ?? "auto",
            selection: tileSelection(request.query),
          },
        );
        const contentTypeHeader = response.headers["content-type"];
        const contentType = Array.isArray(contentTypeHeader)
          ? contentTypeHeader[0]
          : contentTypeHeader;
        if (contentType !== undefined) {
          reply.type(contentType);
        }
        reply.header("x-maptoy-cache", response.cacheStatus);
        if (response.revisionId !== null) {
          reply.header("x-maptoy-tile-revision", response.revisionId);
        }
        return reply.code(response.statusCode).send(response.body);
      } catch (error) {
        if (
          error instanceof TileArchiveError &&
          error.code === "TILE_NOT_CACHED" &&
          request.query.refresh === "cache-only"
        ) {
          const body = await generateErrorTile({
            type: "no_cache",
            tileSize: service.get(request.params.id).tileSize,
            zoom: request.params.z,
            x: request.params.x,
            y: request.params.y,
          });
          return reply
            .code(200)
            .type("image/png")
            .header("cache-control", "no-store")
            .header("x-maptoy-cache", "miss")
            .send(body);
        }
        if (error instanceof ProviderRequestError) {
          return reply.code(502).send({
            error: { code: error.code, message: error.message },
          });
        }
        throw error;
      }
    },
  );

  server.post<{
    Params: { id: string; z: number; x: number; y: number };
    Body: unknown;
    Reply: TileUploadResponse;
  }>(
    "/api/map-sets/:id/tiles/:z/:x/:y",
    {
      bodyLimit: options.maximumTileBytes,
      schema: {
        params: tileParametersSchema,
        body: TileUploadBodySchema,
        response: {
          200: TileUploadResponseSchema,
          201: TileUploadResponseSchema,
          400: ErrorResponseSchema,
          404: ErrorResponseSchema,
          409: ErrorResponseSchema,
          413: ErrorResponseSchema,
          415: ErrorResponseSchema,
          507: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const contentType = request.headers["content-type"];
      const normalizedContentType = contentType
        ?.split(";", 1)[0]
        ?.trim()
        .toLowerCase();
      let body: Buffer | undefined;
      if (Buffer.isBuffer(request.body)) {
        body = request.body;
      } else if (
        request.body == null &&
        normalizedContentType !== undefined &&
        ["image/png", "image/jpeg", "image/webp"].includes(
          normalizedContentType,
        )
      ) {
        body = Buffer.alloc(0);
      }
      if (body === undefined) {
        throw new TileArchiveError(
          "TILE_MEDIA_TYPE_INVALID",
          "The upload must use an unmodified image body with its image Content-Type.",
          415,
        );
      }
      const result = await service.uploadTile(
        request.params.id,
        {
          zoom: request.params.z,
          x: request.params.x,
          y: request.params.y,
        },
        body,
        contentType,
      );
      return reply
        .code(result.created ? 201 : 200)
        .header("x-maptoy-tile-revision", result.revisionId)
        .send(result);
    },
  );

  server.get<{ Params: { id: string } }>(
    "/api/map-sets/:id/cache/stats",
    {
      schema: {
        params: idParametersSchema,
        response: { 200: TileCacheStatsSchema, 404: ErrorResponseSchema },
      },
    },
    async (request) => {
      service.get(request.params.id);
      return tileArchive.stats(request.params.id);
    },
  );

  server.get<{ Params: { id: string } }>(
    "/api/map-sets/:id/cache/unsupported-zoom-levels",
    {
      schema: {
        params: idParametersSchema,
        response: {
          200: TileCacheUnsupportedZoomInfoSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    async (request) => {
      const mapSet = service.get(request.params.id);
      return tileArchive.unsupportedZoomInfo(
        mapSet.id,
        mapSet.minZoom,
        mapSet.maxZoom,
      );
    },
  );

  server.delete<{ Params: { id: string } }>(
    "/api/map-sets/:id/cache/unsupported-zoom-levels",
    {
      schema: {
        params: idParametersSchema,
        response: {
          200: TileCacheUnsupportedZoomCleanupResultSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    async (request) => {
      const mapSet = service.get(request.params.id);
      return tileArchive.deleteUnsupportedZoomTiles(
        mapSet.id,
        mapSet.minZoom,
        mapSet.maxZoom,
      );
    },
  );

  server.post<{ Params: { id: string } }>(
    "/api/map-sets/:id/cache/audit",
    {
      schema: {
        params: idParametersSchema,
        response: {
          200: TileCacheAuditResultSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    async (request) => {
      service.get(request.params.id);
      return tileArchive.audit(request.params.id);
    },
  );

  server.post<{ Params: { id: string } }>(
    "/api/map-sets/:id/cache/repair",
    {
      schema: {
        params: idParametersSchema,
        response: {
          200: TileCacheRepairResultSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    async (request) => {
      service.get(request.params.id);
      return tileArchive.repair(request.params.id);
    },
  );

  server.get<{
    Params: { id: string };
    Querystring: {
      limit?: number;
      cursor?: string;
      zoom?: number;
      state?: "all" | "current" | "historical";
    };
  }>(
    "/api/map-sets/:id/tile-revisions",
    {
      schema: {
        params: idParametersSchema,
        querystring: {
          type: "object",
          additionalProperties: false,
          properties: {
            limit: {
              type: "integer",
              minimum: 1,
              maximum: 200,
              default: 50,
            },
            cursor: { type: "string", pattern: "^[1-9][0-9]*$" },
            zoom: { type: "integer", minimum: 0, maximum: 24 },
            state: {
              type: "string",
              enum: ["all", "current", "historical"],
              default: "all",
            },
          },
        },
        response: {
          200: TileRevisionListResponseSchema,
          400: ErrorResponseSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    async (request) => {
      service.get(request.params.id);
      const cursor =
        request.query.cursor === undefined
          ? undefined
          : Number(request.query.cursor);
      if (cursor !== undefined && !Number.isSafeInteger(cursor)) {
        throw new MapSetValidationError("The revision cursor is invalid.");
      }
      return tileArchive.revisionPage(request.params.id, {
        limit: request.query.limit ?? 50,
        state: request.query.state ?? "all",
        ...(cursor === undefined ? {} : { cursor }),
        ...(request.query.zoom === undefined
          ? {}
          : { zoom: request.query.zoom }),
      });
    },
  );

  server.delete<{ Params: { id: string; archiveId: string } }>(
    "/api/map-sets/:id/tile-revisions/:archiveId",
    { schema: { params: archiveIdParametersSchema } },
    async (request, reply) => {
      service.get(request.params.id);
      await tileArchive.deleteRevision(
        request.params.id,
        request.params.archiveId,
      );
      return reply.code(204).send();
    },
  );

  server.get<{ Params: { id: string } }>(
    "/api/map-sets/:id/snapshots",
    {
      schema: {
        params: idParametersSchema,
        response: {
          200: CacheSnapshotListResponseSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    async (request) => {
      service.get(request.params.id);
      return { items: tileArchive.listSnapshots(request.params.id) };
    },
  );

  server.post<{
    Params: { id: string };
    Body: CacheSnapshotCreateInput;
  }>(
    "/api/map-sets/:id/snapshots",
    {
      schema: {
        params: idParametersSchema,
        body: CacheSnapshotCreateInputSchema,
        response: {
          201: CacheSnapshotSchema,
          400: ErrorResponseSchema,
          404: ErrorResponseSchema,
          409: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      service.get(request.params.id);
      return reply
        .code(201)
        .send(tileArchive.createSnapshot(request.params.id, request.body.name));
    },
  );

  server.delete<{ Params: { id: string; archiveId: string } }>(
    "/api/map-sets/:id/snapshots/:archiveId",
    { schema: { params: archiveIdParametersSchema } },
    async (request, reply) => {
      service.get(request.params.id);
      tileArchive.deleteSnapshot(request.params.id, request.params.archiveId);
      return reply.code(204).send();
    },
  );

  server.get<{
    Params: { id: string };
    Querystring: { left: string; right: string };
  }>(
    "/api/map-sets/:id/cache/compare",
    {
      schema: {
        params: idParametersSchema,
        querystring: {
          type: "object",
          additionalProperties: false,
          required: ["left", "right"],
          properties: {
            left: { type: "string", minLength: 1 },
            right: { type: "string", minLength: 1 },
          },
        },
        response: {
          200: TileCacheComparisonSchema,
          400: ErrorResponseSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    async (request) => {
      service.get(request.params.id);
      return tileArchive.compare(
        request.params.id,
        request.query.left,
        request.query.right,
      );
    },
  );
}
