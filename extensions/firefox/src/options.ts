import { loadConfig, saveConfig } from "./storage.js";
import type { ExtensionConfig } from "./types.js";

function requiredElement<ElementType extends Element>(
  selector: string,
): ElementType {
  const element = document.querySelector<ElementType>(selector);
  if (element === null)
    throw new Error(`Missing required element: ${selector}`);
  return element;
}

const enabledEl = requiredElement<HTMLInputElement>("#enabled");
const loggingEl = requiredElement<HTMLInputElement>("#logging");
const maxResponseBytesEl = requiredElement<HTMLInputElement>(
  "#max-response-bytes",
);
const rulesEl = requiredElement<HTMLTextAreaElement>("#rules");
const saveEl = requiredElement<HTMLButtonElement>("#save");
const exportEl = requiredElement<HTMLButtonElement>("#export");
const importEl = requiredElement<HTMLInputElement>("#import");
const statusEl = requiredElement<HTMLSpanElement>("#status");
const errorEl = requiredElement<HTMLDivElement>("#error");
const exampleJsonEl = requiredElement<HTMLPreElement>("#example-json");

function render(config: ExtensionConfig): void {
  enabledEl.checked = config.enabled ?? true;
  loggingEl.checked = config.logging ?? false;
  maxResponseBytesEl.value =
    config.maxResponseBytes === null
      ? ""
      : String(config.maxResponseBytes ?? 10 * 1024 * 1024);
  rulesEl.value = JSON.stringify(config.rules, null, 2);
}

function currentConfig(): ExtensionConfig {
  const rules = JSON.parse(rulesEl.value);
  const rawMaximum = maxResponseBytesEl.value.trim();
  const maxResponseBytes = rawMaximum === "" ? null : Number(rawMaximum);
  if (
    maxResponseBytes !== null &&
    (!Number.isSafeInteger(maxResponseBytes) || maxResponseBytes < 1)
  ) {
    throw new Error(
      "Maximum response bytes must be a positive integer or blank.",
    );
  }
  return {
    enabled: enabledEl.checked,
    logging: loggingEl.checked,
    maxResponseBytes,
    rules,
  };
}

function showError(err: unknown): void {
  errorEl.textContent = err instanceof Error ? err.message : String(err);
}

saveEl.addEventListener("click", () => {
  errorEl.textContent = "";
  try {
    void saveConfig(currentConfig()).then(() => {
      statusEl.textContent = "Saved.";
      setTimeout(() => (statusEl.textContent = ""), 2000);
    });
  } catch (err) {
    showError(err);
  }
});

exportEl.addEventListener("click", () => {
  errorEl.textContent = "";
  try {
    const blob = new Blob([JSON.stringify(currentConfig(), null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "maptoy-ff-ext-config.json";
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    showError(err);
  }
});

importEl.addEventListener("change", () => {
  const file = importEl.files?.[0];
  if (!file) return;
  errorEl.textContent = "";
  void file
    .text()
    .then((text) => render(JSON.parse(text) as ExtensionConfig))
    .catch(showError)
    .finally(() => {
      importEl.value = "";
    });
});

void loadConfig().then(render);

void fetch("example-config.json")
  .then((res) => res.text())
  .then((text) => (exampleJsonEl.textContent = text))
  .catch(() => (exampleJsonEl.textContent = "(example-config.json not found)"));
