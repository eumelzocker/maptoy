import { createPinia } from "pinia";
import { createApp } from "vue";
import { createRouter, createWebHistory } from "vue-router";
import App from "./App.vue";
import {
  layerPluginRegistry,
  LAYER_PLUGIN_REGISTRY_KEY,
  mapRendererFactoryRegistry,
  MAP_RENDERER_FACTORY_REGISTRY_KEY,
  mapRendererRegistry,
  MAP_RENDERER_REGISTRY_KEY,
} from "./registries.js";
import DocumentationView from "./views/DocumentationView.vue";
import MapSetsView from "./views/MapSetsView.vue";
import MapView from "./views/MapView.vue";
import TileCacheView from "./views/TileCacheView.vue";
import "@mdi/font/css/materialdesignicons.css";
import "@maptoy/leaflet-xyz/style.css";
import "./style.css";

function applicationBasePath(): string {
  const path = new URL(document.baseURI).pathname;
  return path.endsWith("/") ? path : `${path}/`;
}

const router = createRouter({
  history: createWebHistory(applicationBasePath()),
  routes: [
    {
      path: "/",
      component: MapView,
    },
    {
      path: "/map-sets",
      component: MapSetsView,
    },
    {
      path: "/cache",
      component: TileCacheView,
    },
    {
      path: "/docs",
      redirect: "/docs/en",
    },
    {
      path: "/docs/:language/:pageId?",
      component: DocumentationView,
    },
  ],
});

createApp(App)
  .provide(MAP_RENDERER_REGISTRY_KEY, mapRendererRegistry)
  .provide(MAP_RENDERER_FACTORY_REGISTRY_KEY, mapRendererFactoryRegistry)
  .provide(LAYER_PLUGIN_REGISTRY_KEY, layerPluginRegistry)
  .use(createPinia())
  .use(router)
  .mount("#app");
