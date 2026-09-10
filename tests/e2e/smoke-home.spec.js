const { test, expect } = require("@playwright/test");
const { markTourAsSeen } = require("./helpers/personas");
const { selectors } = require("./helpers/selectors");

test("root page opens the university catalog as the main workspace", async ({ page }) => {
  await markTourAsSeen(page);
  await page.goto("/index.html");

  await expect(page.locator("body")).toHaveAttribute("data-page", "universities");
  await expect(page.locator(".u-layout")).toBeVisible();
  await expect(page.locator("#universitiesList .uni-card:not(.is-skeleton)").first()).toBeVisible();
  await expect(page.locator(".navbar-center")).toHaveCount(0);
  await expect(page.locator(".navbar-logo-link")).toHaveAttribute("href", "index.html");
  await expect(page.locator("#universitySearch")).toBeVisible();
  await expect(page.locator(selectors.profileBtn)).toBeVisible();
});

test("desktop university search is centered independently of side controls", async ({ page }) => {
  await markTourAsSeen(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/index.html");

  const offset = await page.locator("#universitySearch").evaluate((nav) => {
    const box = nav.getBoundingClientRect();
    return Math.abs((box.left + box.width / 2) - (document.documentElement.clientWidth / 2));
  });

  expect(offset).toBeLessThanOrEqual(2);
});

test("root catalog has no horizontal overflow on narrow and wide screens", async ({ page }) => {
  await markTourAsSeen(page);
  for (const viewport of [
    { width: 375, height: 667 },
    { width: 1280, height: 800 },
    { width: 1920, height: 1080 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/index.html");
    await expect(page.locator(".u-page")).toBeVisible();

    const dimensions = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
  }
});
