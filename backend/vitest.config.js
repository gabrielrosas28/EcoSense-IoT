import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globalSetup: ["./tests/support/globalSetup.js"],
    setupFiles: ["./tests/support/setup.js"],
    fileParallelism: false,
    restoreMocks: true,
    silent: "passed-only",
  },
});
