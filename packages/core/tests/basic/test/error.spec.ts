import { test, expect } from "@playwright/test";

test.describe("Errors", () => {
  test("error rendering view", async ({ page }) => {
    const response = (await page.goto("/errors/view"))!;
    expect(response.status()).toBe(500);
    expect(await response.text()).toContain("user is not defined");
  });

  test("error evaluating handler", async ({ request }) => {
    const response = await request.get("/errors/handler");
    expect(response.status()).toBe(500);
  });
});
