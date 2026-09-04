const { test, expect } = require("@playwright/test");
const { markTourAsSeen } = require("./helpers/personas");
const { selectors } = require("./helpers/selectors");

test("home smoke: layout, stats, and profile navigation are functional", async ({ page }) => {
  await markTourAsSeen(page);
  await page.goto("/index.html");

  await expect(page.locator(".hero-title")).toBeVisible();
  await expect(page.locator("#stat-uni")).toBeVisible();
  await expect(page.locator("#stat-countries")).toBeVisible();
  await expect(page.locator(selectors.profileBtn)).toBeVisible();

  await page.click(selectors.profileBtn);
  await expect(page).toHaveURL(/profile/);
  await expect(page.locator(selectors.profileModal)).toHaveClass(/is-open/);
  await page.click(selectors.profileCloseBtn);
  await expect(page).not.toHaveURL(/profile/);
});

test("home responsive: no horizontal overflow across viewports", async ({ page }) => {
  await markTourAsSeen(page);
  const viewports = [
    { width: 375, height: 667 },
    { width: 768, height: 1024 },
    { width: 1280, height: 800 },
    { width: 1440, height: 900 },
    { width: 1920, height: 1080 },
    { width: 2560, height: 1440 },
  ];

  for (const vp of viewports) {
    await page.setViewportSize(vp);
    await page.goto("/index.html");

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);

    await expect(page.locator(".hero-title")).toBeVisible();
    await expect(page.locator(".home-hero")).toBeVisible();
    await expect(page.locator(".home-features")).toBeVisible();
  }
});
