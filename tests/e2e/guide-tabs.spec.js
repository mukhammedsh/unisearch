const { test, expect } = require("@playwright/test");

test.describe("guide tabs and table of contents", () => {
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

  test("switches articles and rebuilds the table of contents", async ({ page }) => {
    await page.locator('.guide-nav a[href$="#guide-tags"]').click();
    await expect(page.locator("#guide-tags.is-active")).toBeVisible();
    await expect(page.locator("#guide-unifit")).toBeHidden();
    await expect(page.locator("#guideToc")).toBeVisible();
    await expect(page.locator(".guide-content #guideToc")).toBeVisible();
    await expect(page.locator("#guideTocPage")).toHaveCount(0);
    await expect(page.locator("#guideTocChapter a")).toHaveCount(5);

    await page.locator('.guide-nav a[href$="#guide-glossary"]').click();
    await expect(page.locator("#guide-glossary.is-active")).toBeVisible();
    await expect(page.locator("#guideToc")).toBeHidden();
    await expect(page.locator(".guide-content")).toBeVisible();
  });

  test("supports deep links to guide sections", async ({ page }) => {
    await page.goto("/guide.html#guide-roi");
    await page.waitForSelector("#guidePage");
    await expect(page.locator("#guide-roi.is-active")).toBeVisible();
    await expect(page.locator("#guide-unifit")).toBeHidden();
  });

  test("toc toggle collapses the contents body", async ({ page }) => {
    await expect(page.locator("#guideTocBody")).toBeVisible();
    await page.locator("#guideTocToggle").click();
    await expect(page.locator("#guideTocBody")).toBeHidden();
    await expect(page.locator("#guideTocToggle")).toHaveAttribute("aria-expanded", "false");
    await page.locator("#guideTocToggle").click();
    await expect(page.locator("#guideTocBody")).toBeVisible();
    await expect(page.locator("#guideTocToggle")).toHaveAttribute("aria-expanded", "true");
  });
});
