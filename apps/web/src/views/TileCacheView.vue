<script setup lang="ts">
import type {
  CacheSnapshot,
  CacheSnapshotListResponse,
  TileCacheAuditResult,
  TileCacheComparison,
  TileCacheMapSetAuditResult,
  TileCacheOverviewAuditResult,
  TileCacheOverviewStats,
  TileCacheRepairResult,
  TileCacheStats,
  TileRevisionListResponse,
  TileRevisionSummary,
} from "@maptoy/contracts";
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { apiRequest } from "../api.js";
// biome-ignore lint/correctness/noUnusedImports: referenced by the Vue template
import HtmlTooltip from "../components/HtmlTooltip.vue";
// biome-ignore lint/correctness/noUnusedImports: referenced by the Vue template
import MapSetSelect from "../components/MapSetSelect.vue";
import { useMapSetsStore } from "../stores/mapSets.js";

const mapSets = useMapSetsStore();
const route = useRoute();
const router = useRouter();
const selectedId = ref("");
const stats = ref<TileCacheStats | null>(null);
const overview = ref<TileCacheOverviewStats | null>(null);
const audit = ref<TileCacheAuditResult | null>(null);
const overviewAudit = ref<TileCacheOverviewAuditResult | null>(null);
const snapshots = ref<CacheSnapshot[]>([]);
const revisions = ref<TileRevisionSummary[]>([]);
const revisionTotal = ref(0);
const revisionCursor = ref<string | null>(null);
const revisionsLoaded = ref(false);
const revisionZoom = ref("");
const revisionState = ref<"all" | "current" | "historical">("all");
const comparison = ref<TileCacheComparison | null>(null);
const snapshotName = ref("");
const busy = ref(false);
const error = ref<string | null>(null);
const message = ref<string | null>(null);
let routeReady = false;
let loadGeneration = 0;

// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
const isOverview = computed(() => selectedId.value === "");
// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
const selectedMapSet = computed(
  () => mapSets.items.find(({ id }) => id === selectedId.value) ?? null,
);
const auditByMapSet = computed(
  () =>
    new Map(
      overviewAudit.value?.mapSets.map((result) => [result.mapSetId, result]) ??
        [],
    ),
);
// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
const overviewRows = computed(() =>
  (overview.value?.mapSets ?? []).flatMap((summary) => {
    const mapSet = mapSets.items.find(({ id }) => id === summary.mapSetId);
    return mapSet === undefined
      ? []
      : [{ mapSet, summary, audit: auditByMapSet.value.get(summary.mapSetId) }];
  }),
);

// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
const sortedRevisions = computed(() =>
  [...revisions.value].sort(
    (left, right) =>
      left.zoom - right.zoom || left.x - right.x || left.y - right.y,
  ),
);

function resetScopeState(): void {
  stats.value = null;
  snapshots.value = [];
  comparison.value = null;
  message.value = null;
  audit.value = null;
  revisions.value = [];
  revisionTotal.value = 0;
  revisionCursor.value = null;
  revisionsLoaded.value = false;
  revisionZoom.value = "";
  revisionState.value = "all";
}

async function loadDetails(): Promise<void> {
  const generation = ++loadGeneration;
  const mapSetId = selectedId.value;
  busy.value = true;
  error.value = null;
  try {
    if (mapSetId === "") {
      const loadedOverview =
        await apiRequest<TileCacheOverviewStats>("api/cache/stats");
      if (generation !== loadGeneration) return;
      overview.value = loadedOverview;
      stats.value = loadedOverview.stats;
      snapshots.value = [];
    } else {
      const base = `api/map-sets/${mapSetId}`;
      const [loadedStats, loadedSnapshots] = await Promise.all([
        apiRequest<TileCacheStats>(`${base}/cache/stats`),
        apiRequest<CacheSnapshotListResponse>(`${base}/snapshots`),
      ]);
      if (generation !== loadGeneration) return;
      stats.value = loadedStats;
      snapshots.value = loadedSnapshots.items;
    }
  } catch (cause) {
    if (generation !== loadGeneration) return;
    error.value =
      cause instanceof Error
        ? cause.message
        : "The Tile Cache could not be loaded.";
  } finally {
    if (generation === loadGeneration) busy.value = false;
  }
}

async function applyRoute(): Promise<void> {
  const parameter = route.params.mapSetId;
  const mapSetId = typeof parameter === "string" ? parameter : "";
  if (mapSetId !== "" && !mapSets.items.some(({ id }) => id === mapSetId)) {
    await router.replace("/cache");
    error.value = "The requested Map Set does not exist.";
    return;
  }
  if (selectedId.value !== mapSetId) {
    selectedId.value = mapSetId;
    resetScopeState();
  }
  if (mapSetId !== "") {
    mapSets.select(mapSetId);
  }
  await loadDetails();
}

// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
function selectScope(mapSetId: string): void {
  const target =
    mapSetId === "" ? "/cache" : `/cache/${encodeURIComponent(mapSetId)}`;
  if (target !== route.path) {
    void router.push(target);
  }
}

onMounted(async () => {
  try {
    if (!mapSets.loaded) await mapSets.load();
    routeReady = true;
    await applyRoute();
  } catch (cause) {
    error.value =
      cause instanceof Error ? cause.message : "Map Sets could not be loaded.";
  }
});

watch(
  () => route.params.mapSetId,
  () => {
    if (routeReady) void applyRoute();
  },
);

// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
function mapSetAuditNeedsAttention(
  result: TileCacheMapSetAuditResult | undefined,
): boolean {
  return (
    result !== undefined &&
    (result.missingFileCount > 0 || result.orphanFileCount > 0)
  );
}

// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
async function createSnapshot(): Promise<void> {
  if (selectedId.value === "" || snapshotName.value.trim() === "") {
    return;
  }
  busy.value = true;
  error.value = null;
  try {
    const snapshot = await apiRequest<CacheSnapshot>(
      `api/map-sets/${selectedId.value}/snapshots`,
      {
        method: "POST",
        body: JSON.stringify({ name: snapshotName.value.trim() }),
      },
    );
    snapshotName.value = "";
    message.value = `Snapshot “${snapshot.name}” was created with ${snapshot.tileCount} tiles.`;
    await loadDetails();
  } catch (cause) {
    error.value =
      cause instanceof Error
        ? cause.message
        : "The snapshot could not be created.";
  } finally {
    busy.value = false;
  }
}

// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
async function compareWithCurrent(snapshot: CacheSnapshot): Promise<void> {
  busy.value = true;
  error.value = null;
  try {
    const query = new URLSearchParams({
      left: `snapshot:${snapshot.id}`,
      right: "current",
    });
    comparison.value = await apiRequest<TileCacheComparison>(
      `api/map-sets/${selectedId.value}/cache/compare?${query}`,
    );
    message.value = `Compared snapshot “${snapshot.name}” with the current state.`;
  } catch (cause) {
    error.value =
      cause instanceof Error
        ? cause.message
        : "The cache states could not be compared.";
  } finally {
    busy.value = false;
  }
}

// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
async function deleteSnapshot(snapshot: CacheSnapshot): Promise<void> {
  if (
    !window.confirm(
      `Delete snapshot “${snapshot.name}”? Tile revisions remain archived.`,
    )
  ) {
    return;
  }
  busy.value = true;
  error.value = null;
  try {
    await apiRequest<void>(
      `api/map-sets/${selectedId.value}/snapshots/${snapshot.id}`,
      { method: "DELETE" },
    );
    message.value = `Snapshot “${snapshot.name}” was deleted.`;
    comparison.value = null;
    await loadDetails();
  } catch (cause) {
    error.value =
      cause instanceof Error
        ? cause.message
        : "The snapshot could not be deleted.";
  } finally {
    busy.value = false;
  }
}

// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
async function deleteRevision(revision: TileRevisionSummary): Promise<void> {
  if (
    !window.confirm(
      `Delete historical revision ${revision.id}? This cannot be undone.`,
    )
  ) {
    return;
  }
  busy.value = true;
  error.value = null;
  try {
    await apiRequest<void>(
      `api/map-sets/${selectedId.value}/tile-revisions/${revision.id}`,
      { method: "DELETE" },
    );
    message.value = `Tile Revision ${revision.id} was deleted.`;
    await loadDetails();
    await loadRevisions(false);
  } catch (cause) {
    error.value =
      cause instanceof Error
        ? cause.message
        : "The Tile Revision could not be deleted.";
  } finally {
    busy.value = false;
  }
}

// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
async function auditCache(): Promise<void> {
  busy.value = true;
  error.value = null;
  try {
    if (selectedId.value === "") {
      overviewAudit.value = await apiRequest<TileCacheOverviewAuditResult>(
        "api/cache/audit",
        { method: "POST" },
      );
      message.value = `Consistency check scanned ${overviewAudit.value.totals.scannedFileCount} files across ${overviewAudit.value.mapSets.length} Map Sets.`;
    } else {
      audit.value = await apiRequest<TileCacheAuditResult>(
        `api/map-sets/${selectedId.value}/cache/audit`,
        { method: "POST" },
      );
      message.value = `Consistency check scanned ${audit.value.scannedFileCount} files.`;
    }
  } catch (cause) {
    error.value =
      cause instanceof Error ? cause.message : "The consistency check failed.";
  } finally {
    busy.value = false;
  }
}

// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
async function repairCache(): Promise<void> {
  if (
    selectedId.value === "" ||
    audit.value === null ||
    !window.confirm(
      "Repair this Map Set’s cache index? Unreferenced files and database entries for missing files will be removed. Affected snapshot entries will also be removed. This cannot be undone.",
    )
  ) {
    return;
  }
  busy.value = true;
  error.value = null;
  try {
    const result = await apiRequest<TileCacheRepairResult>(
      `api/map-sets/${selectedId.value}/cache/repair`,
      { method: "POST" },
    );
    message.value = `Repair scanned ${result.scannedFileCount} files, removed ${result.removedOrphanFileCount} unreferenced files, and forgot ${result.removedMissingRevisionCount} revisions for ${result.removedMissingFileCount} missing files.`;
    audit.value = result.audit;
    overview.value = null;
    overviewAudit.value = null;
    await loadDetails();
  } catch (cause) {
    error.value =
      cause instanceof Error ? cause.message : "The Tile Cache repair failed.";
  } finally {
    busy.value = false;
  }
}

async function loadRevisions(append: boolean): Promise<void> {
  if (selectedId.value === "") {
    return;
  }
  busy.value = true;
  error.value = null;
  try {
    const query = new URLSearchParams({
      limit: "50",
      state: revisionState.value,
    });
    if (revisionZoom.value !== "") {
      query.set("zoom", revisionZoom.value);
    }
    if (append && revisionCursor.value !== null) {
      query.set("cursor", revisionCursor.value);
    }
    const page = await apiRequest<TileRevisionListResponse>(
      `api/map-sets/${selectedId.value}/tile-revisions?${query}`,
    );
    revisions.value = append ? [...revisions.value, ...page.items] : page.items;
    revisionTotal.value = page.total;
    revisionCursor.value = page.nextCursor;
    revisionsLoaded.value = true;
  } catch (cause) {
    error.value =
      cause instanceof Error
        ? cause.message
        : "The Tile Revisions could not be loaded.";
  } finally {
    busy.value = false;
  }
}

// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MiB`;
}

// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(new Date(value));
}

// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
function revisionPreviewUrl(revision: TileRevisionSummary): string {
  const query = new URLSearchParams({ revision: revision.id });
  return `api/map-sets/${encodeURIComponent(selectedId.value)}/tiles/${revision.zoom}/${revision.x}/${revision.y}?${query}`;
}
</script>

<template>
  <main class="cache-page">
    <header class="page-heading">
      <div>
        <p class="eyebrow">Persistent archive</p>
        <h1>Tile Cache</h1>
        <p v-if="isOverview">
          Storage, revisions, and consistency across all Map Sets.
        </p>
        <p v-else>
          <RouterLink class="overview-link" to="/cache">All Map Sets</RouterLink>
          <span aria-hidden="true"> / </span>{{ selectedMapSet?.name }}
        </p>
      </div>
      <div class="map-set-picker">
        <span>Scope</span>
        <MapSetSelect
          :model-value="selectedId"
          :items="mapSets.items"
          :disabled="busy"
          all-label="All Map Sets"
          aria-label="Cache scope"
          @update:model-value="selectScope"
        />
      </div>
    </header>

    <p v-if="message" class="notice success" role="status">{{ message }}</p>
    <p v-if="error" class="notice error" role="alert">{{ error }}</p>
    <p v-if="busy && !stats" class="notice">Loading Tile Cache…</p>

    <section v-if="stats" class="stats" aria-label="Cache statistics">
      <article v-if="isOverview && overview">
        <span>Map Sets</span><strong>{{ overview.mapSetCount }}</strong>
      </article>
      <article v-if="isOverview && overview">
        <span>With cached tiles</span><strong>{{ overview.populatedMapSetCount }}</strong>
      </article>
      <article><span>Logical tiles</span><strong>{{ stats.logicalTileCount }}</strong></article>
      <article><span>Current revisions</span><strong>{{ stats.currentRevisionCount }}</strong></article>
      <article><span>Historical revisions</span><strong>{{ stats.historicalRevisionCount }}</strong></article>
      <article><span>Snapshots</span><strong>{{ stats.snapshotCount }}</strong></article>
      <article><span>Unique files</span><strong>{{ stats.uniqueContentCount }}</strong></article>
      <article><span>Indexed storage</span><strong>{{ formatBytes(stats.totalStorageBytes) }}</strong></article>
    </section>

    <section
      v-if="isOverview && overview && overviewRows.length"
      class="panel compact-panel map-set-overview"
    >
      <header>
        <div>
          <h2>Map Sets</h2>
          <p>Indexed cache metadata by Map Set. Open a row for snapshots and revisions.</p>
        </div>
      </header>
      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Map Set</th><th class="numeric">Logical</th><th class="numeric">Current</th><th class="numeric">Historical</th>
              <th class="numeric">Snapshots</th><th class="numeric">Files</th><th class="numeric">Storage</th><th>Consistency</th><th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in overviewRows" :key="row.mapSet.id">
              <td><strong>{{ row.mapSet.name }}</strong></td>
              <td class="numeric">{{ row.summary.logicalTileCount }}</td>
              <td class="numeric">{{ row.summary.currentRevisionCount }}</td>
              <td class="numeric">{{ row.summary.historicalRevisionCount }}</td>
              <td class="numeric">{{ row.summary.snapshotCount }}</td>
              <td class="numeric">{{ row.summary.uniqueContentCount }}</td>
              <td class="numeric">{{ formatBytes(row.summary.totalStorageBytes) }}</td>
              <td>
                <span
                  v-if="row.audit"
                  class="health-state"
                  :class="{ warning: mapSetAuditNeedsAttention(row.audit) }"
                >
                  {{ mapSetAuditNeedsAttention(row.audit) ? "Needs attention" : "OK" }}
                </span>
                <span v-else class="muted">Not checked</span>
              </td>
              <td>
                <RouterLink class="detail-link" :to="`/cache/${row.mapSet.id}`">
                  Details
                  <i class="mdi mdi-chevron-right" aria-hidden="true"></i>
                </RouterLink>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section v-if="isOverview && overview" class="panel consistency-panel">
      <header>
        <div>
          <h2>Overall consistency</h2>
          <p>The file system is scanned only when explicitly requested.</p>
        </div>
        <div class="actions">
          <button
            type="button"
            :disabled="busy || overview.mapSetCount === 0"
            @click="auditCache"
          >
            Check all Map Sets
          </button>
        </div>
      </header>
      <div v-if="overviewAudit" class="audit-results">
        <article>
          <span>Physical files</span>
          <strong>{{ overviewAudit.totals.scannedFileCount }}</strong>
        </article>
        <article>
          <span>Physical storage</span>
          <strong>{{ formatBytes(overviewAudit.totals.physicalStorageBytes) }}</strong>
        </article>
        <article :class="{ warning: overviewAudit.totals.missingFileCount > 0 }">
          <span>Missing files</span>
          <strong>{{ overviewAudit.totals.missingFileCount }}</strong>
        </article>
        <article :class="{ warning: overviewAudit.totals.orphanFileCount > 0 }">
          <span>Unreferenced files</span>
          <strong>{{ overviewAudit.totals.orphanFileCount }}</strong>
        </article>
      </div>
      <p v-else class="muted">
        Not checked in this browser session. Large archives may take a while to scan.
      </p>
    </section>

    <section v-if="stats && stats.zoomLevels.length" class="panel compact-panel">
      <header>
        <div>
          <h2>Zoom overview</h2>
          <p>
            {{ isOverview ? "Totals across all Map Sets" : "Map Set totals" }} without a
            file-system scan.
          </p>
        </div>
      </header>
      <div class="table-scroll">
        <table>
          <thead><tr><th class="numeric">Zoom</th><th class="numeric">Logical tiles</th><th class="numeric">Current</th><th class="numeric">Historical</th><th class="numeric">Storage</th></tr></thead>
          <tbody>
            <tr v-for="level in stats.zoomLevels" :key="level.zoom">
              <td class="numeric">{{ level.zoom }}</td>
              <td class="numeric">{{ level.logicalTileCount }}</td>
              <td class="numeric">{{ level.currentRevisionCount }}</td>
              <td class="numeric">{{ level.historicalRevisionCount }}</td>
              <td class="numeric">{{ formatBytes(level.indexedStorageBytes) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section v-if="!isOverview && selectedId" class="panel consistency-panel">
      <header>
        <div><h2>Consistency</h2><p>The file-system scan runs only when explicitly requested.</p></div>
        <div class="actions">
          <button type="button" :disabled="busy" @click="auditCache">Check consistency</button>
          <button class="danger-button" type="button" :disabled="busy || audit === null" @click="repairCache">Repair</button>
        </div>
      </header>
      <div v-if="audit" class="audit-results">
        <article><span>Physical files</span><strong>{{ audit.scannedFileCount }}</strong></article>
        <article><span>Physical storage</span><strong>{{ formatBytes(audit.physicalStorageBytes) }}</strong></article>
        <article :class="{ warning: audit.missingFileCount > 0 }"><span>Missing files</span><strong>{{ audit.missingFileCount }}</strong></article>
        <article :class="{ warning: audit.orphanFileCount > 0 }"><span>Unreferenced files</span><strong>{{ audit.orphanFileCount }}</strong></article>
      </div>
      <p v-else class="muted">Not checked in this browser session. Large archives may take a while to scan.</p>
    </section>

    <section v-if="selectedId" class="panel">
      <header><div><h2>Snapshots</h2><p>Snapshots preserve explicit revision selections.</p></div></header>
      <form class="snapshot-form" @submit.prevent="createSnapshot">
        <label><span>Name</span><input v-model="snapshotName" maxlength="120" required /></label>
        <button class="primary-button" type="submit" :disabled="busy">Create snapshot</button>
      </form>
      <div v-if="snapshots.length" class="snapshot-list">
        <article v-for="snapshot in snapshots" :key="snapshot.id">
          <div>
            <strong>{{ snapshot.name }}</strong>
            <span>{{ snapshot.tileCount }} tiles · {{ formatDate(snapshot.createdAt) }}</span>
          </div>
          <div class="actions">
            <button type="button" :disabled="busy" @click="compareWithCurrent(snapshot)">Compare current</button>
            <button class="danger-button" type="button" :disabled="busy" @click="deleteSnapshot(snapshot)">Delete</button>
          </div>
        </article>
      </div>
      <p v-else class="muted">No snapshots yet.</p>
      <div v-if="comparison" class="comparison" aria-label="Cache comparison">
        <span>Identical <strong>{{ comparison.identical }}</strong></span>
        <span>Changed <strong>{{ comparison.changed }}</strong></span>
        <span>Added <strong>{{ comparison.added }}</strong></span>
        <span>Missing <strong>{{ comparison.missing }}</strong></span>
      </div>
    </section>

    <section v-if="selectedId" class="panel">
      <header>
        <div><h2>Revision explorer</h2><p>Revisions are loaded in bounded pages only when requested.</p></div>
      </header>
      <form class="revision-filters" @submit.prevent="loadRevisions(false)">
        <label>
          <span>Zoom</span>
          <select v-model="revisionZoom">
            <option value="">All zoom levels</option>
            <option v-for="level in stats?.zoomLevels ?? []" :key="level.zoom" :value="String(level.zoom)">
              {{ level.zoom }}
            </option>
          </select>
        </label>
        <label>
          <span>State</span>
          <select v-model="revisionState">
            <option value="all">Current and historical</option>
            <option value="current">Current only</option>
            <option value="historical">Historical only</option>
          </select>
        </label>
        <button class="primary-button" type="submit" :disabled="busy">Load revisions</button>
      </form>
      <div v-if="revisionsLoaded && revisions.length" class="table-scroll revision-table">
        <table>
          <thead><tr><th class="numeric">Tile</th><th>State</th><th>Hash</th><th class="numeric">Size</th><th>Validated</th><th></th></tr></thead>
          <tbody>
            <tr v-for="revision in sortedRevisions" :key="revision.id">
              <td class="numeric">{{ revision.zoom }}/{{ revision.x }}/{{ revision.y }}</td>
              <td>
                <HtmlTooltip
                  :label="`Preview tile ${revision.zoom}/${revision.x}/${revision.y}`"
                  align="start"
                  fixed
                  unstyled-trigger
                >
                  <template #trigger>
                    <span class="state" :class="{ current: revision.current }">
                      {{ revision.current ? "current" : "historical" }}
                    </span>
                  </template>
                  <figure class="tile-preview">
                    <img
                      :src="revisionPreviewUrl(revision)"
                      :alt="`Tile ${revision.zoom}/${revision.x}/${revision.y}`"
                      width="256"
                      height="256"
                    />
                    <figcaption>
                      {{ revision.zoom }}/{{ revision.x }}/{{ revision.y }} ·
                      {{ revision.contentHash.slice(0, 12) }}
                    </figcaption>
                  </figure>
                </HtmlTooltip>
              </td>
              <td><code :title="revision.contentHash">{{ revision.contentHash.slice(0, 12) }}</code></td>
              <td class="numeric">{{ formatBytes(revision.byteLength) }}</td>
              <td>{{ formatDate(revision.lastValidatedAt) }}</td>
              <td><button v-if="!revision.current" class="danger-button" type="button" :disabled="busy" @click="deleteRevision(revision)">Delete</button></td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="revisionsLoaded" class="revision-footer">
        <span v-if="revisionTotal">Showing {{ revisions.length }} of {{ revisionTotal }} matching revisions.</span>
        <span v-else>No matching revisions.</span>
        <button v-if="revisionCursor" type="button" :disabled="busy" @click="loadRevisions(true)">Load 50 more</button>
      </div>
      <p v-else class="muted">Choose filters and load the first 50 revisions.</p>
    </section>

    <section v-if="mapSets.loaded && mapSets.items.length === 0" class="empty-state">
      <h2>No Map Sets</h2><p>Create a Map Set before using the Tile Cache.</p>
      <RouterLink class="primary-button" to="/map-sets">Manage Map Sets</RouterLink>
    </section>
  </main>
</template>

<style scoped>
.cache-page { width: min(86rem, 100%); margin: 0 auto; padding: clamp(1.5rem, 4vw, 3.5rem); }
.page-heading, .panel > header, .snapshot-form, .snapshot-list article, .actions, .comparison, .revision-filters, .revision-footer { display: flex; align-items: center; }
.page-heading, .panel > header, .snapshot-list article { justify-content: space-between; gap: 1rem; }
h1 { margin: 0; font-family: Georgia, "Times New Roman", serif; font-size: clamp(2.3rem, 5vw, 4rem); font-weight: 500; }
h2, p { margin-top: 0; }
.overview-link, .detail-link { color: #17453c; font-weight: 700; }
.detail-link { display: inline-flex; align-items: center; text-decoration: none; }
.map-set-picker, .snapshot-form label, .revision-filters label { display: grid; gap: 0.35rem; font-weight: 700; }
.map-set-picker .map-set-select { min-width: 18rem; }
input, select, button { min-height: 2.4rem; padding: 0.5rem 0.7rem; border: 1px solid #9eb1a7; border-radius: 0.45rem; color: #142c28; background: #fff; font: inherit; }
button { cursor: pointer; }
button:disabled { cursor: not-allowed; opacity: 0.5; }
.primary-button { color: #fff; border-color: #163832; background: #163832; }
.danger-button { color: #8a281c; border-color: #d6aaa4; }
.stats, .audit-results { display: grid; grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr)); gap: 0.8rem; }
.stats { margin: 1.5rem 0; }
.stats article, .audit-results article, .panel { border: 1px solid #c7d4cd; border-radius: 0.8rem; background: rgba(255, 255, 255, 0.72); box-shadow: 0 1rem 2.5rem rgba(16, 49, 42, 0.07); }
.stats article, .audit-results article { display: grid; gap: 0.35rem; padding: 1rem; }
.stats span, .audit-results span, .muted, .snapshot-list span, .revision-footer { color: #617870; }
.stats strong, .audit-results strong { font-size: 1.5rem; }
.warning { border-color: #b54725 !important; }
.health-state { display: inline-flex; padding: 0.2rem 0.45rem; border-radius: 999px; color: #245744; background: #dcebe1; font-size: 0.75rem; font-weight: 700; }
.health-state.warning { color: #8a281c; background: #ffe9e5; }
.panel { margin-top: 1.25rem; padding: 1.25rem; }
.compact-panel { padding-bottom: 0.5rem; }
.consistency-panel .audit-results { margin-top: 1rem; }
.snapshot-form { align-items: end; gap: 0.75rem; }
.snapshot-form label { flex: 1; }
.snapshot-list { display: grid; gap: 0.6rem; margin-top: 1rem; }
.snapshot-list article { padding: 0.75rem; border: 1px solid #d7e0db; border-radius: 0.55rem; }
.snapshot-list article > div:first-child { display: grid; gap: 0.2rem; }
.actions, .comparison { gap: 0.5rem; flex-wrap: wrap; }
.comparison { margin-top: 1rem; padding: 0.8rem; background: #e9f2ed; border-radius: 0.55rem; }
.comparison span { color: #314f47; }
.revision-filters { align-items: end; gap: 0.75rem; flex-wrap: wrap; }
.revision-filters label { min-width: 12rem; }
.revision-table { margin-top: 1rem; }
.tile-preview { width: 256px; margin: 0; }
.tile-preview img { display: block; width: 256px; height: 256px; border-radius: 0.35rem; background: #dce7df; object-fit: contain; }
.tile-preview figcaption { margin-top: 0.55rem; overflow: hidden; color: #536b64; font-family: ui-monospace, monospace; font-size: 0.75rem; text-overflow: ellipsis; white-space: nowrap; }
.revision-footer { justify-content: space-between; gap: 1rem; margin-top: 1rem; }
.table-scroll { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; }
th, td { padding: 0.65rem; border-bottom: 1px solid #d7e0db; text-align: left; white-space: nowrap; }
th.numeric, td.numeric { text-align: right; font-variant-numeric: tabular-nums; }
th { color: #536b64; font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.06em; }
.state { display: inline-block; padding: 0.2rem 0.45rem; border-radius: 999px; background: #e8ded6; }
.state.current { color: #fff; background: #17453c; }
@media (max-width: 700px) { .page-heading, .panel > header, .snapshot-form, .snapshot-list article, .revision-footer { align-items: stretch; flex-direction: column; } .map-set-picker .map-set-select { min-width: 0; width: 100%; } }
</style>
