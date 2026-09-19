const { test, expect } = require("@playwright/test");

test.describe("guide navigation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/guide.html");
    await page.waitForSelector("#guidePage");
    await expect(page.locator("#guide-unifit.is-active")).toBeVisible();
  });

  test("shows a single active article with a grouped sidebar", async ({ page }) => {
    await expect(page.locator(".guide-nav-group")).toHaveCount(4);
    await expect(page.locator(".guide-section")).toHaveCount(11);
    await expect(page.locator(".guide-section.is-active")).toHaveCount(1);
    await expect(page.locator("#guide-glossary")).toBeHidden();
  });

  test("switches articles via sidebar navigation and does not render in-article toc", async ({ page }) => {
    await page.locator('.guide-nav a[href$="#guide-tags"]').click();
    await expect(page.locator("#guide-tags.is-active")).toBeVisible();
    await expect(page.locator("#guide-unifit")).toBeHidden();
    await expect(page.locator("#guideToc")).toHaveCount(0);

    await page.locator('.guide-nav a[href$="#guide-glossary"]').click();
    await expect(page.locator("#guide-glossary.is-active")).toBeVisible();
    await expect(page.locator("#guide-tags")).toBeHidden();
    await expect(page.locator(".guide-content")).toBeVisible();
  });

  test("uses a compact, labelled contents disclosure on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    const contents = page.locator("#guideMobileNavToggle");
    await expect(contents).toBeVisible();
    await expect(contents).toHaveAttribute("aria-expanded", "false");
    await expect(contents).toContainText("Contents");
    await expect(contents).not.toContainText("UniFit");
    await expect(page.locator("#guideNav")).toBeHidden();

    await contents.click();
    await expect(contents).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator("#guideNav")).toBeVisible();
    await expect(page.locator('[data-guide-group="unifit"] .guide-nav-title')).toHaveText("Discovery & comparison");

    await page.locator('.guide-nav a[href$="#guide-tags"]').click();
    await expect(page.locator("#guide-tags.is-active")).toBeVisible();
    await expect(contents).toHaveAttribute("aria-expanded", "false");
    await expect(contents).not.toContainText("Tags");
  });

  test("overscrolling at the end of an article pulls into the following article", async ({ page }) => {
    const control = page.locator("#guideNextSection");
    await expect(control).toBeHidden();

    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect(control).toHaveClass(/is-ready/);
    await page.mouse.wheel(0, 24);
    await page.mouse.wheel(0, 24);
    await page.mouse.wheel(0, 24);
    await expect(control).toHaveClass(/is-armed/);

    await page.waitForTimeout(120);
    await expect(page.locator("#guide-unifit.is-active")).toBeVisible();
    await expect(page.locator("#guide-ml.is-active")).toBeVisible();
    await expect(control).toBeHidden();
  });

  test("lets a near-complete pull continue briefly and cancels an armed pull in reverse", async ({ page }) => {
    const control = page.locator("#guideNextSection");
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));

    await page.mouse.wheel(0, 28);
    await page.mouse.wheel(0, 28);
    await page.waitForTimeout(170);
    await page.mouse.wheel(0, 28);
    await expect(control).toHaveClass(/is-armed/);

    await page.mouse.wheel(0, -12);
    await page.waitForTimeout(320);
    await expect(page.locator("#guide-unifit.is-active")).toBeVisible();
  });

  test("supports deep links to guide sections", async ({ page }) => {
    await page.goto("/guide.html#guide-roi");
    await page.waitForSelector("#guidePage");
    await expect(page.locator("#guide-roi.is-active")).toBeVisible();
    await expect(page.locator("#guide-unifit")).toBeHidden();
  });
});
