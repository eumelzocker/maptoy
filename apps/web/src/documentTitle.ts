export function applicationDocumentTitle(
  routeLabel: string | null,
  context: string | null = null,
  detail: string | null = null,
): string {
  return ["maptoy", routeLabel, context, detail]
    .filter((part): part is string => part !== null && part.trim() !== "")
    .join(" - ");
}
