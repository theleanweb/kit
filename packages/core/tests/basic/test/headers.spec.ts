import { test, expect } from "@playwright/test";

test.describe("Headers", () => {
  test("set Content-Type", async ({ request }) => {
    const response = await request.get("/headers/content-type");
    expect(response.headers()["content-type"]).toBe("my/type");
  });

  test("set-cookie headers in handler response", async ({ request }) => {
    const response = await request.get("/headers/set-cookie/handler");
    const cookies = response.headers()["set-cookie"];
    expect(cookies).toMatch("cookie2=value2");
  });

  test("set custom headers in view response", async ({ page }) => {
    const response = (await page.goto("/headers/custom/view"))!;
    const cookies = (await response.allHeaders())["custom-header"];
    expect(cookies).toMatch("my-value");
  });

  test("set custom headers in server response", async ({ request }) => {
    const response = await request.get("/headers/custom/handler");
    const cookies = response.headers()["custom-header"];
    expect(cookies).toMatch("my-value");
  });
});
