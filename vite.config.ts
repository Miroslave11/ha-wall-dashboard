/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  // Immich při vývoji: stejná proxy jako v nginx.conf (adresa a API klíč z .env)
  const env = loadEnv(mode, ".", "");
  const immich = env.IMMICH_URL
    ? {
        "/immich": {
          target: env.IMMICH_URL,
          changeOrigin: true,
          rewrite: (p: string) => p.replace(/^\/immich/, ""),
          headers: { "x-api-key": env.IMMICH_API_KEY ?? "" },
        },
      }
    : undefined;

  return {
    plugins: [react()],
    server: {
      host: true, // dostupné i z tabletu v LAN při vývoji
      port: 5173,
      proxy: immich,
    },
    test: {
      environment: "jsdom",
      include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    },
  };
});
