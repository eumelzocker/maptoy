import { defineStore } from "pinia";
import { ref } from "vue";
import {
  loadShowTitleBar,
  saveShowTitleBar,
} from "../mapDisplayPreferences.js";

export const useUiPreferencesStore = defineStore("ui-preferences", () => {
  const showTitleBar = ref(loadShowTitleBar());

  function setShowTitleBar(value: boolean): void {
    showTitleBar.value = value;
    saveShowTitleBar(value);
  }

  return { showTitleBar, setShowTitleBar };
});
