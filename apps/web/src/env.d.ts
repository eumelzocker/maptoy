/// <reference types="vite/client" />

declare module "virtual:maptoy-docs" {
  interface DocumentationLanguage {
    code: string;
    label: string;
  }

  interface DocumentationPage {
    id: string;
    title: string;
    language: string;
    requestedLanguage: string;
    isFallback: boolean;
    html: string;
  }

  interface DocumentationBundle {
    defaultLanguage: string;
    languages: readonly DocumentationLanguage[];
    pages: readonly DocumentationPage[];
  }

  export const documentation: DocumentationBundle;
}
