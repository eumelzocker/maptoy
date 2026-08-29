<script setup lang="ts">
import { documentation } from "virtual:maptoy-docs";
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
// biome-ignore lint/correctness/noUnusedImports: referenced by the Vue template
import DocumentationPageLink from "../components/DocumentationPageLink.vue";
import { decorateClipCopyCallouts } from "../documentationClipCopy.js";
import { saveDocumentationLanguage } from "../documentationLanguage.js";
import { decorateExternalDocumentationLinks } from "../documentationLinks.js";
import {
  documentationFallbackNotice,
  englishOnlyDocumentationLabel,
  groupDocumentationPages,
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
const pageNavigation = computed(() =>
  groupDocumentationPages(
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
// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
const fallbackNotice = computed(() =>
  documentationFallbackNotice(requestedLanguage.value),
);

const pageContent = ref<HTMLElement | null>(null);

async function decorateDocumentationContent(): Promise<void> {
  await nextTick();
  if (pageContent.value !== null) {
    decorateExternalDocumentationLinks(pageContent.value);
    decorateClipCopyCallouts(pageContent.value);
  }
}

watch(page, decorateDocumentationContent);
onMounted(decorateDocumentationContent);

watch(requestedLanguage, saveDocumentationLanguage, { immediate: true });
</script>

<template>
  <main class="documentation">
    <aside class="docs-sidebar">
      <p class="eyebrow">Documentation</p>
      <nav aria-label="Documentation pages">
        <DocumentationPageLink
          v-if="pageNavigation.home"
          :link="pageNavigation.home"
          :requested-language="requestedLanguage"
          :requested-page-id="requestedPageId"
          :english-only-label="englishOnlyLabel"
          home
        />
        <details
          v-for="group in pageNavigation.groups"
          :key="group.id"
          class="docs-nav-group"
          open
        >
          <summary>
            <i
              class="mdi mdi-chevron-right docs-nav-group-chevron"
              aria-hidden="true"
            ></i>
            <span v-if="group.id === 'about-maptoy'">About <em>maptoy</em></span>
            <span v-else>About Maps, the Universe, and Everything</span>
          </summary>
          <div class="docs-nav-group-links">
            <DocumentationPageLink
              v-for="link in group.pages"
              :key="link.id"
              :link="link"
              :requested-language="requestedLanguage"
              :requested-page-id="requestedPageId"
              :english-only-label="englishOnlyLabel"
            />
          </div>
        </details>
      </nav>
      <div class="language-switcher" aria-label="Documentation language">
        <RouterLink
          v-for="language in documentation.languages"
          :key="language.code"
          :lang="language.code"
          :to="`/docs/${language.code}/${requestedPageId}`"
          :class="{
            'docs-current-language': language.code === requestedLanguage,
          }"
          :aria-current="
            language.code === requestedLanguage ? 'true' : undefined
          "
        >
          <span>{{ language.label }}</span>
        </RouterLink>
      </div>
    </aside>

    <article v-if="page" class="docs-page">
      <p v-if="page.isFallback" class="fallback-notice" role="status">
        {{ fallbackNotice }}
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
