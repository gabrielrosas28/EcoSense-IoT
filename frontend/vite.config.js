import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const backend = env.VITE_BACKEND_ORIGIN || "http://localhost:3000";

  return {
    plugins: [react()],
    server: {
      port: 5173,
      // Enquanto o backend não estiver no ar, as chamadas falham em silêncio
      // (services/api.js trata) e a UI continua funcionando pelo store.
      proxy: {
        "/api": { target: backend, changeOrigin: true },
        "/ws": { target: backend, ws: true, changeOrigin: true },
      },
    },
  };
});
