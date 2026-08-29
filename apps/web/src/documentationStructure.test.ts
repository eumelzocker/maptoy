import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const documentationRoot = fileURLToPath(
  new URL("../../../docs", import.meta.url),
);

interface DocumentationLanguage {
  code: string;
  label: string;
}

interface LanguageManifest {
  defaultLanguage: string;
  languages: DocumentationLanguage[];
}

interface DocumentationSource {
  filePath: string;
  id: string;
  title: string;
  language: string;
  markdown: string;
}

async function languageManifest(): Promise<LanguageManifest> {
  return JSON.parse(
    await readFile(path.join(documentationRoot, "languages.json"), "utf8"),
  ) as LanguageManifest;
}

function parseDocumentationSource(
  filePath: string,
  source: string,
): DocumentationSource {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (match?.[1] === undefined || match[2] === undefined) {
    throw new Error(`${filePath} has no complete frontmatter block`);
  }

  const fields = new Map<string, string>();
  for (const line of match[1].split(/\r?\n/)) {
    const separator = line.indexOf(":");
    if (separator < 1) {
      throw new Error(`${filePath} contains invalid frontmatter: ${line}`);
    }
    fields.set(
      line.slice(0, separator).trim(),
      line.slice(separator + 1).trim(),
    );
  }

  const id = fields.get("id");
  const title = fields.get("title");
  const language = fields.get("language");
  if (!id || !title || !language) {
    throw new Error(`${filePath} is missing id, title, or language metadata`);
  }

  return { filePath, id, title, language, markdown: match[2] };
}

async function documentationSources(
  manifest: LanguageManifest,
): Promise<DocumentationSource[]> {
  const sources: DocumentationSource[] = [];
  for (const { code } of manifest.languages) {
    const languageRoot = path.join(documentationRoot, code);
    const fileNames = (await readdir(languageRoot))
      .filter((fileName) => fileName.endsWith(".md"))
      .sort();
    for (const fileName of fileNames) {
      const filePath = path.join(languageRoot, fileName);
      sources.push(
        parseDocumentationSource(filePath, await readFile(filePath, "utf8")),
      );
    }
  }
  return sources;
}

describe("documentation source structure", () => {
  it("registers distinct, labeled languages and a valid default", async () => {
    const manifest = await languageManifest();
    const languageCodes = manifest.languages.map(({ code }) => code);

    expect(languageCodes.length).toBeGreaterThan(0);
    expect(new Set(languageCodes).size).toBe(languageCodes.length);
    expect(languageCodes).toContain(manifest.defaultLanguage);
    for (const language of manifest.languages) {
      expect(language.code).toMatch(/^[a-z]{2}(?:-[A-Z]{2})?$/);
      expect(language.label.trim()).not.toBe("");
    }
  });

  it("gives every source valid metadata, one matching H1, and a body", async () => {
    const manifest = await languageManifest();
    const sources = await documentationSources(manifest);
    const pageKeys = new Set<string>();

    expect(sources.length).toBeGreaterThan(0);
    for (const source of sources) {
      expect(source.id, source.filePath).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(source.title.trim(), source.filePath).not.toBe("");
      expect(
        manifest.languages.some(({ code }) => code === source.language),
        source.filePath,
      ).toBe(true);
      expect(source.filePath, source.filePath).toContain(
        `${path.sep}${source.language}${path.sep}`,
      );

      const pageKey = `${source.language}:${source.id}`;
      expect(pageKeys.has(pageKey), source.filePath).toBe(false);
      pageKeys.add(pageKey);

      const levelOneHeadings = [...source.markdown.matchAll(/^# ([^#].*)$/gm)];
      expect(levelOneHeadings, source.filePath).toHaveLength(1);
      expect(levelOneHeadings[0]?.[1]?.trim(), source.filePath).toBe(
        source.title,
      );
      expect(
        source.markdown.replace(/^# [^\r\n]*(?:\r?\n)?/m, "").trim(),
        source.filePath,
      ).not.toBe("");
    }
  });

  it("provides a default-language fallback for every translation", async () => {
    const manifest = await languageManifest();
    const sources = await documentationSources(manifest);
    const defaultPageIds = new Set(
      sources
        .filter(({ language }) => language === manifest.defaultLanguage)
        .map(({ id }) => id),
    );

    expect(defaultPageIds.size).toBeGreaterThan(0);
    for (const source of sources) {
      if (source.language !== manifest.defaultLanguage) {
        expect(defaultPageIds.has(source.id), source.filePath).toBe(true);
      }
    }
  });
});
