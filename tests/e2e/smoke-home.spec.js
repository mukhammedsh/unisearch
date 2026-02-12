const { test, expect } = require("@playwright/test");
const { markTourAsSeen } = require("./helpers/personas");
const { selectors } = require("./helpers/selectors");

test("home smoke: layout, stats, and profile modal are functional", async ({ page }) => {
  await markTourAsSeen(page);
  await page.goto("/index.html");

  await expect(page.locator(".hero-title")).toBeVisible();
  await expect(page.locator("#stat-uni")).toBeVisible();
  await expect(page.locator("#stat-countries")).toBeVisible();
  await expect(page.locator(selectors.profileBtn)).toBeVisible();

  await page.click(selectors.profileBtn);
  await expect(page.locator(selectors.profileModal)).toHaveClass(/is-open/);
  await page.click(selectors.profileCloseBtn);
  await expect(page.locator(selectors.profileModal)).not.toHaveClass(/is-open/);
});
