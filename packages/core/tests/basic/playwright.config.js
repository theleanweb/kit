import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  webServer: {
    port: 5173,
    command: "pnpm dev",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
