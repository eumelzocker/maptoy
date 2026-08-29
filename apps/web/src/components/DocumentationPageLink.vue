<script setup lang="ts">
interface DocumentationPageLink {
  id: string;
  title: string;
  isFallback: boolean;
}

defineProps<{
  link: DocumentationPageLink;
  requestedLanguage: string;
  requestedPageId: string;
  englishOnlyLabel: string;
  home?: boolean;
}>();
</script>

<template>
  <RouterLink
    class="docs-page-link"
    :class="{
      'docs-home-link': home,
      'docs-current-page': link.id === requestedPageId,
    }"
    :to="`/docs/${requestedLanguage}/${link.id}`"
    :title="link.isFallback ? englishOnlyLabel : undefined"
    :aria-current="link.id === requestedPageId ? 'page' : undefined"
  >
    <i
      v-if="home"
      class="mdi mdi-map-legend docs-nav-icon"
      aria-hidden="true"
    ></i>
    <span class="docs-link-label">{{ link.title }}</span>
    <span
      v-if="link.isFallback"
      class="docs-fallback-flag"
      :title="englishOnlyLabel"
      aria-hidden="true"
    >
      🇬🇧
    </span>
    <span v-if="link.isFallback" class="visually-hidden">
      — {{ englishOnlyLabel }}
    </span>
  </RouterLink>
</template>
