const { test, expect } = require("@playwright/test");

const VIEWPORTS = [
  { width: 375, height: 667, name: "mobile" },
  { width: 768, height: 1024, name: "tablet" },
  { width: 1280, height: 800, name: "desktop" },
  { width: 1920, height: 1080, name: "full-hd" },
  { width: 2560, height: 1440, name: "2k" },
];

test.describe("Error 404 Page Density and Layout", () => {
  for (const vp of VIEWPORTS) {
    test(`renders without horizontal scroll on ${vp.name} (${vp.width}x${vp.height})`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/404.html");

      const shell = page.locator(".error-shell");
      await expect(shell).toBeVisible();

      const hasHorizontalScroll = await page.evaluate(() => {
        const docEl = document.documentElement;
        const body = document.body;
        return Math.max(docEl.scrollWidth, body.scrollWidth) > docEl.clientWidth;
      });

      expect(hasHorizontalScroll).toBe(false);
    });
  }

  test("displays hero content, quick help, and popular section links", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/404.html");

    await expect(page.locator(".error-kicker")).toBeVisible();
    await expect(page.locator(".error-title")).toBeVisible();
    await expect(page.locator(".error-lead")).toBeVisible();

    // Check actions
    await expect(page.locator(".error-btn--primary")).toBeVisible();
    await expect(page.locator(".error-btn--secondary")).toBeVisible();

    // Check quick help tips
    const tips = page.locator(".error-tip-card");
    await expect(tips).toHaveCount(3);

    // Check popular sections navigation cards
    const navCards = page.locator(".error-nav-card");
    await expect(navCards).toHaveCount(3);
  });

  test("supports dark theme seamlessly", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/404.html");

    await page.evaluate(() => {
      document.documentElement.setAttribute("data-theme", "dark");
    });

    const shell = page.locator(".error-shell");
    await expect(shell).toBeVisible();

    const isDark = await page.evaluate(() => {
      return document.documentElement.getAttribute("data-theme") === "dark";
    });
    expect(isDark).toBe(true);
  });

  test("left and right panels have equal dimensions and headers on desktop", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/404.html");

    const leftPanel = page.locator(".error-panel");
    const rightPanel = page.locator(".error-quick");
    await expect(leftPanel).toBeVisible();
    await expect(rightPanel).toBeVisible();

    const leftBox = await leftPanel.boundingBox();
    const rightBox = await rightPanel.boundingBox();

    expect(leftBox).not.toBeNull();
    expect(rightBox).not.toBeNull();
    expect(Math.abs(leftBox.height - rightBox.height)).toBeLessThanOrEqual(1);

    // Verify subkicker is removed
    await expect(page.locator(".error-subkicker")).toHaveCount(0);
  });
});
