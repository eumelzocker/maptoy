import { getItem, setItem } from "./localStorage.js";

const storageKey = "maptoy:docs-language";

export function loadDocumentationLanguage(
  knownLanguageCodes: readonly string[],
  fallback: string,
): string {
  const stored = getItem(storageKey);
  return stored !== null && knownLanguageCodes.includes(stored)
    ? stored
    : fallback;
}

export function saveDocumentationLanguage(language: string): void {
  setItem(storageKey, language);
}
