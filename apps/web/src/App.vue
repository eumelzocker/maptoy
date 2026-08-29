<script setup lang="ts">
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
// biome-ignore lint/correctness/noUnusedImports: referenced by the Vue template
import { version as appVersion } from "../package.json";
import {
  applicationViewForPath,
  applicationViews,
  isApplicationViewActive,
} from "./applicationViews.js";
// biome-ignore lint/correctness/noUnusedImports: referenced by the Vue template
import AppMenuSelect from "./components/AppMenuSelect.vue";
import type { MenuItem } from "./menuModels.js";
import { useUiPreferencesStore } from "./stores/uiPreferences.js";

const route = useRoute();
const router = useRouter();
const uiPreferences = useUiPreferencesStore();
// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
const showHeader = computed(
  () => route.path !== "/" || uiPreferences.showTitleBar,
);
// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
const activeView = computed(() => applicationViewForPath(route.path));
// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
const navigationViews = computed(() =>
  applicationViews.map((view) => ({
    ...view,
    active: isApplicationViewActive(view, route.path),
  })),
);
// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
const navigationMenuItems = computed<MenuItem[]>(() =>
  applicationViews.map((view) => ({
    id: view.id,
    label: view.label,
    icon: view.icon,
  })),
);

// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
function selectApplicationView(viewId: string): void {
  const view = applicationViews.find(({ id }) => id === viewId);
  if (view !== undefined) {
    void router.push(view.path);
  }
}
</script>

<template>
  <div class="shell">
    <header v-if="showHeader" class="topbar">
      <RouterLink class="brand" to="/" aria-label="maptoy home">
        maptoy<span class="brand-version">{{ appVersion }}</span>
      </RouterLink>
      <nav class="desktop-navigation" aria-label="Main navigation">
        <RouterLink
          v-for="view in navigationViews"
          :key="view.id"
          :to="view.path"
          :class="{ 'active-view': view.active }"
          :aria-current="view.active ? 'page' : undefined"
        >
          <i class="mdi" :class="view.icon" aria-hidden="true"></i>
          {{ view.label }}
        </RouterLink>
      </nav>
      <div class="mobile-navigation">
        <AppMenuSelect
          :model-value="activeView?.id ?? ''"
          :items="navigationMenuItems"
          aria-label="Select view"
          placeholder="Select view"
          variant="topbar"
          @update:model-value="selectApplicationView"
        />
      </div>
    </header>
    <div class="app-viewport">
      <RouterView />
    </div>
  </div>
</template>

<style scoped>
.desktop-navigation {
  display: flex;
  gap: 0.25rem;
  align-items: center;
}

.desktop-navigation a {
  display: inline-flex;
  gap: 0.4rem;
  align-items: center;
  min-height: 2.4rem;
  padding: 0.45rem 0.65rem;
  border-radius: 0.45rem;
  text-decoration: none;
  transition:
    color 0.15s ease,
    background 0.15s ease;
}

.desktop-navigation a:hover {
  color: #fff;
  background: rgb(255 255 255 / 13%);
}

.desktop-navigation a:focus-visible,
.brand:focus-visible {
  outline: 2px solid #f2c96e;
  outline-offset: 2px;
}

.desktop-navigation a.active-view {
  color: #9fd8c2;
  background: transparent;
  font-weight: 750;
}

.desktop-navigation a.active-view:hover {
  color: #c1ead9;
  background: rgb(255 255 255 / 13%);
}

.desktop-navigation a i {
  font-size: 1.1rem;
}

.mobile-navigation {
  display: none;
}

@media (max-width: 56rem) {
  .desktop-navigation {
    display: none;
  }

  .mobile-navigation {
    display: block;
    min-width: 0;
  }
}
</style>
