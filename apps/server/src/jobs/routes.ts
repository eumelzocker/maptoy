import {
  ErrorResponseSchema,
  JobCleanupResponseSchema,
  JobErrorListResponseSchema,
  JobListResponseSchema,
  JobSchema,
} from "@maptoy/contracts";
import type { FastifyInstance } from "fastify";
import type { JobService } from "./service.js";

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

export function registerJobRoutes(
  server: FastifyInstance,
  jobs: JobService,
): void {
  server.get(
    "/api/jobs",
    { schema: { response: { 200: JobListResponseSchema } } },
    async () => ({ items: jobs.list() }),
  );

  server.post(
    "/api/jobs/cleanup",
    { schema: { response: { 200: JobCleanupResponseSchema } } },
    async () => jobs.cleanup(),
  );

  server.get<{ Params: { id: string } }>(
    "/api/jobs/:id",
    {
      schema: {
        params: idParametersSchema,
        response: { 200: JobSchema, 404: ErrorResponseSchema },
      },
    },
    async (request) => jobs.get(request.params.id),
  );

  server.get<{ Params: { id: string } }>(
    "/api/jobs/:id/errors",
    {
      schema: {
        params: idParametersSchema,
        response: { 200: JobErrorListResponseSchema, 404: ErrorResponseSchema },
      },
    },
    async (request) => ({ items: jobs.errors(request.params.id) }),
  );

  for (const [action, invoke] of [
    ["pause", (id: string) => jobs.pause(id)],
    ["resume", (id: string) => jobs.resume(id)],
    ["cancel", (id: string) => jobs.cancel(id)],
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

  server.post<{ Params: { id: string } }>(
    "/api/jobs/:id/retry",
    {
      schema: {
        params: idParametersSchema,
        response: {
          201: JobSchema,
          404: ErrorResponseSchema,
          409: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) =>
      reply.code(201).send(jobs.retry(request.params.id)),
  );
}
