import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(import.meta.dirname, "popup.html"),
        library: resolve(import.meta.dirname, "library.html"),
        options: resolve(import.meta.dirname, "options.html"),
        background: resolve(import.meta.dirname, "src/background/index.ts")
      },
      output: {
        entryFileNames: (chunk) => chunk.name === "background" ? "background.js" : "assets/[name]-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]"
      }
    }
  },
  test: {
    environment: "jsdom",
    setupFiles: "./tests/setup.ts"
  }
});
