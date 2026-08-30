<script setup lang="ts">
// biome-ignore-all lint/correctness/noUnusedImports: Vue template references are not detected by Biome.
// biome-ignore-all lint/correctness/noUnusedVariables: Vue template references are not detected by Biome.
import { computed } from "vue";

defineOptions({ inheritAttrs: false });

interface SchemaProperty {
  type?: unknown;
  title?: unknown;
  format?: unknown;
  minimum?: unknown;
  maximum?: unknown;
  step?: unknown;
  default?: unknown;
  uiControl?: unknown;
}

const props = defineProps<{
  configuration: Readonly<Record<string, unknown>>;
  configurationSchema: Readonly<Record<string, unknown>>;
  busy: boolean;
}>();

const emit = defineEmits<{
  configurationChange: [key: string, value: string | number | boolean];
}>();

const fields = computed(() => {
  const properties = props.configurationSchema.properties;
  if (
    typeof properties !== "object" ||
    properties === null ||
    Array.isArray(properties)
  ) {
    return [];
  }
  return Object.entries(properties).map(([key, value]) => ({
    key,
    property:
      typeof value === "object" && value !== null && !Array.isArray(value)
        ? (value as SchemaProperty)
        : {},
  }));
});

const booleanFields = computed(() =>
  fields.value.filter((field) => field.property.type === "boolean"),
);
const colorFields = computed(() =>
  fields.value.filter(
    (field) =>
      field.property.format === "color" ||
      field.property.format === "color-alpha",
  ),
);
const otherFields = computed(() =>
  fields.value.filter(
    (field) =>
      field.property.type !== "boolean" &&
      field.property.format !== "color" &&
      field.property.format !== "color-alpha",
  ),
);

function label(key: string, property: SchemaProperty): string {
  return typeof property.title === "string" ? property.title : key;
}

function value(key: string, property: SchemaProperty): unknown {
  return props.configuration[key] ?? property.default ?? "";
}

function numberAttribute(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function normalizedColor(key: string, property: SchemaProperty): string {
  const configured = value(key, property);
  if (typeof configured === "string") {
    const match = configured.match(/^#([0-9a-f]{6})([0-9a-f]{2})?$/i);
    if (match !== null) {
      return `#${match[1]}${match[2] ?? "ff"}`.toLowerCase();
    }
  }
  return "#000000ff";
}

function colorRgb(key: string, property: SchemaProperty): string {
  return normalizedColor(key, property).slice(0, 7);
}

function colorAlphaPercent(key: string, property: SchemaProperty): number {
  return Math.round(
    (Number.parseInt(normalizedColor(key, property).slice(7), 16) / 255) * 100,
  );
}

function updateColor(
  key: string,
  property: SchemaProperty,
  event: Event,
): void {
  if (!(event.currentTarget instanceof HTMLInputElement)) return;
  const alpha = normalizedColor(key, property).slice(7);
  emit(
    "configurationChange",
    key,
    property.format === "color-alpha"
      ? `${event.currentTarget.value}${alpha}`
      : event.currentTarget.value,
  );
}

function updateColorAlpha(
  key: string,
  property: SchemaProperty,
  event: Event,
): void {
  if (!(event.currentTarget instanceof HTMLInputElement)) return;
  const alpha = Math.round((Number(event.currentTarget.value) / 100) * 255)
    .toString(16)
    .padStart(2, "0");
  emit("configurationChange", key, `${colorRgb(key, property)}${alpha}`);
}
</script>

<template>
  <fieldset v-if="fields.length > 0" class="schema-layer-editor">
    <legend>Layer settings</legend>
    <label v-for="field in booleanFields" :key="field.key" class="checkbox-field">
      <input
        type="checkbox"
        :checked="Boolean(value(field.key, field.property))"
        :disabled="busy"
        @change="emit('configurationChange', field.key, ($event.target as HTMLInputElement).checked)"
      />
      <span>{{ label(field.key, field.property) }}</span>
    </label>

    <div v-if="colorFields.length > 0" class="color-fields">
      <div v-for="field in colorFields" :key="field.key" class="color-field">
        <span>{{ label(field.key, field.property) }}</span>
        <input
          type="color"
          :value="colorRgb(field.key, field.property)"
          :aria-label="`${label(field.key, field.property)} color`"
          :disabled="busy"
          @change="updateColor(field.key, field.property, $event)"
        />
        <label v-if="field.property.format === 'color-alpha'" class="alpha-field">
          <span>Alpha {{ colorAlphaPercent(field.key, field.property) }}%</span>
          <input
            type="range"
            min="0"
            max="100"
            step="1"
            :value="colorAlphaPercent(field.key, field.property)"
            :aria-label="`${label(field.key, field.property)} opacity`"
            :disabled="busy"
            @change="updateColorAlpha(field.key, field.property, $event)"
          />
        </label>
      </div>
    </div>

    <template v-for="field in otherFields" :key="field.key">
      <label
        v-if="field.property.type === 'number' && field.property.uiControl === 'range'"
        class="range-field"
      >
        <span>
          {{ label(field.key, field.property) }}
          <output>{{ value(field.key, field.property) }}%</output>
        </span>
        <input
          type="range"
          :value="value(field.key, field.property)"
          :min="numberAttribute(field.property.minimum)"
          :max="numberAttribute(field.property.maximum)"
          :step="numberAttribute(field.property.step)"
          :disabled="busy"
          @change="emit('configurationChange', field.key, Number(($event.target as HTMLInputElement).value))"
        />
      </label>
      <label v-else-if="field.property.type === 'number'">
        <span>{{ label(field.key, field.property) }}</span>
        <input
          type="number"
          :value="value(field.key, field.property)"
          :min="numberAttribute(field.property.minimum)"
          :max="numberAttribute(field.property.maximum)"
          :step="numberAttribute(field.property.step)"
          :disabled="busy"
          @change="emit('configurationChange', field.key, Number(($event.target as HTMLInputElement).value))"
        />
      </label>
      <label v-else>
        <span>{{ label(field.key, field.property) }}</span>
        <input
          type="text"
          :value="value(field.key, field.property)"
          :disabled="busy"
          @change="emit('configurationChange', field.key, ($event.target as HTMLInputElement).value)"
        />
      </label>
    </template>
  </fieldset>
</template>

<style scoped>
.schema-layer-editor {
  display: grid;
  gap: 0.55rem;
  min-width: 0;
  margin: 0;
  padding: 0.65rem;
  border: 1px solid #d2ded9;
  border-radius: 0.4rem;
}

.schema-layer-editor label:not(.checkbox-field) {
  display: grid;
  gap: 0.25rem;
}

.schema-layer-editor input[type="text"],
.schema-layer-editor input[type="number"] {
  min-width: 0;
  padding: 0.4rem 0.5rem;
  border: 1px solid #b8c8c1;
  border-radius: 0.3rem;
  font: inherit;
}

.schema-layer-editor input[type="color"] {
  width: 100%;
  height: 2rem;
  padding: 0.1rem;
  border: 1px solid #b8c8c1;
  border-radius: 0.3rem;
  background: #ffffff;
}

.color-fields {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(5.5rem, 1fr));
  gap: 0.55rem;
  min-width: 0;
}

.color-field {
  display: grid;
  gap: 0.25rem;
  min-width: 0;
}

.color-field > span,
.alpha-field span {
  overflow: hidden;
  font-size: 0.78rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.alpha-field {
  display: grid;
  gap: 0.1rem;
}

.alpha-field input {
  width: 100%;
  min-width: 0;
  margin: 0;
}

.range-field > span {
  display: flex;
  gap: 0.4rem;
  justify-content: space-between;
}

.range-field input {
  width: 100%;
  margin: 0;
}

.range-field output {
  color: #617870;
  font-variant-numeric: tabular-nums;
}

.checkbox-field {
  display: flex;
  gap: 0.4rem;
  align-items: center;
}
</style>
