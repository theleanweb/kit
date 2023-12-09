import { expect, test } from "@playwright/test";

const private_static = {
  PRIVATE_STATIC: "accessible to server-side code/replaced at build time",
};

const public_static = {
  PUBLIC_STATIC: "accessible anywhere/replaced at build time",
};

const toString = (env: object) => {
  return [...Object.entries(env)]
    .reduce((acc, [key, value]) => [...acc, `${key}: ${value}`], [] as string[])
    .join("\n");
};

test.describe("ENV", () => {
  test.describe("Private env", () => {
    test("get private env in API handler", async ({ request }) => {
      const response = await request.get("/env/private/handler");
      const json = await response.json();
      expect(json).toEqual(private_static);
    });
  });

  test.describe("Public env", () => {
    test("get public env in API handler", async ({ request }) => {
      const response = await request.get("/env/public/handler");
      const json = await response.json();
      expect(json).toEqual(public_static);
    });

    test("get public env in view", async ({ page }) => {
      const response = await page.goto("/env/public/view");
      const html = await response!.text();
      expect(html).toContain(toString(public_static));
    });
  });
});
