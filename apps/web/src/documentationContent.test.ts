import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const documentationRoot = fileURLToPath(
  new URL("../../../docs", import.meta.url),
);

async function documentationPage(
  language: string,
  page:
    | "abbreviations"
    | "glossary"
    | "api-reference"
    | "map-projections"
    | "map-sets"
    | "tile-cache"
    | "tile-providers",
): Promise<string> {
  return readFile(`${documentationRoot}/${language}/${page}.md`, "utf8");
}

describe("glossary documentation", () => {
  it.each([
    ["en", "Abbreviations", "Glossary"],
    ["de", "Abkürzungsverzeichnis", "Glossar"],
    ["th", "รายการคำย่อ", "อภิธานศัพท์"],
  ])(
    "provides complete abbreviation and glossary pages for %s",
    async (language, abbreviationTitle, glossaryTitle) => {
      const abbreviations = await documentationPage(language, "abbreviations");
      const glossary = await documentationPage(language, "glossary");

      expect(abbreviations).toContain("id: abbreviations");
      expect(abbreviations).toContain(`language: ${language}`);
      expect(abbreviations).toContain(`# ${abbreviationTitle}`);
      expect(abbreviations).toContain("| EPSG |");
      expect(abbreviations).toContain("| SSRF |");
      expect(abbreviations).toContain("| XYZ |");

      expect(glossary).toContain("id: glossary");
      expect(glossary).toContain(`language: ${language}`);
      expect(glossary).toContain(`# ${glossaryTitle}`);
      expect(glossary).toContain("## Map Set");
      expect(glossary).toContain("## Tile revision");
      expect(glossary).toContain("## Web Mercator");
    },
  );

  it("documents the binary Tile upload contract and security boundary", async () => {
    const apiReference = await documentationPage("en", "api-reference");
    const tileCache = await documentationPage("en", "tile-cache");

    expect(apiReference).toContain("POST api/map-sets/:id/tiles/:z/:x/:y");
    expect(apiReference).toContain("TILE_BODY_TOO_LARGE");
    expect(apiReference).toContain("does not authenticate API requests");
    expect(tileCache).toContain("MAPTOY_MAX_TILE_BYTES");
    expect(tileCache).toContain("origin `upload`");
    expect(tileCache).toContain("reverse proxy must authenticate");
  });

  it.each(["en", "de"])(
    "provides a localized tile-provider reference for %s",
    async (language) => {
      const providers = await documentationPage(language, "tile-providers");

      expect(providers).toContain("id: tile-providers");
      expect(providers).toContain(`language: ${language}`);
      expect(providers).toContain("## OpenStreetMap Standard");
      expect(providers).toContain("## MapTiler Cloud");
      expect(providers).toContain("## Google Maps");
      expect(providers).toContain("https://");
    },
  );

  it.each([
    ["en", "Map Projections", "Planned initial maptoy support"],
    [
      "de",
      "Kartenprojektionen",
      "Geplante anfängliche Unterstützung in maptoy",
    ],
  ])(
    "provides a localized map-projection overview for %s",
    async (language, title, supportTitle) => {
      const projections = await documentationPage(language, "map-projections");

      expect(projections).toContain("id: map-projections");
      expect(projections).toContain(`language: ${language}`);
      expect(projections).toContain(`# ${title}`);
      expect(projections).toContain(`## ${supportTitle}`);
      expect(projections).toContain("`EPSG:3857`");
      expect(projections).toContain("`EPSG:4326`");
      expect(projections).toContain("`EPSG:25833`");
      expect(projections).toContain("https://epsg.org/");
    },
  );

  it.each([
    ["en", "Secrets and request headers", "Provider test"],
    ["de", "Secrets und Request-Header", "Provider testen"],
  ])(
    "documents Map Set configuration and secret handling for %s",
    async (language, secretsTitle, testTitle) => {
      const mapSets = await documentationPage(language, "map-sets");
      expect(mapSets).toContain("id: map-sets");
      expect(mapSets).toContain(`language: ${language}`);
      expect(mapSets).toContain(`## ${secretsTitle}`);
      expect(mapSets).toContain(`## ${testTitle}`);
      expect(mapSets).toContain("$" + "{MAPTOY_EXAMPLE_API_KEY}");
      expect(mapSets).toContain("MAPTOY_ALLOW_PRIVATE_TILE_HOSTS");
      expect(mapSets).toContain("api/map-sets/:id/tiles/:z/:x/:y");
    },
  );
});
