<script setup lang="ts">
import { documentation } from "virtual:maptoy-docs";
import { computed } from "vue";
import { useRoute } from "vue-router";
import { documentationPageId } from "../documentationRoute.js";

const route = useRoute();

const requestedLanguage = computed(() => {
  const language = String(
    route.params.language ?? documentation.defaultLanguage,
  );
  return documentation.languages.some(({ code }) => code === language)
    ? language
    : documentation.defaultLanguage;
});

const requestedPageId = computed(() =>
  documentationPageId(route.params.pageId),
);

// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
const page = computed(() =>
  documentation.pages.find(
    ({ requestedLanguage: language, id }) =>
      language === requestedLanguage.value && id === requestedPageId.value,
  ),
);

// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
const pageLinks = computed(() =>
  documentation.pages.filter(
    ({ requestedLanguage: language }) => language === requestedLanguage.value,
  ),
);
</script>

<template>
  <main class="documentation">
    <aside class="docs-sidebar">
      <p class="eyebrow">Documentation</p>
      <nav aria-label="Documentation pages">
        <RouterLink
          v-for="link in pageLinks"
          :key="link.id"
          :to="`/docs/${requestedLanguage}/${link.id}`"
        >
          {{ link.title }}
        </RouterLink>
      </nav>
      <div class="language-switcher" aria-label="Documentation language">
        <RouterLink
          v-for="language in documentation.languages"
          :key="language.code"
          :lang="language.code"
          :to="`/docs/${language.code}/${requestedPageId}`"
        >
          {{ language.label }}
        </RouterLink>
      </div>
    </aside>

    <article v-if="page" class="docs-page">
      <p v-if="page.isFallback" class="fallback-notice" role="status">
        This page is not translated yet. Showing the English version.
      </p>
      <!-- The documentation build sanitizes this repository-owned HTML. -->
      <div v-html="page.html"></div>
    </article>
    <article v-else class="docs-page">
      <h1>Page not found</h1>
      <p>The requested documentation page does not exist.</p>
    </article>
  </main>
</template>
