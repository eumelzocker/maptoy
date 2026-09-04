import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

describe("Map Set form feedback", () => {
  it("shows save errors immediately above the form actions", async () => {
    const [form, view] = await Promise.all([
      readFile(
        fileURLToPath(new URL("./components/MapSetForm.vue", import.meta.url)),
        "utf8",
      ),
      readFile(
        fileURLToPath(new URL("./views/MapSetsView.vue", import.meta.url)),
        "utf8",
      ),
    ]);

    const lastFieldset = form.lastIndexOf("</fieldset>");
    const formError = form.indexOf('v-if="formError"', lastFieldset);
    const formActions = form.indexOf('class="form-actions"', formError);

    expect(lastFieldset).toBeGreaterThan(-1);
    expect(formError).toBeGreaterThan(lastFieldset);
    expect(formActions).toBeGreaterThan(formError);
    expect(view).toContain("const saveError = ref<string | null>(null)");
    expect(view).toContain("saveError.value =");
    expect(view).toContain(':error="saveError"');
  });

  it("shows the maximum cache age as a formatted duration", async () => {
    const form = await readFile(
      fileURLToPath(new URL("./components/MapSetForm.vue", import.meta.url)),
      "utf8",
    );

    expect(form).toContain(
      'import { formatDurationMinutes } from "../durationFormat.js"',
    );
    expect(form).toContain('aria-describedby="maximum-cache-age-duration"');
    expect(form).toContain(
      "formatDurationMinutes(Math.round(draft.cachePolicy.maximumAgeSeconds / 60))",
    );
  });
});
