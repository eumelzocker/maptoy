import { describe, expect, it } from "vitest";
import {
  documentationFallbackNotice,
  englishOnlyDocumentationLabel,
  groupDocumentationPages,
  sortDocumentationPages,
} from "./documentationNavigation.js";

describe("documentation navigation", () => {
  it("keeps home first and sorts the other titles case-insensitively", () => {
    const pages = [
      { id: "zoo", title: "Zoo" },
      { id: "beta", title: "beta" },
      { id: "home", title: "maptoy" },
      { id: "apple", title: "apple" },
    ];

    expect(sortDocumentationPages(pages, "en").map(({ id }) => id)).toEqual([
      "home",
      "apple",
      "beta",
      "zoo",
    ]);
    expect(pages.map(({ id }) => id)).toEqual(["zoo", "beta", "home", "apple"]);
  });

  it("uses numeric ordering for titles that contain numbers", () => {
    const pages = [
      { id: "chapter-10", title: "Chapter 10" },
      { id: "chapter-2", title: "chapter 2" },
    ];

    expect(sortDocumentationPages(pages, "en").map(({ id }) => id)).toEqual([
      "chapter-2",
      "chapter-10",
    ]);
  });

  it("provides a localized label for English-only pages", () => {
    expect(englishOnlyDocumentationLabel("de")).toBe(
      "Nur auf Englisch verfügbar",
    );
    expect(englishOnlyDocumentationLabel("th")).toBe("มีเฉพาะภาษาอังกฤษ");
    expect(englishOnlyDocumentationLabel("unknown")).toBe(
      "Available only in English",
    );
  });

  it("explains fallback content in the selected documentation language", () => {
    expect(documentationFallbackNotice("de")).toBe(
      "Diese Seite ist noch nicht übersetzt. Die englische Version wird angezeigt.",
    );
    expect(documentationFallbackNotice("th")).toBe(
      "หน้านี้ยังไม่มีคำแปล กำลังแสดงฉบับภาษาอังกฤษ",
    );
    expect(documentationFallbackNotice("unknown")).toBe(
      "This page is not translated yet. Showing the English version.",
    );
  });

  it("keeps home separate and groups application and general map topics", () => {
    const navigation = groupDocumentationPages(
      [
        { id: "tile-providers", title: "Tile Providers" },
        { id: "screenshots", title: "Screenshots" },
        { id: "home", title: "maptoy" },
        { id: "layers", title: "Layers" },
        { id: "api-reference", title: "API reference" },
        { id: "glossary", title: "Glossary" },
      ],
      "en",
    );

    expect(navigation.home?.id).toBe("home");
    expect(navigation.groups).toEqual([
      {
        id: "about-maptoy",
        pages: [
          { id: "api-reference", title: "API reference" },
          { id: "layers", title: "Layers" },
          { id: "screenshots", title: "Screenshots" },
        ],
      },
      {
        id: "about-maps",
        pages: [
          { id: "glossary", title: "Glossary" },
          { id: "tile-providers", title: "Tile Providers" },
        ],
      },
    ]);
  });
});
