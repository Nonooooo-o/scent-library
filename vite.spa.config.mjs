import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const rootDirectory = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: path.join(rootDirectory, "spa"),
  publicDir: path.join(rootDirectory, "public"),
  plugins: [react()],
  server: { host: "0.0.0.0", allowedHosts: ["terminal.local"] },
  build: {
    outDir: path.join(rootDirectory, "dist", "client"),
    emptyOutDir: true,
    assetsDir: "assets",
    // never inline fonts as data: URIs — the CSP (public/_headers) only allows them from self
    assetsInlineLimit: 0,
  },
  preview: {
    host: "127.0.0.1",
    port: 3210,
    strictPort: true,
  },
});
