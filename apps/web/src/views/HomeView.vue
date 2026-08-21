<script setup lang="ts">
import { onMounted, ref } from "vue";

type HealthState = "checking" | "healthy" | "unavailable";

const health = ref<HealthState>("checking");

onMounted(async () => {
  try {
    const response = await fetch(new URL("api/health", document.baseURI));
    health.value = response.ok ? "healthy" : "unavailable";
  } catch {
    health.value = "unavailable";
  }
});
</script>

<template>
  <main class="home">
    <section class="hero">
      <p class="eyebrow">Self-hosted map workshop</p>
      <h1>Your maps, revisions, and exports in one place.</h1>
      <p class="intro">
        The Phase 1 application shell is running. Map Sets and the Leaflet renderer
        will be connected in the next implementation phase.
      </p>
      <div class="status" :data-state="health">
        <span aria-hidden="true"></span>
        Server: {{ health }}
      </div>
    </section>

    <section class="canvas" aria-label="Map placeholder">
      <div class="grid"></div>
      <p>Map canvas</p>
    </section>
  </main>
</template>
