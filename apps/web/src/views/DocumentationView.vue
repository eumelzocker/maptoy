<script setup lang="ts">
import { documentation } from "virtual:maptoy-docs";
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { decorateExternalDocumentationLinks } from "../documentationLinks.js";
import {
  englishOnlyDocumentationLabel,
  sortDocumentationPages,
} from "../documentationNavigation.js";
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

const page = computed(() =>
  documentation.pages.find(
    ({ requestedLanguage: language, id }) =>
      language === requestedLanguage.value && id === requestedPageId.value,
  ),
);

// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
const pageLinks = computed(() =>
  sortDocumentationPages(
    documentation.pages.filter(
      ({ requestedLanguage: language }) => language === requestedLanguage.value,
    ),
    requestedLanguage.value,
  ),
);

// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
const englishOnlyLabel = computed(() =>
  englishOnlyDocumentationLabel(requestedLanguage.value),
);

const pageContent = ref<HTMLElement | null>(null);

async function refreshExternalLinks(): Promise<void> {
  await nextTick();
  if (pageContent.value !== null) {
    decorateExternalDocumentationLinks(pageContent.value);
  }
}

watch(page, refreshExternalLinks);
onMounted(refreshExternalLinks);
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
          :class="{ 'docs-home-link': link.id === 'home' }"
          :title="link.isFallback ? englishOnlyLabel : undefined"
        >
          <i
            v-if="link.id === 'home'"
            class="mdi mdi-map-legend docs-nav-icon"
            aria-hidden="true"
          ></i>
          <span>{{ link.title }}</span>
          <i
            v-if="link.isFallback"
            class="mdi mdi-translate-off docs-nav-icon docs-fallback-icon"
            aria-hidden="true"
          ></i>
          <span v-if="link.isFallback" class="visually-hidden">
            — {{ englishOnlyLabel }}
          </span>
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
      <div ref="pageContent" v-html="page.html"></div>
    </article>
    <article v-else class="docs-page">
      <h1>Page not found</h1>
      <p>The requested documentation page does not exist.</p>
    </article>
  </main>
</template>
