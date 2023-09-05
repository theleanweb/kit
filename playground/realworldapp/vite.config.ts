import { defineConfig } from "vite";
import { leanweb } from "leanweb-kit/vite";
import adapter from "adapter-node";
import path from "node:path";

export default defineConfig({
  plugins: [
    leanweb({
      adapter: adapter(),
      files: { entry: "src/router" },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
