import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadDocumentation, renderMarkdown } from "./docs.js";

const documentationRoot = fileURLToPath(
  new URL("../../../docs", import.meta.url),
);
const changelogPath = fileURLToPath(
  new URL("../../../CHANGELOG.md", import.meta.url),
);

function loadProjectDocumentation() {
  return loadDocumentation(documentationRoot, { changelogPath });
}

describe("documentation build", () => {
  it("builds all languages and falls back to English per page", async () => {
    const documentation = await loadProjectDocumentation();
    expect(documentation.languages.map(({ code }) => code)).toEqual([
      "en",
      "de",
      "th",
    ]);
    expect(
      documentation.pages.find(
        ({ id, requestedLanguage }) =>
          id === "getting-started" && requestedLanguage === "de",
      ),
    ).toMatchObject({ language: "de", isFallback: false });
    expect(
      documentation.pages.find(
        ({ id, requestedLanguage }) =>
          id === "home" && requestedLanguage === "de",
      ),
    ).toMatchObject({ language: "de", isFallback: false });
  });

  it("includes the repository changelog as an English documentation page", async () => {
    const documentation = await loadProjectDocumentation();
    const englishChangelog = documentation.pages.find(
      ({ id, requestedLanguage }) =>
        id === "changelog" && requestedLanguage === "en",
    );
    const germanChangelog = documentation.pages.find(
      ({ id, requestedLanguage }) =>
        id === "changelog" && requestedLanguage === "de",
    );

    expect(englishChangelog).toMatchObject({
      title: "Changelog",
      language: "en",
      isFallback: false,
    });
    expect(englishChangelog?.html).toContain("<h1>Changelog</h1>");
    expect(englishChangelog?.html).toContain("0.0.1");
    expect(germanChangelog).toMatchObject({
      language: "en",
      isFallback: true,
    });
  });

  it("emits sanitized HTML", async () => {
    const documentation = await loadProjectDocumentation();
    const home = documentation.pages.find(
      ({ id, requestedLanguage }) =>
        id === "home" && requestedLanguage === "en",
    );
    expect(home?.html).toContain("<h1>maptoy</h1>");
    expect(home?.html).not.toContain("<script");
    expect(path.isAbsolute(documentationRoot)).toBe(true);
  });

  it("rewrites relative documentation image sources to a base-relative path", async () => {
    const documentation = await loadProjectDocumentation();
    const mapProjections = documentation.pages.find(
      ({ id, requestedLanguage }) =>
        id === "map-projections" && requestedLanguage === "en",
    );
    expect(mapProjections?.html).toContain('src="./docs-assets/eqearth.png"');
    expect(mapProjections?.html).not.toContain("../assets/eqearth.png");
  });

  it("rewrites a supported callout type to a styled code element", () => {
    const html = renderMarkdown('<callout type="clipcopy">EPSG:3857</callout>');
    expect(html).toContain(
      '<code class="docs-callout docs-callout--clipcopy">EPSG:3857</code>',
    );
  });

  it.each([
    '<callout type="unsupported">text</callout>',
    "<callout>text</callout>",
  ])("falls back to a plain span for %s", (markdown) => {
    const html = renderMarkdown(markdown);
    expect(html).toContain("<span>text</span>");
    expect(html).not.toContain("<callout");
  });
});
