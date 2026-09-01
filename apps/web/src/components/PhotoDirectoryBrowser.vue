<script setup lang="ts">
// biome-ignore-all lint/correctness/noUnusedImports: Vue template references are not detected by Biome.
// biome-ignore-all lint/correctness/noUnusedVariables: Vue template references are not detected by Biome.
import type { PhotoDirectoryListing } from "@maptoy/contracts";
import { ref, watch } from "vue";
import { apiRequest } from "../api.js";
import DialogWindow from "./DialogWindow.vue";

const props = withDefaults(
  defineProps<{
    open: boolean;
    initialDirectory?: string;
  }>(),
  { initialDirectory: "" },
);

const emit = defineEmits<{
  close: [];
  select: [relativeDirectory: string];
}>();

const listing = ref<PhotoDirectoryListing | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);
let requestGeneration = 0;

async function browse(relativeDirectory: string): Promise<void> {
  const generation = ++requestGeneration;
  loading.value = true;
  error.value = null;
  try {
    const query = new URLSearchParams({ parent: relativeDirectory });
    const loaded = await apiRequest<PhotoDirectoryListing>(
      `api/photos/directories?${query}`,
    );
    if (generation === requestGeneration) listing.value = loaded;
  } catch (cause) {
    if (generation === requestGeneration) {
      error.value =
        cause instanceof Error
          ? cause.message
          : "The photo directories could not be loaded.";
    }
  } finally {
    if (generation === requestGeneration) loading.value = false;
  }
}

function close(): void {
  requestGeneration += 1;
  emit("close");
}

function selectCurrentDirectory(): void {
  const relativeDirectory = listing.value?.relativeDirectory ?? "";
  if (relativeDirectory !== "") emit("select", relativeDirectory);
}

watch(
  () => props.open,
  (open) => {
    if (open) {
      listing.value = null;
      void browse(props.initialDirectory);
    }
  },
  { immediate: true },
);
</script>

<template>
  <DialogWindow
    :open="open"
    title="Select photo directory"
    :content-scrollable="false"
    fit-content
    @close="close"
  >
    <section class="directory-browser" aria-label="Photo directory browser">
      <header>
        <div>
          <span>Current directory</span>
          <strong :title="listing?.relativeDirectory || 'Photo directory root'">
            {{ listing?.relativeDirectory || "/" }}
          </strong>
        </div>
        <div class="navigation-actions">
          <button
            type="button"
            title="Photo directory root"
            aria-label="Go to photo directory root"
            :disabled="loading || listing?.relativeDirectory === ''"
            @click="browse('')"
          >
            <i class="mdi mdi-home-outline" aria-hidden="true"></i>
          </button>
          <button
            type="button"
            title="Parent directory"
            aria-label="Go to parent directory"
            :disabled="loading || listing?.parentDirectory == null"
            @click="listing?.parentDirectory != null && browse(listing.parentDirectory)"
          >
            <i class="mdi mdi-arrow-up" aria-hidden="true"></i>
          </button>
        </div>
      </header>

      <p v-if="error" class="browser-message error" role="alert">{{ error }}</p>
      <p v-else-if="loading" class="browser-message" role="status">Loading directories…</p>
      <div v-else-if="listing" class="directory-list">
        <button
          v-for="directory in listing.items"
          :key="directory.relativePath"
          type="button"
          @click="browse(directory.relativePath)"
        >
          <i class="mdi mdi-folder-outline" aria-hidden="true"></i>
          <span>{{ directory.name }}</span>
          <i class="mdi mdi-chevron-right" aria-hidden="true"></i>
        </button>
        <p v-if="listing.items.length === 0" class="browser-message">
          This directory has no subdirectories.
        </p>
      </div>
      <p v-if="listing?.relativeDirectory === ''" class="root-note">
        Choose a subdirectory. Scanning the configured photo directory root is disabled here.
      </p>
    </section>
    <template #footer>
      <button type="button" class="secondary-button" @click="close">Cancel</button>
      <button
        type="button"
        class="primary-button"
        :disabled="loading || !listing?.relativeDirectory"
        @click="selectCurrentDirectory"
      >
        Scan this directory
      </button>
    </template>
  </DialogWindow>
</template>

<style scoped>
.directory-browser {
  display: grid;
  width: min(32rem, 82vw);
  min-height: min(22rem, 60vh);
  grid-template-rows: auto minmax(8rem, 1fr) auto;
  gap: 0.7rem;
}

.directory-browser > header,
.navigation-actions,
.directory-list button {
  display: flex;
  align-items: center;
}

.directory-browser > header {
  justify-content: space-between;
  gap: 1rem;
}

.directory-browser > header > div:first-child {
  display: grid;
  min-width: 0;
}

.directory-browser > header span,
.root-note,
.browser-message {
  color: #617870;
  font-size: 0.78rem;
}

.directory-browser > header strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.navigation-actions {
  flex: none;
  gap: 0.35rem;
}

.navigation-actions button {
  display: grid;
  width: 2.2rem;
  min-height: 2.2rem;
  padding: 0;
  place-items: center;
}

.directory-list {
  min-height: 0;
  padding: 0.25rem;
  overflow-y: auto;
  border: 1px solid #c8d4cd;
  border-radius: 0.45rem;
}

.directory-list button {
  gap: 0.5rem;
  width: 100%;
  padding: 0.55rem 0.65rem;
  border: 0;
  border-radius: 0.35rem;
  color: #173d35;
  background: transparent;
  font: inherit;
  text-align: left;
}

.directory-list button:hover,
.directory-list button:focus-visible {
  background: #edf4f1;
}

.directory-list button span {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.root-note,
.browser-message {
  margin: 0;
}

.browser-message {
  align-self: center;
  justify-self: center;
}

.browser-message.error {
  color: #a22f26;
}

button {
  border: 1px solid #9aada6;
  border-radius: 0.35rem;
  color: #173d35;
  background: #fff;
  font: inherit;
  cursor: pointer;
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.primary-button,
.secondary-button {
  padding: 0.45rem 0.7rem;
}

.secondary-button:hover,
.secondary-button:focus-visible {
  border-color: #617870;
  background: #edf4f1;
}

.primary-button {
  border-color: #286b5d;
  color: #fff;
  background: #286b5d;
}
</style>
