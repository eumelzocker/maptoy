import { describe, expect, it } from "vitest";
import {
  englishOnlyDocumentationLabel,
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
});
