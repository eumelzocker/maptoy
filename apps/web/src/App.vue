<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
// biome-ignore lint/correctness/noUnusedImports: referenced by the Vue template
import { version as appVersion } from "../package.json";
import { useUiPreferencesStore } from "./stores/uiPreferences.js";

const route = useRoute();
const uiPreferences = useUiPreferencesStore();
// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
const showHeader = computed(
  () => route.path !== "/" || uiPreferences.showTitleBar,
);
</script>

<template>
  <div class="shell">
    <header v-if="showHeader" class="topbar">
      <RouterLink class="brand" to="/" aria-label="maptoy home">
        maptoy<span class="brand-version">{{ appVersion }}</span>
      </RouterLink>
      <nav aria-label="Main navigation">
        <RouterLink to="/"><i class="mdi mdi-map-outline" aria-hidden="true"></i>Map</RouterLink>
        <RouterLink to="/map-sets"><i class="mdi mdi-layers-outline" aria-hidden="true"></i>Map Sets</RouterLink>
        <RouterLink to="/cache"><i class="mdi mdi-database-outline" aria-hidden="true"></i>Cache</RouterLink>
        <RouterLink to="/coverage"><i class="mdi mdi-grid" aria-hidden="true"></i>Coverage</RouterLink>
        <RouterLink to="/docs"><i class="mdi mdi-book-open-page-variant-outline" aria-hidden="true"></i>Docs</RouterLink>
      </nav>
    </header>
    <div class="app-viewport">
      <RouterView />
    </div>
  </div>
</template>
