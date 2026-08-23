<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
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
      <RouterLink class="brand" to="/" aria-label="maptoy home">maptoy</RouterLink>
      <nav aria-label="Main navigation">
        <RouterLink to="/">Map</RouterLink>
        <RouterLink to="/map-sets">Map Sets</RouterLink>
        <RouterLink to="/cache">Tile Cache</RouterLink>
        <RouterLink to="/docs">Documentation</RouterLink>
      </nav>
    </header>
    <div class="app-viewport">
      <RouterView />
    </div>
  </div>
</template>
