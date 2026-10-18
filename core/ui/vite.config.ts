/// <reference types="vitest/config" />
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// The engine lives in the CAD product (Aether CAD/aether-engine). The demos
// the real pipeline, so it resolves @aether/core straight from that source —
// npm's symlink alone is not enough because the target sits outside this
// project root.

export default defineConfig({
  root: "gallery",
  base: "./",
  plugins: [react()],
  // Keep mark PNG imports in Vite's asset pipeline instead of prebundling URLs.
  optimizeDeps: { exclude: ["@aether/assets/branding/marks/sources", "@aether/assets/branding/wordmarks/data", "@aether/assets/branding/wordmarks/downloads"] },
  server: { fs: { allow: [".."] }, proxy: { "/icons": "http://localhost:8780" } },
  build: {
    outDir: "../dist", emptyOutDir: true,
    rollupOptions: { input: {
      gallery: fileURLToPath(new URL("./gallery/index.html", import.meta.url)),
      workbench: fileURLToPath(new URL("./gallery/workbench-window.html", import.meta.url)),
      appMarks: fileURLToPath(new URL("./gallery/app-marks.html", import.meta.url)),
    } },
  },
  test: {
    root: ".",
    environment: "jsdom",
    globals: true,
    include: ["src/**/*.test.tsx"],
    // The theme test reads the generated tokens.css as text; vitest otherwise blanks CSS modules.
    css: { include: [/tokens\.css/] },
  },
});
