import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  timeout: 45000,
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
