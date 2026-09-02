import {
  ErrorResponseSchema,
  JobSchema,
  type TileDownloadInput,
  TileDownloadEstimateSchema,
  TileDownloadInputSchema,
} from "@maptoy/contracts";
import type { FastifyInstance } from "fastify";
import type { TileDownloadService } from "./service.js";

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

export function registerTileDownloadRoutes(
  server: FastifyInstance,
  downloads: TileDownloadService,
): void {
  server.post<{ Params: { id: string }; Body: TileDownloadInput }>(
    "/api/map-sets/:id/tile-downloads/estimate",
    {
      schema: {
        params: idParametersSchema,
        body: TileDownloadInputSchema,
        response: {
          200: TileDownloadEstimateSchema,
          404: ErrorResponseSchema,
          409: ErrorResponseSchema,
        },
      },
    },
    async (request) => downloads.estimate(request.params.id, request.body),
  );

  server.post<{ Params: { id: string }; Body: TileDownloadInput }>(
    "/api/map-sets/:id/tile-download-jobs",
    {
      schema: {
        params: idParametersSchema,
        body: TileDownloadInputSchema,
        response: {
          201: JobSchema,
          404: ErrorResponseSchema,
          409: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) =>
      reply.code(201).send(downloads.start(request.params.id, request.body)),
  );
}
