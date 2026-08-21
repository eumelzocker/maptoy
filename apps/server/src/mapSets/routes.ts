import {
  ErrorResponseSchema,
  type MapSet,
  type MapSetInput,
  MapSetInputSchema,
  MapSetListResponseSchema,
  type MapSetPatch,
  MapSetPatchSchema,
  MapSetSchema,
  MapSetTestResponseSchema,
} from "@maptoy/contracts";
import type { FastifyInstance } from "fastify";
import { ProviderRequestError } from "../providerClient.js";
import type { MapSetService } from "./service.js";

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

export function registerMapSetRoutes(
  server: FastifyInstance,
  service: MapSetService,
): void {
  server.get(
    "/api/map-sets",
    { schema: { response: { 200: MapSetListResponseSchema } } },
    async () => ({ items: service.list() }),
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
        },
      },
    },
    async (request) => service.update(request.params.id, request.body),
  );

  server.delete<{ Params: { id: string } }>(
    "/api/map-sets/:id",
    { schema: { params: idParametersSchema } },
    async (request, reply) => {
      service.delete(request.params.id);
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
  }>(
    "/api/map-sets/:id/tiles/:z/:x/:y",
    { schema: { params: tileParametersSchema } },
    async (request, reply) => {
      try {
        const response = await service.tile(request.params.id, {
          zoom: request.params.z,
          x: request.params.x,
          y: request.params.y,
        });
        const contentTypeHeader = response.headers["content-type"];
        const contentType = Array.isArray(contentTypeHeader)
          ? contentTypeHeader[0]
          : contentTypeHeader;
        if (contentType !== undefined) {
          reply.type(contentType);
        }
        return reply.code(response.statusCode).send(response.body);
      } catch (error) {
        if (error instanceof ProviderRequestError) {
          return reply.code(502).send({
            error: { code: error.code, message: error.message },
          });
        }
        throw error;
      }
    },
  );
}
