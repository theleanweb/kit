import { test, expect } from "@playwright/test";

test.describe("Headers", () => {
  test("set Content-Type", async ({ request }) => {
    const response = await request.get("/headers/content-type");
    expect(response.headers()["content-type"]).toBe("my/type");
  });

  //   test("set-cookie headers in view response", async ({ page }) => {
  //     const response = (await page.goto("/headers/set-cookie/view"))!;
  //     const cookies = response.allHeaders()["set-cookie"];
  //     console.log("headers: ", response.allHeaders());
  //     expect(cookies).toMatch("cookie2=value2");
  //   });

  //   test("set-cookie headers in handler response", async ({ request }) => {
  //     const response = await request.get("/headers/set-cookie/handler");
  //     const cookies = response.headers()["set-cookie"];
  //     expect(cookies).toMatch("cookie2=value2");
  //   });

  //   test("set custom headers in view response", async ({ page }) => {
  //     const response = (await page.goto("/headers/custom/view"))!;
  //     const cookies = response.allHeaders()["custom-header"];
  //     expect(cookies).toMatch("my-value");
  //   });

  //   test("set custom headers in API response", async ({ page }) => {
  //     const response = (await page.goto("/headers/custom/handler"))!;
  //     const cookies = response.allHeaders()["custom-header"];
  //     expect(cookies).toMatch("my-value");
  //   });
});
