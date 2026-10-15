const { test, expect } = require("./helpers/coverage-test.cjs");
const { markTourAsSeen } = require("./helpers/personas");

test("offline and restored connections show one accessible status banner", async ({ page }) => {
  await markTourAsSeen(page);
  await page.goto("/index.html");
  await expect(page.locator("body")).toHaveAttribute("data-page", "universities");
  await expect(page.locator("#profileBtn")).toBeVisible();

  const banner = page.locator("#networkStatusBanner");
  await page.context().setOffline(true);
  await expect(banner).toHaveAttribute("role", "status");
  await expect(banner).toHaveClass(/network-status-banner--offline/);
  await expect(banner).toContainText("You are offline.");
  await expect(page.locator("#networkStatusBanner")).toHaveCount(1);

  await page.context().setOffline(false);
  await expect(banner).toHaveClass(/network-status-banner--online/);
  await expect(banner).toContainText("Connection restored.");
  await expect(banner).not.toHaveClass(/is-visible/, { timeout: 5000 });
});
