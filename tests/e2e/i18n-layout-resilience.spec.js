const { test, expect } = require("@playwright/test");
const { markTourAsSeen } = require("./helpers/personas");

test("navbar stays available when a localization pack is slow", async ({ page }) => {
  await markTourAsSeen(page);
  await page.addInitScript(() => {
    localStorage.setItem("unisearch_ui_language_v1", "rus");
  });

  await page.route("**/Localization/ru*", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 10_000));
    try {
      await route.fulfill({
        status: 200,
        contentType: "text/plain",
        body: "meta.code: RU\n",
      });
    } catch (e) {
      // request can be aborted by i18n timeout logic
    }
  });

  await page.goto("/universities.html");
  await expect(page.locator("#profileBtn")).toBeVisible({ timeout: 7_000 });
  await expect(page.locator("#languageSelect")).toHaveValue("rus");
});
