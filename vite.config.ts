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
      // Keep the browser's Host header (the string shorthand sets changeOrigin: true), so the
      // server's same-origin CSRF check sees localhost:5173 on both Origin and Host.
      proxy: { "/api": { target: "http://localhost:3000", changeOrigin: false } },
    },
  };
});
