import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: path.resolve(projectRoot, "client"),
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": path.resolve(projectRoot, "client/src") } },
  publicDir: path.resolve(projectRoot, "client/public"),
  build: { outDir: path.resolve(projectRoot, "dist/public"), emptyOutDir: true },
  server: { host: "0.0.0.0", port: 3000, strictPort: false },
});
