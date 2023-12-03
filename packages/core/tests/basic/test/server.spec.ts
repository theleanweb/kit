import { test, expect } from "@playwright/test";

test.describe("Content-Type", () => {
  test("sets Content-Type", async ({ page }) => {
    const response = await page.goto("/content-type");
    expect(response).not.toBeNull();
    expect(response!.headers()["content-type"]).toBe(
      "text/html; charset=UTF-8"
    );
  });
});

test.describe("Errors", () => {
  test("error rendering view", async ({ page }) => {
    const response = await page.goto("/errors/view");
    expect(response).not.toBeNull();
    expect(response!.status()).toBe(500);
    expect(await response!.text()).toContain("user is not defined");
  });

  test("error evaluating handler", async ({ request }) => {
    const response = await request.get("/errors/handler");
    expect(response.status()).toBe(500);
  });
});

test.describe("Headers", () => {
  test("set-cookie headers", async ({ request }) => {
    const response = await request.get("/headers/set-cookie");

    if (response) {
      const cookies = response.headers()["set-cookie"];
      expect(cookies).toMatch("cookie2=value2");
    }
  });
});

test.describe("Cookie", () => {
  test("set-cookie", async ({ page }) => {
    const response = await page.goto("/set-cookie");

    if (response) {
      const cookies = (await response.allHeaders())["set-cookie"];
      expect(cookies).toMatch("cookie1=value1");
    }
  });
});

test.describe("ENV", () => {
  test("get private env in server", async ({ request }) => {
    const response = await request.get("/env/private");

    expect(await response.json()).toEqual({
      PRIVATE_STATIC: "accessible to server-side code/replaced at build time",
      // PRIVATE_DYNAMIC: "accessible to server-side code/evaluated at run time",
    });
  });

  test("get public env in server", async ({ request }) => {
    const response = await request.get("/env/public");

    expect(await response.json()).toEqual({
      PUBLIC_STATIC: "accessible anywhere/replaced at build time",
      // PUBLIC_DYNAMIC: "accessible anywhere/evaluated at run time",
    });
  });

  // test("get private env in view", async () => {});

  // test("get public env in view", async () => {});
});
