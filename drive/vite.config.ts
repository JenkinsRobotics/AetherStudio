import { env } from "node:process";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
const studioServer = env.AETHER_DEV_SERVER || "http://127.0.0.1:8781";

export default defineConfig({
  base: "./",
  plugins: [react()],
  server: {
    host: "127.0.0.1", strictPort: true, port: 5185,
    fs: { allow: ["."] },
    proxy: {
      "/api": { target: studioServer, changeOrigin: true, headers: { Origin: studioServer } },
      "/icons": { target: studioServer, changeOrigin: true },
    },
  },
});
