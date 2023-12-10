import { test, expect } from "@playwright/test";

test.describe("View files", () => {
  test("renders imported view components", async ({ page }) => {
    (await page.goto("/views"))!;
    const header = page.getByTestId("header");
    const footer = page.getByTestId("footer");
    expect(await header.textContent()).toMatch("Header");
    expect(await footer.textContent()).toMatch("Footer");
  });

  test("renders deeply nested view and imported components", async ({
    page,
  }) => {
    (await page.goto("/views/nested"))!;
    const header = page.getByTestId("header");
    const footer = page.getByTestId("footer");
    expect(await header.textContent()).toMatch("Header");
    expect(await footer.textContent()).toMatch("Footer");
  });

  test("can import assets i.e javascript etc", async ({ page }) => {
    (await page.goto("/views/imports/assets"))!;
    const el = page.getByTestId("result");
    expect(await el.textContent()).toMatch("1 + 2 = 3");
  });

  test("should render views in folders with index.html without file extension", async ({
    page,
  }) => {
    const response = await page.goto("/views/index");
    expect(response).not.toBeNull();
    expect(response!.status()).toBe(200);
  });

  test("should include client side assets", async ({ page }) => {
    await page.goto("/views/imports/client");
    await page.getByTestId("compute").click();
    const el = page.getByTestId("result");
    expect(await el.textContent()).toMatch("2 + 2 = 4");
  });
});
