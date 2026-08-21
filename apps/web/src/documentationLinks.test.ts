import { describe, expect, it } from "vitest";
import { isExternalDocumentationLink } from "./documentationLinks.js";

describe("documentation links", () => {
  it.each(["https://example.com/docs", "http://example.com/policy"])(
    "recognizes external HTTP links: %s",
    (href) => {
      expect(isExternalDocumentationLink(href)).toBe(true);
    },
  );

  it.each(["docs/en/glossary", "../assets/example.png", "#parameters"])(
    "leaves internal links in the current tab: %s",
    (href) => {
      expect(isExternalDocumentationLink(href)).toBe(false);
    },
  );
});
