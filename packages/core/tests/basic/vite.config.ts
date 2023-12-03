import { leanweb } from "leanweb-kit/vite";
import path from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [leanweb()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
