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

  test("opens topics from a list on mobile and switches them from the contents sheet", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    const nav = page.locator("#guideNav");
    const sheet = page.locator("#guideNavSheet");
    const contents = page.locator("#guideMobileNavToggle");
    await expect(nav).toBeVisible();
    await expect(page.locator(".guide-content")).toBeHidden();
    await expect(page.locator("#guideSectionBar")).toBeHidden();
    await expect(page.locator('[data-guide-group="unifit"] .guide-nav-title')).toHaveText("Discovery & comparison");

    await page.locator('.guide-nav a[href$="#guide-tags"]').click();
    await expect(page).toHaveURL(/#guide-tags$/);
    await expect(page.locator("#guide-tags.is-active")).toBeVisible();
    await expect(page.locator("#guide-tags h2")).toBeFocused();
    await expect(nav).toBeHidden();
    await expect(page.locator("#guideSectionBarTitle")).toHaveText("Catalog badges");
    await expect(page.locator("#guideSectionBarGroup")).toHaveText("Discovery & comparison");
    await expect(contents).toHaveAttribute("aria-label", "Contents: Catalog badges");

    await contents.click();
    await expect(sheet).toBeVisible();
    await expect(contents).toHaveAttribute("aria-expanded", "true");
    await expect(sheet.locator('a[aria-current="page"]')).toHaveAttribute("href", /#guide-tags$/);
    await sheet.locator('a[href$="#guide-glossary"]').click();
    await expect(sheet).toBeHidden();
    await expect(contents).toHaveAttribute("aria-expanded", "false");
    await expect(page.locator("#guide-glossary.is-active")).toBeVisible();
    await expect(page.locator("#guide-glossary h2")).toBeFocused();

    await page.locator("#guideHubLink").click();
    await expect(page).toHaveURL(/\/guide(\.html)?$/);
    await expect(nav).toBeVisible();
    await expect(page.locator(".guide-content")).toBeHidden();

    await page.locator('.guide-nav a[href$="#guide-comparison"]').click();
    await expect(page.locator("#guide-comparison.is-active")).toBeVisible();
    await page.goBack();
    await expect(nav).toBeVisible();
    await expect(page.locator("#guide-comparison")).toBeHidden();
  });

  test("returns to the topic list on mobile after following a link inside an article", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('.guide-nav a[href$="#guide-tags"]').click();
    await page.locator("#guide-tags").getByRole("link", { name: "UniFit", exact: true }).first().click();
    await expect(page.locator("#guide-unifit.is-active")).toBeVisible();

    await page.locator("#guideHubLink").click();
    await expect(page).toHaveURL(/\/guide(\.html)?$/);
    await expect(page.locator("#guideNav")).toBeVisible();
    await expect(page.locator(".guide-content")).toBeHidden();
  });

  test("closes the contents sheet with Escape on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/guide.html#guide-ml");
    await page.waitForSelector("#guidePage");
    const contents = page.locator("#guideMobileNavToggle");
    await contents.click();
    await expect(page.locator("#guideNavSheet")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator("#guideNavSheet")).toBeHidden();
    await expect(contents).toHaveAttribute("aria-expanded", "false");
    await expect(contents).toBeFocused();
    await expect(page.locator("#guide-ml.is-active")).toBeVisible();
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

  test("Back returns to the catalog after opening the Guide from the app", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("unisearch_universities_tour_seen_v1", "1"));
    await page.goto("/index.html");
    await page.waitForSelector(".uni-card");
    await page.locator(".footer-product-links a[data-route='guide']").click();
    await expect(page.locator("#guidePage")).toBeVisible();
    await page.locator(".guide-back").click();
    await expect(page.locator("body")).toHaveAttribute("data-page", "universities");
  });

  test("Back falls back to the catalog when the Guide is opened directly", async ({ page }) => {
    await page.goto("/guide.html");
    await page.waitForSelector("#guidePage");
    await page.locator(".guide-back").click();
    await expect(page.locator("body")).toHaveAttribute("data-page", "universities");
    await expect(page).toHaveURL(/\/index\.html$/);
  });

  test("keeps the active article in sync with browser history, external updates, and resizing", async ({ page }) => {
    await page.goto("/guide.html");
    await page.waitForSelector("#guidePage");
    await page.evaluate(() => { window.location.hash = "#guide-glossary"; });
    await expect(page.locator("#guide-glossary.is-active")).toBeVisible();
    await page.evaluate(() => { window.location.hash = "#not-a-guide-section"; });
    await expect(page.locator("#guide-glossary.is-active")).toBeVisible();
    await page.evaluate(() => { window.location.hash = ""; });
    await expect(page.locator("#guide-start.is-active")).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('.guide-nav a[href$="#guide-tags"]').click();
    const contents = page.locator("#guideMobileNavToggle");
    await contents.click();
    await expect(contents).toHaveAttribute("aria-expanded", "true");
    await page.setViewportSize({ width: 1280, height: 844 });
    await expect(contents).toHaveAttribute("aria-expanded", "false");
    await expect(page.locator(".guide-sidebar #guideNav")).toBeVisible();
    await expect(page.locator("#guide-tags.is-active")).toBeVisible();
    await page.evaluate(() => window.dispatchEvent(new Event("examConfigLoaded")));
    await expect(page.locator("#guideAcademicExams")).not.toBeEmpty();
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

test.describe("Guide subsections and link previews", () => {
  test("opens a subsection from a deep link and from a link inside an article", async ({ page }) => {
    await page.goto("/guide.html#guide-unifit-budget");
    await page.waitForSelector("#guidePage");
    await expect(page.locator("#guide-unifit.is-active")).toBeVisible();
    await expect(page.locator("#guide-unifit-budget")).toBeInViewport();
    await expect(page.locator('#guideNav a[aria-current="page"]')).toHaveAttribute("href", /#guide-unifit$/);

    await page.goto("/guide.html#guide-tags");
    await page.locator('#guide-tags a[href$="#guide-unifit-missing-results"]').click();
    await expect(page).toHaveURL(/#guide-unifit-missing-results$/);
    await expect(page.locator("#guide-unifit-missing-results")).toBeFocused();
    await expect(page.locator("#guide-unifit-missing-results")).toBeInViewport();
    await page.goBack();
    await expect(page).toHaveURL(/#guide-tags$/);
    await expect(page.locator("#guide-tags.is-active")).toBeVisible();
  });

  test("previews the linked article on hover and keyboard focus", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/guide.html#guide-tags");
    await page.waitForSelector("#guidePage");
    const link = page.locator('#guide-tags a[href$="#guide-unifit-budget"]');
    const preview = page.locator("#guidePreview-guide-unifit-budget");
    await expect(link).toHaveAttribute("aria-describedby", "guidePreview-guide-unifit-budget");
    await expect(preview).toBeHidden();

    await link.hover();
    await expect(preview).toBeVisible();
    await expect(preview.locator(".guide-link-preview__title")).toHaveText("Annual budget");
    await expect(preview.locator(".guide-link-preview__eyebrow")).toContainText("UniFit");
    await expect(preview.locator(".guide-link-preview__text")).not.toBeEmpty();
    await page.mouse.move(5, 5);
    await expect(preview).toBeHidden();

    await link.focus();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    await expect(preview).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(preview).toBeHidden();
  });

  test("links from the profile open the matching Guide article", async ({ page }) => {
    await page.goto("/profile.html");
    const link = page.locator('.profile-guide-link[href*="#guide-unifit-budget"]');
    await expect(link).toHaveCount(1);
    const href = await link.getAttribute("href");
    await page.goto(href);
    await page.waitForSelector("#guidePage");
    await expect(page.locator("#guide-unifit.is-active")).toBeVisible();
    await expect(page.locator("#guide-unifit-budget")).toBeInViewport();
  });
});
