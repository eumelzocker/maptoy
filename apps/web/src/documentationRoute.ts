export function documentationPageId(value: unknown): string {
  const pageId = Array.isArray(value) ? value[0] : value;

  return typeof pageId === "string" && pageId.length > 0 ? pageId : "home";
}
