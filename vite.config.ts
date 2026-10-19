import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

// `vite build --mode standalone` produces one self-contained HTML file that runs
// entirely in the browser (data in localStorage, AI called directly with your key).
export default defineConfig(({ mode }) => {
  const standalone = mode === "standalone";
  return {
    root: "client",
    plugins: standalone ? [react(), viteSingleFile()] : [react()],
    define: { __STANDALONE__: JSON.stringify(standalone) },
    build: standalone
      ? { outDir: "../dist-standalone", emptyOutDir: true, assetsInlineLimit: 100_000_000 }
      : { outDir: "../dist-client", emptyOutDir: true },
    server: {
      port: 5173,
      proxy: { "/api": "http://localhost:3000" },
    },
  };
});
