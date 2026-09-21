const { test, expect } = require("@playwright/test");
const { markTourAsSeen } = require("./helpers/personas");

async function switchLanguage(page, value) {
  await page.evaluate((lang) => {
    const select = document.getElementById("languageSelect");
    if (!select) return;
    select.value = lang;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
  await page.waitForFunction((lang) => {
    const select = document.getElementById("languageSelect");
    return !!select
      && select.value === lang
      && select.dataset.loading !== "1"
      && !select.disabled;
  }, value);
}

async function startLanguageSwitch(page, value) {
  await page.evaluate((lang) => {
    const select = document.getElementById("languageSelect");
    if (!select) return;
    select.value = lang;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
}

async function delayRussianUniversityTranslations(page, delayMs = 400) {
  await page.route("**/universities/translations?*", async (route) => {
    const lang = new URL(route.request().url()).searchParams.get("lang");
    if (lang === "rus") {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    await route.continue();
  });
}

async function seedLanguageAndTheme(page, theme = "light") {
  await page.addInitScript(({ selectedTheme }) => {
    localStorage.setItem("unisearch_ui_language_v1", "eng");
    localStorage.setItem("unisearch_theme", selectedTheme);
  }, { selectedTheme: theme });
}

test("language switch updates UI labels for eng and ru locales", async ({ page }) => {
  await markTourAsSeen(page);
  await page.goto("/index.html");
  await page.waitForSelector("#languageSelect", { state: "attached" });

  await switchLanguage(page, "eng");
  await expect(page.locator(".footer-product-links a[data-route='guide']")).toContainText("Guide");

  await switchLanguage(page, "rus");
  await expect(page.locator(".footer-product-links a[data-route='guide']")).toContainText("Гайд");
});

test("catalog keeps media visible and replaces only text during a slow language switch", async ({ page }) => {
  await seedLanguageAndTheme(page);
  await markTourAsSeen(page);
  await delayRussianUniversityTranslations(page);
  await page.goto("/index.html");

  const card = page.locator(".uni-card:has(.uni-media-img)").first();
  const image = card.locator(".uni-media-img");
  await expect(card).toBeVisible();
  await expect(image).toBeVisible();
  const initialImageSource = await image.getAttribute("src");

  await startLanguageSwitch(page, "rus");

  await expect(card).toHaveClass(/is-language-refreshing/);
  await expect(card.locator(".u-language-text-skeleton")).toBeVisible();
  await expect(image).toBeVisible();
  await expect(image).toHaveAttribute("src", initialImageSource);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");

  await expect(page.locator("#languageSelect")).not.toBeDisabled();
  await expect(page.locator("html")).toHaveAttribute("lang", "ru");
  await expect(card.locator(".u-language-text-skeleton")).toHaveCount(0);
});

test("detail keeps its cover visible while translated text is pending on mobile dark theme", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedLanguageAndTheme(page, "dark");
  await markTourAsSeen(page);
  await delayRussianUniversityTranslations(page);
  await page.goto("/university.html?id=suleyman-demirel-university-kaz-kaskelen");

  const card = page.locator("#detailCard");
  const cover = page.locator("#detailCover");
  await expect(card).toBeVisible();
  await expect(cover).toBeVisible();
  const initialCover = await cover.evaluate((node) => getComputedStyle(node).backgroundImage);

  await startLanguageSwitch(page, "rus");

  await expect(card).toHaveClass(/is-language-refreshing/);
  await expect(card.locator(".d-language-head-skeleton")).toBeVisible();
  await expect(cover).toBeVisible();
  await expect(page.locator("#detailLoading")).not.toHaveClass(/is-visible/);
  await expect.poll(() => cover.evaluate((node) => getComputedStyle(node).backgroundImage)).toBe(initialCover);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");

  await expect(page.locator("#languageSelect")).not.toBeDisabled();
  await expect(page.locator("html")).toHaveAttribute("lang", "ru");
  await expect(card.locator(".d-language-text-skeleton")).toHaveCount(0);
});
