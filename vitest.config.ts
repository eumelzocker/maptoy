import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "apps/**/*.test.ts",
      "packages/**/*.test.ts",
      "adapters/**/*.test.ts",
      "plugins/**/*.test.ts",
      "tests/**/*.test.ts",
    ],
  },
});
