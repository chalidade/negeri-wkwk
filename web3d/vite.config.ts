import { defineConfig } from "vite";

export default defineConfig({
  base: "/",
  // Engine & data papan dibagi dengan server (supabase/functions/_shared).
  server: { fs: { allow: [".."] } },
  build: { outDir: "dist", chunkSizeWarningLimit: 1500 },
});
