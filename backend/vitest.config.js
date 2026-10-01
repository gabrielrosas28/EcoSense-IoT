import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globalSetup: ["./tests/support/globalSetup.js"],
    setupFiles: ["./tests/support/setup.js"],
    // Todos os arquivos usam o mesmo banco: um arquivo de cada vez.
    fileParallelism: false,
    restoreMocks: true,
    // Log da aplicação só aparece quando um teste falha.
    silent: "passed-only",
  },
});
