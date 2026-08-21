import { type Static, Type } from "@sinclair/typebox";

export const HealthResponseSchema = Type.Object(
  {
    status: Type.Literal("ok"),
  },
  { $id: "HealthResponse" },
);

export type HealthResponse = Static<typeof HealthResponseSchema>;

export const ReadyResponseSchema = Type.Object(
  {
    status: Type.Union([Type.Literal("ready"), Type.Literal("not-ready")]),
  },
  { $id: "ReadyResponse" },
);

export type ReadyResponse = Static<typeof ReadyResponseSchema>;
