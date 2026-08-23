import path from "node:path";
import { fileURLToPath } from "node:url";
import vue from "@vitejs/plugin-vue";
import { defineConfig, type Plugin } from "vite";
import {
  copyDocsAssets,
  createDocsAssetsMiddleware,
} from "./build/docsAssets.js";
import { loadDocumentation } from "./build/docs.js";

const virtualDocumentationId = "virtual:maptoy-docs";
const resolvedVirtualDocumentationId = `\0${virtualDocumentationId}`;

function documentationPlugin(): Plugin {
  const docsAssetsRoot = fileURLToPath(
    new URL("../../docs/assets", import.meta.url),
  );
  let outDir = "dist";

  return {
    name: "maptoy-documentation",
    resolveId(id) {
      return id === virtualDocumentationId
        ? resolvedVirtualDocumentationId
        : undefined;
    },
    async load(id) {
      if (id !== resolvedVirtualDocumentationId) {
        return undefined;
      }
      const documentationRoot = fileURLToPath(
        new URL("../../docs", import.meta.url),
      );
      const changelogPath = fileURLToPath(
        new URL("../../CHANGELOG.md", import.meta.url),
      );
      const documentation = await loadDocumentation(documentationRoot, {
        changelogPath,
      });
      return `export const documentation = ${JSON.stringify(documentation)};`;
    },
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    configureServer(server) {
      server.middlewares.use(
        "/docs-assets",
        createDocsAssetsMiddleware(docsAssetsRoot),
      );
    },
    async writeBundle() {
      await copyDocsAssets(docsAssetsRoot, outDir);
    },
  };
}

export default defineConfig({
  base: "./",
  plugins: [documentationPlugin(), vue()],
});
