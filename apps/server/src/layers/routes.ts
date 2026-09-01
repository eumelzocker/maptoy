import { createReadStream } from "node:fs";
import {
  ErrorResponseSchema,
  PhotoDirectoryListingSchema,
  PhotoDirectoryStatusSchema,
  type PhotoScanJobInput,
  PhotoScanJobInputSchema,
  JobCleanupResponseSchema,
  JobErrorListResponseSchema,
  JobListResponseSchema,
  JobSchema,
  type Layer,
  type LayerAssetPatch,
  LayerAssetPatchSchema,
  LayerAssetSchema,
  LayerAssetImportResponseSchema,
  LayerAssetListResponseSchema,
  type LayerInput,
  LayerInputSchema,
  LayerListResponseSchema,
  type LayerPatch,
  LayerPatchSchema,
  LayerSchema,
} from "@maptoy/contracts";
import type { FastifyInstance } from "fastify";
import type { PhotoScanService } from "./photoScanner.js";
import type { ManagedAssetService } from "./managedAssets.js";
import type { LayerService } from "./service.js";

const idSchema = {
  type: "string",
  pattern:
    "^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$",
} as const;

const idParametersSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id"],
  properties: { id: idSchema },
} as const;

const assetParametersSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "assetId"],
  properties: { id: idSchema, assetId: idSchema },
} as const;

export function registerLayerRoutes(
  server: FastifyInstance,
  layers: LayerService,
  photoScans: PhotoScanService,
  managedAssets: ManagedAssetService,
): void {
  server.get(
    "/api/layers",
    {
      schema: {
        response: { 200: LayerListResponseSchema },
      },
    },
    async () => ({ items: layers.list() }),
  );

  server.post<{ Body: LayerInput; Reply: Layer }>(
    "/api/layers",
    {
      schema: {
        body: LayerInputSchema,
        response: {
          201: LayerSchema,
          400: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const layer = await layers.create(request.body);
      return reply
        .code(201)
        .header("location", `api/layers/${layer.id}`)
        .send(layer);
    },
  );

  server.get<{ Params: { id: string }; Reply: Layer }>(
    "/api/layers/:id",
    {
      schema: {
        params: idParametersSchema,
        response: {
          200: LayerSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    async (request) => layers.get(request.params.id),
  );

  server.patch<{
    Params: { id: string };
    Body: LayerPatch;
    Reply: Layer;
  }>(
    "/api/layers/:id",
    {
      schema: {
        params: idParametersSchema,
        body: LayerPatchSchema,
        response: {
          200: LayerSchema,
          400: ErrorResponseSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    async (request) => layers.update(request.params.id, request.body),
  );

  server.delete<{ Params: { id: string } }>(
    "/api/layers/:id",
    { schema: { params: idParametersSchema } },
    async (request, reply) => {
      layers.get(request.params.id);
      photoScans.assertLayerIdle(request.params.id);
      await Promise.all([
        photoScans.deleteLayerPreviews(request.params.id),
        managedAssets.deleteLayerFiles(request.params.id),
      ]);
      layers.delete(request.params.id);
      return reply.code(204).send();
    },
  );

  server.get<{
    Params: { id: string };
    Querystring: { limit?: number; cursor?: string };
  }>(
    "/api/layers/:id/assets",
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
              maximum: 500,
              default: 200,
            },
            cursor: { type: "string" },
          },
        },
        response: { 200: LayerAssetListResponseSchema },
      },
    },
    async (request) =>
      photoScans.listAssets(
        request.params.id,
        request.query.limit ?? 200,
        request.query.cursor,
      ),
  );

  server.post<{ Params: { id: string } }>(
    "/api/layers/:id/assets",
    {
      schema: {
        params: idParametersSchema,
        response: {
          201: LayerAssetImportResponseSchema,
          400: ErrorResponseSchema,
          404: ErrorResponseSchema,
          413: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const file = await request.file();
      if (file === undefined) {
        return reply.code(400).send({
          error: {
            code: "LAYER_ASSET_REQUIRED",
            message: "A multipart file is required.",
          },
        });
      }
      const result = await managedAssets.import(request.params.id, {
        fileName: file.filename,
        mimeType: file.mimetype,
        bytes: await file.toBuffer(),
      });
      return reply.code(201).send(result);
    },
  );

  server.get<{ Params: { id: string; assetId: string } }>(
    "/api/layers/:id/assets/:assetId",
    { schema: { params: assetParametersSchema } },
    async (request, reply) => {
      const asset = photoScans.getAsset(
        request.params.id,
        request.params.assetId,
      );
      const filePath =
        asset.kind === "managed"
          ? managedAssets.resolveAssetPath(asset)
          : photoScans.previewPath(request.params.id, request.params.assetId);
      return reply
        .type(
          asset.kind === "managed"
            ? (asset.contentType ?? "application/octet-stream")
            : "image/webp",
        )
        .header("cache-control", "private, max-age=3600")
        .header("content-disposition", "inline")
        .send(createReadStream(filePath));
    },
  );

  server.patch<{
    Params: { id: string; assetId: string };
    Body: LayerAssetPatch;
  }>(
    "/api/layers/:id/assets/:assetId",
    {
      schema: {
        params: assetParametersSchema,
        body: LayerAssetPatchSchema,
        response: {
          200: LayerAssetSchema,
          404: ErrorResponseSchema,
          409: ErrorResponseSchema,
        },
      },
    },
    async (request) =>
      photoScans.updateAsset(
        request.params.id,
        request.params.assetId,
        request.body,
      ),
  );

  server.get(
    "/api/photos/directory",
    { schema: { response: { 200: PhotoDirectoryStatusSchema } } },
    async () => photoScans.directory.status(),
  );

  server.get<{ Querystring: { parent?: string } }>(
    "/api/photos/directories",
    {
      schema: {
        querystring: {
          type: "object",
          additionalProperties: false,
          properties: {
            parent: { type: "string", maxLength: 4096, default: "" },
          },
        },
        response: {
          200: PhotoDirectoryListingSchema,
          400: ErrorResponseSchema,
        },
      },
    },
    async (request) =>
      photoScans.directory.directories(request.query.parent ?? ""),
  );

  server.post<{
    Params: { id: string };
    Body: PhotoScanJobInput;
  }>(
    "/api/layers/:id/photo-scan-jobs",
    {
      schema: {
        params: idParametersSchema,
        body: PhotoScanJobInputSchema,
        response: {
          201: JobSchema,
          400: ErrorResponseSchema,
          404: ErrorResponseSchema,
          409: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) =>
      reply.code(201).send(photoScans.start(request.params.id, request.body)),
  );

  server.get(
    "/api/jobs",
    { schema: { response: { 200: JobListResponseSchema } } },
    async () => ({ items: photoScans.listJobs() }),
  );

  server.post(
    "/api/jobs/cleanup",
    { schema: { response: { 200: JobCleanupResponseSchema } } },
    async () => photoScans.cleanupJobs(),
  );

  server.get<{ Params: { id: string } }>(
    "/api/jobs/:id",
    {
      schema: {
        params: idParametersSchema,
        response: { 200: JobSchema, 404: ErrorResponseSchema },
      },
    },
    async (request) => photoScans.getJob(request.params.id),
  );

  server.get<{ Params: { id: string } }>(
    "/api/jobs/:id/errors",
    {
      schema: {
        params: idParametersSchema,
        response: { 200: JobErrorListResponseSchema, 404: ErrorResponseSchema },
      },
    },
    async (request) => ({ items: photoScans.listJobErrors(request.params.id) }),
  );

  for (const [action, invoke] of [
    ["pause", (id: string) => photoScans.pause(id)],
    ["resume", (id: string) => photoScans.resume(id)],
    ["cancel", (id: string) => photoScans.cancel(id)],
  ] as const) {
    server.post<{ Params: { id: string } }>(
      `/api/jobs/:id/${action}`,
      {
        schema: {
          params: idParametersSchema,
          response: {
            200: JobSchema,
            404: ErrorResponseSchema,
            409: ErrorResponseSchema,
          },
        },
      },
      async (request) => invoke(request.params.id),
    );
  }
}
