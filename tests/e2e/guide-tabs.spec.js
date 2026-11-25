const { test, expect } = require("./helpers/coverage-test.cjs");

test.describe("guide navigation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/guide.html");
    await page.waitForSelector("#guidePage");
    await expect(page.locator("#guide-start.is-active")).toBeVisible();
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
    await expect(page.locator("#guide-start")).toBeHidden();
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
    await expect(contents).not.toContainText("Getting started");
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
    await expect(next).toContainText("UniFit");

    await next.click();
    await expect(page.locator("#guide-unifit.is-active")).toBeVisible();
    await expect(previous).toBeVisible();
    await expect(previous).toContainText("Previous section");
    await expect(previous).toContainText("Getting started");

    await previous.click();
    await expect(page.locator("#guide-start.is-active")).toBeVisible();

    await page.locator('.guide-nav a[href$="#guide-glossary"]').click();
    await expect(previous).toBeVisible();
    await expect(next).toBeHidden();
  });

  test("supports deep links to guide sections", async ({ page }) => {
    await page.goto("/guide.html#guide-comparison");
    await page.waitForSelector("#guidePage");
    await expect(page.locator("#guide-comparison.is-active")).toBeVisible();
    await expect(page.locator("#guide-start")).toBeHidden();
  });
});

test.describe("Guide article links", () => {
  for (const { language, width, budgetHeading } of [
    { language: "eng", width: 1519, budgetHeading: "Annual budget" },
    { language: "rus", width: 390, budgetHeading: "Годовой бюджет" },
    { language: "kaz", width: 1519, budgetHeading: "Жылдық бюджет" },
  ]) {
    test(`opens a linked Guide article and returns to the source in ${language}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.addInitScript((lang) => localStorage.setItem("unisearch_ui_language_v1", lang), language);
      await page.goto("/guide.html#guide-tags");
      const badges = page.locator("#guide-tags");
      const uniFitLink = badges.getByRole("link", { name: "UniFit", exact: true }).first();
      await expect(uniFitLink).toBeVisible();
      await uniFitLink.press("Enter");

      const uniFit = page.locator("#guide-unifit");
      await expect(page).toHaveURL(/#guide-unifit$/);
      await expect(uniFit.getByRole("heading", { level: 2 })).toBeFocused();
      await expect(uniFit.getByRole("heading", { name: budgetHeading })).toBeVisible();
      await expect(page.locator('#guideNav a[aria-current="page"]')).toHaveAttribute("href", /#guide-unifit$/);
      await expect(uniFit.locator(".guide-doc > details:last-child")).toBeVisible();
      await expect(uniFit.locator("details[open]")).toHaveCount(0);

      await page.goBack();
      await expect(page).toHaveURL(/#guide-tags$/);
      await expect(badges).toBeVisible();
      await expect(uniFit).toBeHidden();
    });
  }
});
