import type { MapSet, MapSetInput } from "@maptoy/contracts";

export function mapSetInput(mapSet: MapSet): MapSetInput {
  const {
    id: _id,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    ...input
  } = JSON.parse(JSON.stringify(mapSet)) as MapSet;
  return input;
}
