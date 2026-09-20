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

  test("moves between neighbouring articles with previous and next buttons", async ({ page }) => {
    const navigation = page.locator("#guideSectionNavigation");
    const previous = navigation.locator(".guide-section-navigation__button--previous");
    const next = navigation.locator(".guide-section-navigation__button--next");

    await expect(navigation).toBeVisible();
    await expect(previous).toBeHidden();
    await expect(next).toBeVisible();
    await expect(next).toContainText("Next section");
    await expect(next).toContainText("Interests");

    await next.click();
    await expect(page.locator("#guide-ml.is-active")).toBeVisible();
    await expect(previous).toBeVisible();
    await expect(previous).toContainText("Previous section");
    await expect(previous).toContainText("UniFit");

    await previous.click();
    await expect(page.locator("#guide-unifit.is-active")).toBeVisible();

    await page.locator('.guide-nav a[href$="#guide-glossary"]').click();
    await expect(previous).toBeVisible();
    await expect(next).toBeHidden();
  });

  test("supports deep links to guide sections", async ({ page }) => {
    await page.goto("/guide.html#guide-roi");
    await page.waitForSelector("#guidePage");
    await expect(page.locator("#guide-roi.is-active")).toBeVisible();
    await expect(page.locator("#guide-unifit")).toBeHidden();
  });
});
