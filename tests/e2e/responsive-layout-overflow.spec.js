const { test, expect } = require("@playwright/test");

test.describe("Responsive Layout and Overflow Verification", () => {
  test("adjusts sidebar and mobile filter button based on desktop viewport", async ({ page }) => {
    // Set desktop viewport BEFORE loading the page
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/index.html");
    await page.waitForSelector(".uni-card");

    // On desktop, the filter sidebar must be visible
    const sidebar = page.locator("#uSidebar");
    await expect(sidebar).toBeVisible();

    // The mobile filter toggle button must be hidden
    const mobileFilterToggle = page.locator("#mobileFilterToggle");
    await expect(mobileFilterToggle).not.toBeVisible();
  });

  test("adjusts sidebar and mobile filter button based on mobile viewport", async ({ page }) => {
    // Set mobile viewport BEFORE loading the page
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/index.html");
    await page.waitForSelector(".uni-card");

    const sidebar = page.locator("#uSidebar");
    const mobileFilterToggle = page.locator("#mobileFilterToggle");

    // On mobile, the mobile filter toggle button must be visible
    await expect(mobileFilterToggle).toBeVisible();

    // The filter sidebar is hidden by default
    await expect(sidebar).not.toBeVisible();
  });
});
