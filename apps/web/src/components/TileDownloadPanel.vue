<script setup lang="ts">
import type {
  CoverageBounds,
  Job,
  JobError,
  MapSetListItem,
  TileDownloadEstimate,
  TileDownloadInput,
} from "@maptoy/contracts";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { apiRequest } from "../api.js";
import {
  downloadCoordinatePrecision,
  roundedDownloadBounds,
} from "../coverageModel.js";

const props = defineProps<{
  mapSet: MapSetListItem | null;
  visibleBounds: CoverageBounds | null;
  defaultMaximumZoom: number;
  drawnBounds?: CoverageBounds | null;
  areaSelectionActive?: boolean;
  areaSelectionAvailable?: boolean;
  initiallyOpen?: boolean;
}>();

const emit = defineEmits<{
  jobsUpdated: [jobs: Job[]];
  selectionUpdated: [bounds: CoverageBounds | null];
  requestAreaSelection: [];
  cancelAreaSelection: [];
  refreshCoverage: [];
}>();

type DownloadBoundsDraft = {
  [Key in keyof CoverageBounds]: number | "";
};

type TileDownloadDraft = Omit<TileDownloadInput, "bounds"> & {
  bounds: DownloadBoundsDraft;
};

const open = ref(props.initiallyOpen ?? false);
const draft = ref<TileDownloadDraft>(defaultInput(props.mapSet));
const estimate = ref<TileDownloadEstimate | null>(null);
const jobs = ref<Job[]>([]);
const errors = ref<Record<string, JobError[]>>({});
const loadingEstimate = ref(false);
const busy = ref(false);
const acceptedResponsibility = ref(false);
const selectionVisible = ref(props.initiallyOpen ?? false);
const finishedJobsOpen = ref(false);
const error = ref<string | null>(null);
let estimateTimer: number | null = null;
let pollTimer: number | null = null;
const previousStatuses = new Map<string, Job["status"]>();

const supported = computed(
  () =>
    props.mapSet?.capabilities.batchDownload === true &&
    props.mapSet.capabilities.tileArchive &&
    props.mapSet.cachePolicy.enabled,
);

const mapSetJobs = computed(() =>
  jobs.value.filter(
    (job) =>
      job.type === "tile-download" && job.input.mapSetId === props.mapSet?.id,
  ),
);

const activeJobs = computed(() =>
  mapSetJobs.value.filter((job) =>
    ["queued", "running", "paused"].includes(job.status),
  ),
);

const finishedJobs = computed(() =>
  mapSetJobs.value.filter((job) =>
    ["completed", "failed", "cancelled"].includes(job.status),
  ),
);

// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
const jobGroups = computed(() => [
  ...(activeJobs.value.length === 0
    ? []
    : [
        {
          id: "active",
          label: "Active downloads",
          jobs: activeJobs.value,
          collapsible: false,
        },
      ]),
  ...(finishedJobs.value.length === 0
    ? []
    : [
        {
          id: "finished",
          label: "Finished downloads",
          jobs: finishedJobs.value,
          collapsible: true,
        },
      ]),
]);

const canStart = computed(
  () =>
    supported.value &&
    downloadInput.value !== null &&
    acceptedResponsibility.value &&
    estimate.value !== null &&
    estimate.value.requestTiles > 0 &&
    estimate.value.blockedReasons.length === 0 &&
    !busy.value,
);
// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
const coordinateStep = computed(
  () => 10 ** -downloadCoordinatePrecision(draft.value.maximumZoom),
);

function defaultInput(
  mapSet: MapSetListItem | null,
  clearBounds = false,
): TileDownloadDraft {
  const center = mapSet?.defaultCenter ?? { longitude: 0, latitude: 0 };
  const maximumZoom =
    mapSet === null
      ? 0
      : Math.min(
          mapSet.maxZoom,
          Math.max(mapSet.minZoom, props.defaultMaximumZoom),
        );
  const bounds = clearBounds
    ? {
        west: "" as const,
        south: "" as const,
        east: "" as const,
        north: "" as const,
      }
    : roundedDownloadBounds(
        props.visibleBounds ?? {
          west: Math.max(-180, center.longitude - 0.1),
          south: Math.max(-85.05112878, center.latitude - 0.1),
          east: Math.min(180, center.longitude + 0.1),
          north: Math.min(85.05112878, center.latitude + 0.1),
        },
        maximumZoom,
      );
  return {
    bounds,
    minimumZoom: mapSet?.minZoom ?? 0,
    maximumZoom,
    refreshMode: "missing",
  };
}

const downloadInput = computed<TileDownloadInput | null>(() => {
  const mapSet = props.mapSet;
  const input = draft.value;
  const { west, south, east, north } = input.bounds;
  if (
    mapSet === null ||
    typeof west !== "number" ||
    typeof south !== "number" ||
    typeof east !== "number" ||
    typeof north !== "number" ||
    !Number.isFinite(west) ||
    !Number.isFinite(south) ||
    !Number.isFinite(east) ||
    !Number.isFinite(north) ||
    west === east ||
    south >= north ||
    !Number.isInteger(input.minimumZoom) ||
    !Number.isInteger(input.maximumZoom) ||
    input.minimumZoom < mapSet.minZoom ||
    input.maximumZoom > mapSet.maxZoom ||
    input.minimumZoom > input.maximumZoom
  ) {
    return null;
  }
  return {
    bounds: { west, south, east, north },
    minimumZoom: input.minimumZoom,
    maximumZoom: input.maximumZoom,
    refreshMode: input.refreshMode,
  };
});

// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
function formatNumber(value: number): string {
  return new Intl.NumberFormat().format(value);
}

// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
function formatBytes(value: number | null): string {
  if (value === null) return "Not enough cached data to estimate";
  if (value < 1024) return `${value} B`;
  const units = ["KiB", "MiB", "GiB", "TiB"];
  let amount = value / 1024;
  let unit = units[0] ?? "KiB";
  for (let index = 1; amount >= 1024 && index < units.length; index += 1) {
    amount /= 1024;
    unit = units[index] ?? unit;
  }
  return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(amount)} ${unit}`;
}

// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
function progress(job: Job): number {
  return job.total === 0
    ? 0
    : Math.min(
        100,
        ((job.completed + job.skipped + job.failed) / job.total) * 100,
      );
}

// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
function currentTile(job: Job): string | null {
  const { currentZoom, currentX, currentY } = job.summary;
  return currentZoom === undefined ||
    currentX === undefined ||
    currentY === undefined
    ? null
    : `${currentZoom}/${currentX}/${currentY}`;
}

// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
function jobMapSetName(job: Job): string {
  const mapSetId = job.input.mapSetId;
  if (props.mapSet !== null && props.mapSet.id === mapSetId) {
    return props.mapSet.name;
  }
  return typeof mapSetId === "string" ? mapSetId : "Unknown Map Set";
}

// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
function jobZoomRange(job: Job): string {
  const minimumZoom = job.input.minimumZoom;
  const maximumZoom = job.input.maximumZoom;
  if (
    typeof minimumZoom !== "number" ||
    !Number.isInteger(minimumZoom) ||
    typeof maximumZoom !== "number" ||
    !Number.isInteger(maximumZoom)
  ) {
    return "Unknown Zoom range";
  }
  return minimumZoom === maximumZoom
    ? `z${minimumZoom}`
    : `z${minimumZoom}–${maximumZoom}`;
}

// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
function useVisibleArea(): void {
  if (props.visibleBounds === null) return;
  selectionVisible.value = true;
  emit("cancelAreaSelection");
  draft.value = {
    ...draft.value,
    bounds: roundedDownloadBounds(props.visibleBounds, draft.value.maximumZoom),
  };
}

// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
function toggleAreaSelection(): void {
  if (props.areaSelectionActive) {
    emit("cancelAreaSelection");
  } else {
    emit("requestAreaSelection");
  }
}

async function updateEstimate(): Promise<void> {
  const mapSet = props.mapSet;
  const input = downloadInput.value;
  if (mapSet === null || !supported.value || input === null) {
    estimate.value = null;
    return;
  }
  loadingEstimate.value = true;
  error.value = null;
  try {
    estimate.value = await apiRequest<TileDownloadEstimate>(
      `api/map-sets/${mapSet.id}/tile-downloads/estimate`,
      { method: "POST", body: JSON.stringify(input) },
    );
  } catch (cause) {
    estimate.value = null;
    error.value =
      cause instanceof Error
        ? cause.message
        : "The download could not be estimated.";
  } finally {
    loadingEstimate.value = false;
  }
}

function scheduleEstimate(): void {
  if (estimateTimer !== null) window.clearTimeout(estimateTimer);
  estimateTimer = window.setTimeout(() => void updateEstimate(), 300);
}

function updateSelection(): void {
  const input = downloadInput.value;
  emit(
    "selectionUpdated",
    selectionVisible.value ? (input?.bounds ?? null) : null,
  );
}

// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
function togglePanel(event: Event): void {
  open.value = (event.currentTarget as HTMLDetailsElement).open;
  if (open.value) {
    selectionVisible.value = true;
    updateSelection();
  } else {
    emit("cancelAreaSelection");
  }
}

// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
function toggleFinishedJobs(event: Event): void {
  finishedJobsOpen.value = (event.currentTarget as HTMLDetailsElement).open;
}

async function loadJobs(): Promise<void> {
  try {
    const response = await apiRequest<{ items: Job[] }>("api/jobs");
    const newlyCompleted = response.items.some(
      (job) =>
        job.type === "tile-download" &&
        job.input.mapSetId === props.mapSet?.id &&
        job.status === "completed" &&
        previousStatuses.get(job.id) !== undefined &&
        previousStatuses.get(job.id) !== "completed",
    );
    jobs.value = response.items;
    for (const job of response.items) previousStatuses.set(job.id, job.status);
    emit("jobsUpdated", mapSetJobs.value);
    if (newlyCompleted) emit("refreshCoverage");
  } catch (cause) {
    error.value =
      cause instanceof Error
        ? cause.message
        : "Download Jobs could not be loaded.";
  }
}

// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
async function start(): Promise<void> {
  const mapSet = props.mapSet;
  const input = downloadInput.value;
  if (mapSet === null || input === null || !canStart.value) return;
  busy.value = true;
  error.value = null;
  try {
    await apiRequest<Job>(`api/map-sets/${mapSet.id}/tile-download-jobs`, {
      method: "POST",
      body: JSON.stringify(input),
    });
    await loadJobs();
    await updateEstimate();
  } catch (cause) {
    error.value =
      cause instanceof Error
        ? cause.message
        : "The Tile Download could not be queued.";
  } finally {
    busy.value = false;
  }
}

// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
async function control(
  job: Job,
  action: "pause" | "resume" | "cancel" | "retry",
): Promise<void> {
  busy.value = true;
  error.value = null;
  try {
    await apiRequest<Job>(`api/jobs/${job.id}/${action}`, { method: "POST" });
    await loadJobs();
  } catch (cause) {
    error.value =
      cause instanceof Error
        ? cause.message
        : `The Job could not be ${action}d.`;
  } finally {
    busy.value = false;
  }
}

// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
async function loadErrors(job: Job): Promise<void> {
  if (errors.value[job.id] !== undefined) return;
  try {
    const response = await apiRequest<{ items: JobError[] }>(
      `api/jobs/${job.id}/errors`,
    );
    errors.value = { ...errors.value, [job.id]: response.items };
  } catch (cause) {
    error.value =
      cause instanceof Error
        ? cause.message
        : "Job errors could not be loaded.";
  }
}

watch(
  () => props.mapSet?.id,
  () => {
    emit("cancelAreaSelection");
    selectionVisible.value = open.value;
    finishedJobsOpen.value = false;
    emit("selectionUpdated", null);
    draft.value = defaultInput(props.mapSet, true);
    estimate.value = null;
    acceptedResponsibility.value = false;
    void loadJobs();
    scheduleEstimate();
  },
);

watch(
  () => props.drawnBounds,
  (bounds) => {
    if (bounds === null || bounds === undefined) return;
    selectionVisible.value = true;
    draft.value = {
      ...draft.value,
      bounds: roundedDownloadBounds(bounds, draft.value.maximumZoom),
    };
  },
);

watch(
  () => props.defaultMaximumZoom,
  (value) => {
    const mapSet = props.mapSet;
    if (mapSet === null) return;
    draft.value.maximumZoom = Math.min(
      mapSet.maxZoom,
      Math.max(mapSet.minZoom, value),
    );
  },
);

watch(
  () => draft.value.maximumZoom,
  (value) => {
    if (
      Number.isInteger(value) &&
      Number.isInteger(draft.value.minimumZoom) &&
      value < draft.value.minimumZoom
    ) {
      draft.value.minimumZoom = value;
    }
  },
);

watch(
  draft,
  () => {
    updateSelection();
    scheduleEstimate();
  },
  { deep: true },
);

onMounted(() => {
  updateSelection();
  void loadJobs();
  scheduleEstimate();
  pollTimer = window.setInterval(() => void loadJobs(), 1000);
});

onBeforeUnmount(() => {
  if (estimateTimer !== null) window.clearTimeout(estimateTimer);
  if (pollTimer !== null) window.clearInterval(pollTimer);
  emit("jobsUpdated", []);
  emit("selectionUpdated", null);
  emit("cancelAreaSelection");
});
</script>

<template>
  <details class="download-panel" :open="open || activeJobs.length > 0" @toggle="togglePanel">
    <summary>
      <span class="summary-title">
        <i
          class="mdi summary-caret"
          :class="open || activeJobs.length > 0 ? 'mdi-chevron-down' : 'mdi-chevron-right'"
          aria-hidden="true"
        ></i>
        <span>Download tiles</span>
      </span>
      <span v-if="activeJobs.length > 0" class="job-count">{{ activeJobs.length }} active</span>
    </summary>

    <div v-if="!supported" class="download-content">
      <p class="muted">This Map Set does not support cached Batch Downloads.</p>
    </div>

    <div v-else class="download-content">
      <div class="area-actions">
        <button
          type="button"
          :class="{ active: areaSelectionActive }"
          :disabled="!areaSelectionActive && areaSelectionAvailable === false"
          :title="areaSelectionActive ? 'Cancel map selection (Esc)' : 'Select area on map (Ctrl+click or Ctrl+drag on map)'"
          @click="toggleAreaSelection"
        >
          <i class="mdi mdi-vector-square" aria-hidden="true"></i>
          {{ areaSelectionActive ? "Cancel map selection" : "Select area on map" }}
        </button>
        <button
          type="button"
          :disabled="visibleBounds === null"
          title="Select all"
          @click="useVisibleArea"
        >
          <i class="mdi mdi-crop-free" aria-hidden="true"></i>
          Use visible area
        </button>
      </div>

      <fieldset class="bounds-grid">
        <legend>WGS84 bounds</legend>
        <label><span>West</span><input v-model.number="draft.bounds.west" type="number" min="-180" max="180" :step="coordinateStep" /></label>
        <label><span>East</span><input v-model.number="draft.bounds.east" type="number" min="-180" max="180" :step="coordinateStep" /></label>
        <label><span>South</span><input v-model.number="draft.bounds.south" type="number" min="-85.05112878" max="85.05112878" :step="coordinateStep" /></label>
        <label><span>North</span><input v-model.number="draft.bounds.north" type="number" min="-85.05112878" max="85.05112878" :step="coordinateStep" /></label>
      </fieldset>

      <div class="download-fields">
        <label>
          <span>Minimum zoom</span>
          <input v-model.number="draft.minimumZoom" type="number" :min="mapSet?.minZoom" :max="draft.maximumZoom" />
        </label>
        <label>
          <span>Maximum zoom</span>
          <input v-model.number="draft.maximumZoom" type="number" :min="mapSet?.minZoom" :max="mapSet?.maxZoom" />
        </label>
      </div>

      <label class="stacked-field">
        <span>Download</span>
        <select v-model="draft.refreshMode">
          <option value="missing">Missing Tiles only</option>
          <option value="missing-or-stale">Missing and stale Tiles</option>
        </select>
      </label>

      <p v-if="loadingEstimate" class="muted" role="status">Updating estimate…</p>
      <section v-else-if="estimate" class="estimate" aria-label="Download estimate">
        <dl>
          <div><dt>Selected</dt><dd>{{ formatNumber(estimate.totalTiles) }}</dd></div>
          <div><dt>Fresh</dt><dd>{{ formatNumber(estimate.freshTiles) }}</dd></div>
          <div><dt>Stale</dt><dd>{{ formatNumber(estimate.staleTiles) }}</dd></div>
          <div><dt>Missing</dt><dd>{{ formatNumber(estimate.missingTiles) }}</dd></div>
          <div><dt>Provider requests</dt><dd>{{ formatNumber(estimate.requestTiles) }}</dd></div>
          <div><dt>Estimated transfer</dt><dd>{{ formatBytes(estimate.estimatedBytes) }}</dd></div>
          <div><dt>Configured maximum</dt><dd>{{ formatNumber(estimate.maximumTileCount) }} Tiles</dd></div>
          <div v-if="estimate.dailyRequestsRemaining !== null">
            <dt>Daily requests left</dt>
            <dd>{{ formatNumber(estimate.dailyRequestsRemaining) }} / {{ formatNumber(estimate.dailyRequestLimit ?? 0) }}</dd>
          </div>
          <div>
            <dt>Provider pacing</dt>
            <dd>{{ mapSet?.downloadPolicy.requestsPerSecond }}/s · {{ mapSet?.downloadPolicy.concurrency }} parallel</dd>
          </div>
        </dl>
        <p v-if="estimate.requestTiles === 0" class="muted">All selected Tiles already satisfy this download mode.</p>
        <p v-for="warning in estimate.warnings" :key="warning" class="warning">{{ warning }}</p>
        <p v-for="reason in estimate.blockedReasons" :key="reason" class="blocked">{{ reason }}</p>
      </section>

      <label class="responsibility">
        <input v-model="acceptedResponsibility" type="checkbox" />
        <span>
          I reviewed the provider terms and accept responsibility for this download.
          <a v-if="mapSet?.termsUrl" :href="mapSet.termsUrl" target="_blank" rel="noopener noreferrer">Open terms</a>
        </span>
      </label>
      <button type="button" class="primary-button" :disabled="!canStart" @click="start">
        Queue download
      </button>

      <section v-if="jobGroups.length > 0" class="jobs" aria-label="Tile Download Jobs">
        <h3>Download jobs</h3>
        <component
          :is="group.collapsible ? 'details' : 'div'"
          v-for="group in jobGroups"
          :key="group.id"
          class="job-group"
          :open="group.collapsible ? finishedJobsOpen : undefined"
          @toggle="group.collapsible && toggleFinishedJobs($event)"
        >
          <summary v-if="group.collapsible">
            <span>
              <i
                class="mdi"
                :class="finishedJobsOpen ? 'mdi-chevron-down' : 'mdi-chevron-right'"
                aria-hidden="true"
              ></i>
              {{ group.label }}
            </span>
            <span class="finished-count">{{ group.jobs.length }}</span>
          </summary>
          <h4 v-else>{{ group.label }}</h4>
          <div class="job-group-content">
            <article v-for="job in group.jobs" :key="job.id" class="job-card">
              <header>
                <strong>{{ job.status }}</strong>
                <time :datetime="job.createdAt">{{ new Date(job.createdAt).toLocaleString() }}</time>
              </header>
              <p v-if="group.id === 'finished'" class="job-context">
                <span><i class="mdi mdi-map-outline" aria-hidden="true"></i>{{ jobMapSetName(job) }}</span>
                <span><i class="mdi mdi-magnify" aria-hidden="true"></i>{{ jobZoomRange(job) }}</span>
              </p>
              <progress :value="job.completed + job.skipped + job.failed" :max="Math.max(1, job.total)"></progress>
              <p>
                {{ progress(job).toFixed(0) }}% · {{ formatNumber(job.completed) }} completed ·
                {{ formatNumber(job.skipped) }} skipped · {{ formatNumber(job.failed) }} failed
              </p>
              <p v-if="currentTile(job)" class="current-tile">Current Tile {{ currentTile(job) }}</p>
              <p v-if="job.lastError" class="blocked">{{ job.lastError }}</p>
              <div class="job-actions">
                <button v-if="job.status === 'queued' || job.status === 'running'" type="button" :disabled="busy" @click="control(job, 'pause')">Pause</button>
                <button v-if="job.status === 'paused'" type="button" :disabled="busy" @click="control(job, 'resume')">Resume</button>
                <button v-if="job.status === 'queued' || job.status === 'running' || job.status === 'paused'" type="button" :disabled="busy" @click="control(job, 'cancel')">Cancel</button>
                <button v-if="job.status === 'failed' || job.status === 'cancelled' || (job.status === 'completed' && job.failed > 0)" type="button" :disabled="busy" @click="control(job, 'retry')">Retry</button>
              </div>
              <details v-if="job.failed > 0" class="job-errors" @toggle="($event.currentTarget as HTMLDetailsElement).open && loadErrors(job)">
                <summary>Errors</summary>
                <p v-if="errors[job.id] === undefined" class="muted">Loading…</p>
                <ul v-else>
                  <li v-for="item in errors[job.id]" :key="item.id">
                    <code v-if="item.item">{{ item.item }}</code> {{ item.message }}
                  </li>
                </ul>
              </details>
            </article>
          </div>
        </component>
      </section>

      <p v-if="error" class="blocked" role="alert">{{ error }}</p>
    </div>
  </details>
</template>

<style scoped>
.download-panel { margin-top: 1rem; overflow: hidden; border: 1px solid #aebfb5; border-radius: 0.55rem; background: white; }
.download-panel > summary { display: flex; justify-content: space-between; gap: 0.5rem; padding: 0.7rem 0.8rem; color: #314f47; background: #e7eee9; font-weight: 800; cursor: pointer; list-style: none; user-select: none; }
.download-panel > summary::-webkit-details-marker { display: none; }
.download-panel > summary:hover { background: #dce7e0; }
.download-panel > summary:focus-visible { outline: 2px solid #163832; outline-offset: -2px; }
.download-panel[open] > summary { border-bottom: 1px solid #c8d4cd; }
.summary-title { display: inline-flex; gap: 0.4rem; align-items: center; }
.summary-caret { color: #657971; font-size: 1.15rem; }
.job-count { color: #176443; font-size: 0.75rem; }
.download-content { display: grid; gap: 0.8rem; padding: 0.8rem; }
.area-actions { display: flex; flex-wrap: wrap; gap: 0.4rem; }
.area-actions button { display: inline-flex; gap: 0.35rem; align-items: center; min-height: 2.15rem; padding: 0.4rem 0.65rem; border: 1px solid #719184; border-radius: 0.4rem; color: #17453c; background: #edf5f0; font: inherit; font-size: 0.76rem; font-weight: 800; cursor: pointer; }
.area-actions button:hover:not(:disabled) { border-color: #39705e; background: #dcebe3; }
.area-actions button:focus-visible { outline: 2px solid #17453c; outline-offset: 2px; }
.area-actions button:disabled { color: #7a8b84; background: #f1f3f2; }
.area-actions button.active { border-color: #6d00d9; color: #5b00b8; background: #f3e8ff; }
.bounds-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.55rem; margin: 0; padding: 0.7rem; border: 1px solid #d7e0db; border-radius: 0.45rem; }
.bounds-grid legend { padding: 0 0.25rem; color: #617870; font-size: 0.75rem; font-weight: 800; }
.bounds-grid label, .download-fields label, .stacked-field { display: grid; gap: 0.25rem; color: #314f47; font-size: 0.76rem; font-weight: 700; }
.download-fields { display: grid; grid-template-columns: 1fr 1fr; gap: 0.55rem; }
input, select { width: 100%; min-height: 2.2rem; padding: 0.4rem 0.5rem; border: 1px solid #9db0a6; border-radius: 0.35rem; background: white; font: inherit; }
.estimate { padding: 0.65rem; border-radius: 0.45rem; background: #f4f7f4; }
.estimate dl { display: grid; grid-template-columns: 1fr auto; gap: 0.25rem 0.75rem; margin: 0; font-size: 0.78rem; }
.estimate dl div { display: contents; }
.estimate dd { margin: 0; font-weight: 800; text-align: right; }
.responsibility { display: flex; gap: 0.5rem; align-items: flex-start; font-size: 0.78rem; line-height: 1.35; }
.responsibility input { flex: 0 0 auto; width: auto; min-height: auto; margin-top: 0.15rem; }
.provider-notice { display: grid; gap: 0.2rem; padding: 0.55rem; border-left: 3px solid #9db0a6; color: #617870; font-size: 0.72rem; }
.provider-notice :deep(p) { margin: 0; }
.primary-button { min-height: 2.35rem; border: 0; border-radius: 0.4rem; color: white; background: #176443; font-weight: 800; }
.primary-button:disabled { opacity: 0.5; }
.jobs { display: grid; gap: 0.6rem; padding-top: 0.4rem; border-top: 1px solid #d7e0db; }
.jobs h3 { margin: 0; font-size: 0.9rem; }
.job-group { display: grid; gap: 0.45rem; }
.job-group h4 { margin: 0; color: #617870; font-size: 0.76rem; text-transform: uppercase; letter-spacing: 0.04em; }
.job-group > summary { display: flex; justify-content: space-between; gap: 0.5rem; align-items: center; padding: 0.45rem 0.55rem; border: 1px solid #c8d4cd; border-radius: 0.4rem; color: #314f47; background: #edf2ef; font-size: 0.78rem; font-weight: 800; cursor: pointer; list-style: none; user-select: none; }
.job-group > summary::-webkit-details-marker { display: none; }
.job-group > summary span { display: inline-flex; gap: 0.3rem; align-items: center; }
.job-group > summary:hover { background: #e2ebe5; }
.job-group > summary:focus-visible { outline: 2px solid #17453c; outline-offset: 2px; }
.finished-count { justify-content: center; min-width: 1.45rem; height: 1.45rem; border-radius: 999px; color: #36594e; background: white; font-size: 0.7rem; }
.job-group-content { display: grid; gap: 0.45rem; }
.job-card { display: grid; gap: 0.4rem; padding: 0.6rem; border: 1px solid #d7e0db; border-radius: 0.45rem; }
.job-card header { display: flex; justify-content: space-between; gap: 0.5rem; text-transform: capitalize; }
.job-card time, .job-card p { margin: 0; color: #617870; font-size: 0.72rem; }
.job-card .job-context { display: flex; flex-wrap: wrap; gap: 0.35rem 0.75rem; color: #36594e; font-weight: 700; }
.job-context span { display: inline-flex; gap: 0.25rem; align-items: center; }
.job-card progress { width: 100%; accent-color: #176443; }
.job-actions { display: flex; flex-wrap: wrap; gap: 0.35rem; }
.job-actions button { min-height: 1.9rem; }
.job-errors summary { font-size: 0.75rem; font-weight: 800; cursor: pointer; }
.job-errors ul { max-height: 8rem; margin: 0.4rem 0 0; padding-left: 1.2rem; overflow: auto; font-size: 0.72rem; }
.warning, .blocked, .muted { margin: 0; font-size: 0.76rem; line-height: 1.35; }
.warning { color: #815b0d; }
.blocked { color: #9c3028; }
.muted, .current-tile { color: #617870; }
</style>
