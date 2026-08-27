interface DocumentationNavigationPage {
  id: string;
  title: string;
}

const englishOnlyLabels: Readonly<Record<string, string>> = {
  de: "Nur auf Englisch verfügbar",
  en: "Available only in English",
  th: "มีเฉพาะภาษาอังกฤษ",
};

const maptoyApplicationDocumentationPageIds = new Set([
  "api-reference",
  "changelog",
  "getting-started",
  "map-sets",
  "tile-cache",
]);

export function isMaptoyApplicationDocumentationPage(id: string): boolean {
  return maptoyApplicationDocumentationPageIds.has(id);
}

export function englishOnlyDocumentationLabel(language: string): string {
  return englishOnlyLabels[language] ?? englishOnlyLabels.en ?? "English only";
}

export function sortDocumentationPages<
  Page extends DocumentationNavigationPage,
>(pages: readonly Page[], language: string): Page[] {
  const collator = new Intl.Collator(language, {
    numeric: true,
    sensitivity: "base",
  });

  return [...pages].sort((left, right) => {
    if (left.id === "home") {
      return right.id === "home" ? 0 : -1;
    }
    if (right.id === "home") {
      return 1;
    }
    return collator.compare(left.title, right.title);
  });
}
