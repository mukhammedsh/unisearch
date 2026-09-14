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

  test("displays kicker, 404 code, and primary action button", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/404.html");

    const kicker = page.locator(".error-kicker");
    await expect(kicker).toBeVisible();

    const code = page.locator(".error-code");
    await expect(code).toBeVisible();
    await expect(code).toHaveText("404");

    const title = page.locator(".error-title");
    await expect(title).toBeVisible();

    const desc = page.locator(".error-desc");
    await expect(desc).toBeVisible();

    const button = page.locator(".error-btn--primary");
    await expect(button).toBeVisible();
    await expect(button).toHaveAttribute("href", "index.html");
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

  test("centers error content horizontally within main area on desktop", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/404.html");

    const shell = page.locator(".error-shell");
    await expect(shell).toBeVisible();

    const shellBox = await shell.boundingBox();
    expect(shellBox).not.toBeNull();

    const shellCenterX = shellBox.x + shellBox.width / 2;
    expect(Math.abs(shellCenterX - 720)).toBeLessThanOrEqual(20);
  });
});
