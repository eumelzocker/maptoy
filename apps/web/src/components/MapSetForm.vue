<script setup lang="ts">
import type { MapSetInput } from "@maptoy/contracts";
import { computed, reactive, ref, watch } from "vue";

const props = defineProps<{
  modelValue: MapSetInput;
  submitLabel: string;
  busy?: boolean;
  sourceLocked?: boolean;
}>();

const emit = defineEmits<{
  submit: [value: MapSetInput];
  cancel: [];
  duplicate: [];
  dirty: [value: boolean];
}>();

const draft = reactive<MapSetInput>(props.modelValue);
const subdomains = ref(draft.subdomains.join(", "));
const headers = ref(
  Object.entries(draft.headers)
    .map(([name, value]) => `${name}: ${value}`)
    .join("\n"),
);
const maximumStorageBytes = ref<string | number>(
  draft.cachePolicy.maximumStorageBytes?.toString() ?? "",
);
const dailyRequestLimit = ref<string | number>(
  draft.downloadPolicy.dailyRequestLimit?.toString() ?? "",
);
const localError = ref<string | null>(null);

function currentFormState(): unknown {
  return {
    ...draft,
    subdomains: subdomains.value,
    headers: headers.value,
    cachePolicy: {
      ...draft.cachePolicy,
      maximumStorageBytes: maximumStorageBytes.value,
    },
    downloadPolicy: {
      ...draft.downloadPolicy,
      dailyRequestLimit: dailyRequestLimit.value,
    },
  };
}

let savedState = JSON.stringify(currentFormState());
const isDirty = computed(
  () => JSON.stringify(currentFormState()) !== savedState,
);
watch(isDirty, (value) => emit("dirty", value), { immediate: true });

watch(
  () => props.modelValue,
  (value) => {
    Object.assign(draft, value);
    subdomains.value = value.subdomains.join(", ");
    headers.value = Object.entries(value.headers)
      .map(([name, headerValue]) => `${name}: ${headerValue}`)
      .join("\n");
    maximumStorageBytes.value =
      value.cachePolicy.maximumStorageBytes?.toString() ?? "";
    dailyRequestLimit.value =
      value.downloadPolicy.dailyRequestLimit?.toString() ?? "";
    localError.value = null;
    savedState = JSON.stringify(currentFormState());
  },
);

function parsedHeaders(): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of headers.value.split(/\r?\n/)) {
    if (line.trim() === "") {
      continue;
    }
    const separator = line.indexOf(":");
    if (separator < 1) {
      throw new Error(`Header line must use “Name: value”: ${line}`);
    }
    result[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
  }
  return result;
}

function optionalPositiveInteger(
  value: string | number,
  label: string,
): number | null {
  const normalized = typeof value === "string" ? value.trim() : value;
  if (normalized === "") {
    return null;
  }
  const parsed = Number(normalized);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error(`${label} must be a positive integer or empty.`);
  }
  return parsed;
}

// biome-ignore lint/correctness/noUnusedVariables: referenced by the Vue template
function submit(): void {
  localError.value = null;
  try {
    draft.subdomains = subdomains.value
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    draft.headers = parsedHeaders();
    draft.cachePolicy.maximumStorageBytes = optionalPositiveInteger(
      maximumStorageBytes.value,
      "Maximum storage bytes",
    );
    draft.downloadPolicy.dailyRequestLimit = optionalPositiveInteger(
      dailyRequestLimit.value,
      "Daily request limit",
    );
    emit("submit", draft);
  } catch (error) {
    localError.value =
      error instanceof Error ? error.message : "The form is invalid.";
  }
}
</script>

<template>
  <form class="map-set-form" @submit.prevent="submit">
    <p v-if="localError" class="form-error" role="alert">{{ localError }}</p>

    <fieldset>
      <legend>Identity and provider</legend>
      <label>
        <span>Name</span>
        <input v-model.trim="draft.name" required maxlength="120" />
      </label>
      <label class="wide-field">
        <span>XYZ URL template</span>
        <small
          v-if="sourceLocked"
          id="template-source-lock-note"
          class="field-note locked"
        >
          <i class="mdi mdi-lock" aria-hidden="true"></i>
          The URL template is locked because this Map Set already contains cached Tiles. Direct database edits are possible but strongly discouraged.
        </small>
        <input
          v-model.trim="draft.urlTemplate"
          required
          maxlength="4096"
          spellcheck="false"
          :disabled="sourceLocked"
          :aria-describedby="
            sourceLocked
              ? 'template-source-lock-note template-format-note'
              : 'template-format-note'
          "
        />
        <small id="template-format-note">
          Required placeholders: {z}, {x}, {y}; optional: {s}. Use
          ${MAPTOY_PROVIDER_KEY} for secrets.
        </small>
      </label>
      <label class="wide-field">
        <span>Attribution</span>
        <input v-model.trim="draft.attribution" required maxlength="2000" />
        <small>Leaflet link markup such as &lt;a href="https://…"&gt;…&lt;/a&gt; is supported.</small>
      </label>
      <label class="wide-field">
        <span>Provider terms URL</span>
        <input v-model.trim="draft.termsUrl" type="url" maxlength="4096" />
      </label>
      <label>
        <span>Terms last reviewed</span>
        <input v-model="draft.termsReviewedAt" type="date" />
      </label>
      <label class="wide-field">
        <span>Notes</span>
        <textarea v-model="draft.notes" rows="3" maxlength="10000"></textarea>
      </label>
    </fieldset>

    <fieldset>
      <legend>Tile source</legend>
      <p id="source-lock-note" class="wide-field field-note" :class="{ locked: sourceLocked }">
        <i v-if="sourceLocked" class="mdi mdi-lock" aria-hidden="true"></i>
        <template v-if="sourceLocked">
          Source settings are locked because this Map Set already contains cached Tiles.
        </template>
        <template v-else>
          URL, headers, subdomains, tile size, format, and projection become locked
          after the first Tile Revision is cached.
        </template>
      </p>
      <label>
        <span>Minimum zoom</span>
        <input v-model.number="draft.minZoom" type="number" min="0" max="24" />
      </label>
      <label>
        <span>Maximum zoom</span>
        <input v-model.number="draft.maxZoom" type="number" min="0" max="24" />
      </label>
      <label>
        <span>Tile size</span>
        <select v-model.number="draft.tileSize" :disabled="sourceLocked">
          <option :value="256">256 px</option>
          <option :value="512">512 px</option>
        </select>
      </label>
      <label>
        <span>Format</span>
        <select v-model="draft.tileFormat" :disabled="sourceLocked">
          <option value="png">PNG</option>
          <option value="jpeg">JPEG</option>
          <option value="webp">WebP</option>
        </select>
      </label>
      <label class="wide-field">
        <span>Subdomains</span>
        <input v-model="subdomains" placeholder="a, b, c" :disabled="sourceLocked" />
      </label>
      <label class="wide-field">
        <span>Request headers</span>
        <textarea
          v-model="headers"
          rows="3"
          spellcheck="false"
          placeholder="User-Agent: maptoy/0.0.1"
          :disabled="sourceLocked"
        ></textarea>
        <small>
          One “Name: value” per line. Secrets use ${MAPTOY_PROVIDER_KEY} and are
          resolved only by the server.
        </small>
      </label>
    </fieldset>

    <fieldset>
      <legend>Initial viewport</legend>
      <label>
        <span>Longitude</span>
        <input
          v-model.number="draft.defaultCenter.longitude"
          type="number"
          min="-180"
          max="180"
          step="any"
        />
      </label>
      <label>
        <span>Latitude</span>
        <input
          v-model.number="draft.defaultCenter.latitude"
          type="number"
          min="-85.05112878"
          max="85.05112878"
          step="any"
        />
      </label>
      <label>
        <span>Zoom</span>
        <input
          v-model.number="draft.defaultZoom"
          type="number"
          min="0"
          max="24"
          step="0.25"
        />
      </label>
      <label>
        <span>Renderer</span>
        <select v-model="draft.rendererId">
          <option value="leaflet-xyz">Leaflet XYZ</option>
        </select>
      </label>
    </fieldset>

    <fieldset>
      <legend>Capabilities</legend>
      <label class="check-field">
        <input v-model="draft.capabilities.interactive" type="checkbox" />
        <span>Interactive map</span>
      </label>
      <label class="check-field">
        <input v-model="draft.capabilities.tileArchive" type="checkbox" />
        <span>Tile archive</span>
      </label>
      <label class="check-field">
        <input v-model="draft.capabilities.batchDownload" type="checkbox" />
        <span>Batch download</span>
      </label>
      <label class="check-field">
        <input v-model="draft.capabilities.serverExport" type="checkbox" />
        <span>Server export</span>
      </label>
      <label class="check-field">
        <input v-model="draft.capabilities.layerRendering" type="checkbox" />
        <span>Layer rendering</span>
      </label>
    </fieldset>

    <fieldset>
      <legend>Cache and download limits</legend>
      <label class="check-field">
        <input v-model="draft.cachePolicy.enabled" type="checkbox" />
        <span>Cache enabled</span>
      </label>
      <label>
        <span>Maximum cache age (seconds)</span>
        <input
          v-model.number="draft.cachePolicy.maximumAgeSeconds"
          type="number"
          min="0"
        />
      </label>
      <label>
        <span>Maximum storage (bytes, optional)</span>
        <input v-model="maximumStorageBytes" type="number" min="1" />
      </label>
      <label>
        <span>Requests per second</span>
        <input
          v-model.number="draft.downloadPolicy.requestsPerSecond"
          type="number"
          min="0.01"
          max="1000"
          step="0.01"
        />
      </label>
      <label>
        <span>Concurrency</span>
        <input
          v-model.number="draft.downloadPolicy.concurrency"
          type="number"
          min="1"
          max="64"
        />
      </label>
      <label>
        <span>Retry limit</span>
        <input
          v-model.number="draft.downloadPolicy.retryLimit"
          type="number"
          min="0"
          max="20"
        />
      </label>
      <label>
        <span>Daily request limit (optional)</span>
        <input v-model="dailyRequestLimit" type="number" min="1" />
      </label>
    </fieldset>

    <div class="form-actions">
      <button class="primary-button" type="submit" :disabled="busy">
        {{ submitLabel }}
      </button>
      <button type="button" :disabled="busy" @click="emit('cancel')">Cancel</button>
      <button v-if="sourceLocked" type="button" :disabled="busy" @click="emit('duplicate')">
        Duplicate to change source
      </button>
      <RouterLink to="/docs/en/map-sets">Map Set help</RouterLink>
    </div>
  </form>
</template>

<style scoped>
.map-set-form {
  display: grid;
  gap: 1rem;
}

fieldset {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.9rem;
  margin: 0;
  padding: 1rem;
  border: 1px solid #b6c6bc;
  border-radius: 0.75rem;
}

legend {
  padding-inline: 0.35rem;
  color: #163832;
  font-weight: 800;
}

label {
  display: grid;
  gap: 0.35rem;
  color: #314f47;
  font-size: 0.86rem;
  font-weight: 700;
}

.field-note {
  margin: 0;
  color: #5d746d;
  font-size: 0.88rem;
}

.field-note.locked {
  padding: 0.65rem 0.75rem;
  border-left: 0.2rem solid #a34521;
  background: #fff3ed;
  color: #71331d;
}

.wide-field {
  grid-column: 1 / -1;
}

.check-field {
  display: flex;
  align-items: center;
}

input,
select,
textarea,
button {
  min-height: 2.5rem;
  padding: 0.55rem 0.65rem;
  border: 1px solid #9eb1a7;
  border-radius: 0.45rem;
  color: #142c28;
  background: #fff;
  font: inherit;
}

textarea {
  resize: vertical;
}

input:disabled,
select:disabled,
textarea:disabled {
  cursor: not-allowed;
  color: #66756f;
  background: #e7ece9;
}

small {
  color: #597068;
  font-weight: 400;
}

.form-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
}

button {
  cursor: pointer;
}

button:disabled {
  cursor: wait;
  opacity: 0.6;
}

.primary-button {
  color: #fff;
  border-color: #163832;
  background: #163832;
}

.form-error {
  margin: 0;
  padding: 0.75rem;
  border-left: 0.25rem solid #b64030;
  background: #ffe9e5;
}

@media (max-width: 700px) {
  fieldset {
    grid-template-columns: 1fr;
  }
}
</style>
