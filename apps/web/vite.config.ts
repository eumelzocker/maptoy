import { fileURLToPath } from "node:url";
import vue from "@vitejs/plugin-vue";
import { defineConfig, type Plugin } from "vite";
import { loadDocumentation } from "./build/docs.js";

const virtualDocumentationId = "virtual:maptoy-docs";
const resolvedVirtualDocumentationId = `\0${virtualDocumentationId}`;

function documentationPlugin(): Plugin {
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
      const documentation = await loadDocumentation(documentationRoot);
      return `export const documentation = ${JSON.stringify(documentation)};`;
    },
  };
}

export default defineConfig({
  base: "./",
  plugins: [documentationPlugin(), vue()],
});
