interface DocumentationNavigationPage {
  id: string;
  title: string;
}

export type DocumentationNavigationGroupId = "about-maptoy" | "about-maps";

export interface DocumentationNavigationGroup<
  Page extends DocumentationNavigationPage,
> {
  id: DocumentationNavigationGroupId;
  pages: Page[];
}

export interface GroupedDocumentationNavigation<
  Page extends DocumentationNavigationPage,
> {
  home: Page | undefined;
  groups: DocumentationNavigationGroup<Page>[];
}

const englishOnlyLabels: Readonly<Record<string, string>> = {
  de: "Nur auf Englisch verfügbar",
  en: "Available only in English",
  th: "มีเฉพาะภาษาอังกฤษ",
};

const fallbackNoticeLabels: Readonly<Record<string, string>> = {
  de: "Diese Seite ist noch nicht übersetzt. Die englische Version wird angezeigt.",
  en: "This page is not translated yet. Showing the English version.",
  th: "หน้านี้ยังไม่มีคำแปล กำลังแสดงฉบับภาษาอังกฤษ",
};

const aboutMaptoyDocumentationPageIds = new Set([
  "api-reference",
  "changelog",
  "getting-started",
  "layers",
  "map-sets",
  "screenshots",
  "tile-cache",
]);

export function englishOnlyDocumentationLabel(language: string): string {
  return englishOnlyLabels[language] ?? englishOnlyLabels.en ?? "English only";
}

export function documentationFallbackNotice(language: string): string {
  return (
    fallbackNoticeLabels[language] ??
    fallbackNoticeLabels.en ??
    "Showing the English version."
  );
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

export function groupDocumentationPages<
  Page extends DocumentationNavigationPage,
>(
  pages: readonly Page[],
  language: string,
): GroupedDocumentationNavigation<Page> {
  const sortedPages = sortDocumentationPages(pages, language);
  const groupedPages = sortedPages.filter(({ id }) => id !== "home");

  return {
    home: sortedPages.find(({ id }) => id === "home"),
    groups: [
      {
        id: "about-maptoy",
        pages: groupedPages.filter(({ id }) =>
          aboutMaptoyDocumentationPageIds.has(id),
        ),
      },
      {
        id: "about-maps",
        pages: groupedPages.filter(
          ({ id }) => !aboutMaptoyDocumentationPageIds.has(id),
        ),
      },
    ],
  };
}
