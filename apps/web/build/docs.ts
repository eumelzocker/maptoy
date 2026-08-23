import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { marked } from "marked";
import sanitizeHtml from "sanitize-html";

export interface DocumentationLanguage {
  code: string;
  label: string;
}

export interface DocumentationPage {
  id: string;
  title: string;
  language: string;
  requestedLanguage: string;
  isFallback: boolean;
  html: string;
}

export interface DocumentationBundle {
  defaultLanguage: string;
  languages: readonly DocumentationLanguage[];
  pages: readonly DocumentationPage[];
}

interface LanguageManifest {
  defaultLanguage: string;
  languages: DocumentationLanguage[];
}

export interface DocumentationBuildOptions {
  changelogPath?: string;
}

interface Frontmatter {
  id: string;
  title: string;
  language: string;
}

function invariant(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(`Documentation build failed: ${message}`);
  }
}

function parseFrontmatter(
  source: string,
  filePath: string,
): {
  frontmatter: Frontmatter;
  markdown: string;
} {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  invariant(match !== null, `${filePath} has no frontmatter`);
  const frontmatterSource = match[1];
  const markdown = match[2];
  invariant(
    frontmatterSource !== undefined && markdown !== undefined,
    `${filePath} contains incomplete frontmatter`,
  );
  const fields = new Map<string, string>();
  for (const line of frontmatterSource.split(/\r?\n/)) {
    const separator = line.indexOf(":");
    invariant(separator > 0, `${filePath} contains invalid frontmatter`);
    fields.set(
      line.slice(0, separator).trim(),
      line.slice(separator + 1).trim(),
    );
  }
  const id = fields.get("id");
  const title = fields.get("title");
  const language = fields.get("language");
  invariant(id !== undefined && id.length > 0, `${filePath} has no id`);
  invariant(
    title !== undefined && title.length > 0,
    `${filePath} has no title`,
  );
  invariant(
    language !== undefined && language.length > 0,
    `${filePath} has no language`,
  );
  return {
    frontmatter: { id, title, language },
    markdown,
  };
}

const relativeImageSourcePattern =
  /^(?![a-zA-Z][a-zA-Z0-9+.-]*:)(?!\/\/)(?!\/)/;

const supportedCalloutTypes = new Set(["clipcopy"]);

export function renderMarkdown(markdown: string): string {
  const rendered = marked.parse(markdown, { async: false }) as string;
  return sanitizeHtml(rendered, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img"]),
    allowedAttributes: {
      a: ["href", "title"],
      img: ["alt", "src", "title", "width", "height"],
      code: ["class"],
      h1: ["id"],
      h2: ["id"],
      h3: ["id"],
      h4: ["id"],
      h5: ["id"],
      h6: ["id"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowProtocolRelative: false,
    transformTags: {
      img: (tagName, attribs) => {
        const src = attribs.src;
        if (typeof src === "string" && relativeImageSourcePattern.test(src)) {
          const basename = src.split("/").pop();
          if (basename !== undefined && basename.length > 0) {
            return {
              tagName,
              // Keep the asset URL relative to the injected application base
              // so documentation also works behind a reverse-proxy subpath.
              attribs: { ...attribs, src: `./docs-assets/${basename}` },
            };
          }
        }
        return { tagName, attribs };
      },
      // Custom `<callout type="...">` markdown tags let doc authors opt into
      // small, purpose-built widgets without inventing new Markdown syntax.
      // Unknown/missing types degrade to an unstyled <span> so the text
      // content is never silently dropped.

      // Type callout is now obsolete because of new `` style !
      // Stays for demo purpose.
      callout: (_tagName, attribs) => {
        const type = attribs.type;
        if (typeof type === "string" && supportedCalloutTypes.has(type)) {
          return {
            tagName: "code",
            attribs: { class: `docs-callout docs-callout--${type}` },
          };
        }
        return { tagName: "span", attribs: {} };
      },
    },
  });
}

async function readLanguageManifest(
  documentationRoot: string,
): Promise<LanguageManifest> {
  const content = await readFile(
    path.join(documentationRoot, "languages.json"),
    "utf8",
  );
  const manifest = JSON.parse(content) as LanguageManifest;
  invariant(
    Array.isArray(manifest.languages) && manifest.languages.length > 0,
    "language manifest is empty",
  );
  const languageCodes = new Set(manifest.languages.map(({ code }) => code));
  invariant(
    languageCodes.size === manifest.languages.length,
    "language manifest contains duplicate codes",
  );
  invariant(
    languageCodes.has(manifest.defaultLanguage),
    "default language is not registered",
  );
  invariant(
    manifest.defaultLanguage === "en",
    "English must remain the default fallback language",
  );
  return manifest;
}

export async function loadDocumentation(
  documentationRoot: string,
  options: DocumentationBuildOptions = {},
): Promise<DocumentationBundle> {
  const manifest = await readLanguageManifest(documentationRoot);
  const sourcePages: DocumentationPage[] = [];

  for (const { code } of manifest.languages) {
    const languageRoot = path.join(documentationRoot, code);
    const fileNames = (await readdir(languageRoot))
      .filter((fileName) => fileName.endsWith(".md"))
      .sort();
    for (const fileName of fileNames) {
      const filePath = path.join(languageRoot, fileName);
      const { frontmatter, markdown } = parseFrontmatter(
        await readFile(filePath, "utf8"),
        filePath,
      );
      invariant(
        frontmatter.language === code,
        `${filePath} declares language ${frontmatter.language}`,
      );
      sourcePages.push({
        ...frontmatter,
        requestedLanguage: code,
        isFallback: false,
        html: renderMarkdown(markdown),
      });
    }
  }

  if (options.changelogPath !== undefined) {
    sourcePages.push({
      id: "changelog",
      title: "Changelog",
      language: manifest.defaultLanguage,
      requestedLanguage: manifest.defaultLanguage,
      isFallback: false,
      html: renderMarkdown(await readFile(options.changelogPath, "utf8")),
    });
  }

  const pageKeys = new Set<string>();
  for (const page of sourcePages) {
    const key = `${page.language}:${page.id}`;
    invariant(!pageKeys.has(key), `duplicate page id ${key}`);
    pageKeys.add(key);
  }

  const englishPages = sourcePages.filter(
    ({ language }) => language === manifest.defaultLanguage,
  );
  invariant(englishPages.length > 0, "English documentation is empty");
  for (const page of sourcePages) {
    invariant(
      page.language === manifest.defaultLanguage ||
        englishPages.some(({ id }) => id === page.id),
      `${page.language}:${page.id} has no English fallback`,
    );
  }

  const pages = [...sourcePages];
  for (const { code } of manifest.languages) {
    if (code === manifest.defaultLanguage) {
      continue;
    }
    for (const englishPage of englishPages) {
      if (
        pages.some(
          ({ id, language }) => id === englishPage.id && language === code,
        )
      ) {
        continue;
      }
      pages.push({
        ...englishPage,
        language: manifest.defaultLanguage,
        requestedLanguage: code,
        isFallback: true,
      });
    }
  }

  return {
    defaultLanguage: manifest.defaultLanguage,
    languages: manifest.languages,
    pages,
  };
}
