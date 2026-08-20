import { createPinia } from "pinia";
import { createApp } from "vue";
import { createRouter, createWebHistory } from "vue-router";
import App from "./App.vue";
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
      component: App,
    },
  ],
});

createApp(App).use(createPinia()).use(router).mount("#app");
