import { test, expect } from "@playwright/test";

test.describe("Content-Type", () => {
  test("sets Content-Type", async ({ request }) => {
    const response = await request.get("/content-type");
    expect(response.headers()["content-type"]).toBe("text/html");
  });
});

test.describe("Errors", () => {
  test("error evaluating module", async ({ request }) => {
    const response = await request.get("/errors/init-error");
    expect(response.status()).toBe(500);
    expect(await response.text()).toMatch("user is not defined");
  });
});
