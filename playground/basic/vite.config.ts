import { defineConfig } from "vite";
import { leanweb } from "leanweb-kit/vite";
import adapter from "@leanweb-kit/adapter-cloudflare";
import path from "node:path";

export default defineConfig({
  plugins: [
    leanweb({
      adapter: adapter(),
      files: {
        // entry: "src/entry.mts",
        // // @ts-expect-error
        // entry: null,
        views: "src/views/pages",
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
