<script setup lang="ts">
defineProps<{
  label: string;
  expanded: boolean;
}>();

defineEmits<{
  click: [];
}>();
</script>

<template>
  <button
    class="map-side-control-button"
    type="button"
    :aria-label="label"
    :title="label"
    :aria-expanded="expanded"
    @click="$emit('click')"
  >
    <slot></slot>
  </button>
</template>

<style scoped>
.map-side-control-button {
  display: grid;
  width: 2.35rem;
  height: 2.35rem;
  padding: 0;
  place-items: center;
  border: 0;
  border-radius: 0.25rem;
  color: #163832;
  background: #fff;
  box-shadow: 0 1px 5px rgb(0 0 0 / 40%);
  font: inherit;
  font-size: 1.25rem;
  cursor: pointer;
}

.map-side-control-button:hover,
.map-side-control-button:focus-visible,
.map-side-control-button[aria-expanded="true"] {
  background: #f4f4f4;
}

.map-side-control-button:focus-visible {
  outline: 2px solid #a34521;
  outline-offset: 1px;
}
</style>
