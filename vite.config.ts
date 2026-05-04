import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

const host = process.env.TAURI_DEV_HOST;

export default defineConfig(async () => ({
  plugins: [vue()],

  // pdfjs-dist ships its worker as a separate file we copy to /public.
  // Excluding it from optimizeDeps avoids Vite trying to pre-bundle the worker.
  optimizeDeps: {
    exclude: ["pdfjs-dist"],
  },

  // Vite options tailored for Tauri development.
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // Tauri rebuilds will trigger here otherwise.
      ignored: ["**/src-tauri/**"],
    },
  },

  // No chunk splitting needed for a desktop app with a single page.
  build: {
    target: "esnext",
    minify: "esbuild",
    sourcemap: false,
  },
}));
