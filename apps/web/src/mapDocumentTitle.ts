export function mapDocumentTitle(mapSetName: string | null): string {
  return mapSetName === null ? "maptoy" : `maptoy - ${mapSetName}`;
}
