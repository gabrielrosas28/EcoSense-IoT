import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
    // Cada arquivo de teste roda isolado: mocks de um não vazam para o outro.
    restoreMocks: true,
    clearMocks: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.ts"],
      exclude: [
        "src/server.ts",   // bootstrap: só liga as peças
        "src/types/**",    // só tipos, some na compilação
        "src/lib/prisma.ts", // é justamente o módulo que os testes substituem
      ],
    },
  },
});
