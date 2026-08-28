import { createReadStream } from "node:fs";
import {
  ErrorResponseSchema,
  type ImageScanJobInput,
  ImageScanJobInputSchema,
  ImageRootListResponseSchema,
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
import type { ImageScanService } from "./imageScanner.js";
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
  imageScans: ImageScanService,
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
      imageScans.assertLayerIdle(request.params.id);
      await Promise.all([
        imageScans.deleteLayerPreviews(request.params.id),
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
      imageScans.listAssets(
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
      const asset = imageScans.getAsset(
        request.params.id,
        request.params.assetId,
      );
      const filePath =
        asset.kind === "managed"
          ? managedAssets.resolveAssetPath(asset)
          : imageScans.previewPath(request.params.id, request.params.assetId);
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
      imageScans.updateAsset(
        request.params.id,
        request.params.assetId,
        request.body,
      ),
  );

  server.get(
    "/api/image-roots",
    { schema: { response: { 200: ImageRootListResponseSchema } } },
    async () => ({ items: await imageScans.roots.list() }),
  );

  server.post<{
    Params: { id: string };
    Body: ImageScanJobInput;
  }>(
    "/api/layers/:id/image-scan-jobs",
    {
      schema: {
        params: idParametersSchema,
        body: ImageScanJobInputSchema,
        response: {
          201: JobSchema,
          400: ErrorResponseSchema,
          404: ErrorResponseSchema,
          409: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) =>
      reply.code(201).send(imageScans.start(request.params.id, request.body)),
  );

  server.get(
    "/api/jobs",
    { schema: { response: { 200: JobListResponseSchema } } },
    async () => ({ items: imageScans.listJobs() }),
  );

  server.get<{ Params: { id: string } }>(
    "/api/jobs/:id",
    {
      schema: {
        params: idParametersSchema,
        response: { 200: JobSchema, 404: ErrorResponseSchema },
      },
    },
    async (request) => imageScans.getJob(request.params.id),
  );

  for (const [action, invoke] of [
    ["pause", (id: string) => imageScans.pause(id)],
    ["resume", (id: string) => imageScans.resume(id)],
    ["cancel", (id: string) => imageScans.cancel(id)],
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
