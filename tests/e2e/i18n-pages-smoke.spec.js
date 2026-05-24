const { test, expect } = require("@playwright/test");
const { markTourAsSeen } = require("./helpers/personas");

const LOCALES = [
  {
    code: "eng",
    home: "Home",
    filter: "Filter",
    searchPlaceholder: "Search university...",
    backToList: "Back to list",
    programsTab: "Programs",
  },
  {
    code: "rus",
    home: "Главная",
    filter: "Фильтр",
    searchPlaceholder: "Поиск университета...",
    backToList: "Назад к списку",
    programsTab: "Программы",
  },
];

async function switchLanguage(page, langCode) {
  const isAlreadyActive = await page.evaluate((expectedLang) => {
    const select = document.getElementById("languageSelect");
    const htmlLang = expectedLang === "rus" ? "ru" : "en";
    return select && select.value === expectedLang && select.dataset.loading !== "1" && document.documentElement.lang === htmlLang;
  }, langCode);

  if (isAlreadyActive) {
    return;
  }

  const langPromise = page.evaluate((expectedLang) => {
    return new Promise((resolve) => {
      const handler = (e) => {
        if (e.detail?.language === expectedLang) {
          window.removeEventListener("languageChanged", handler);
          resolve(true);
        }
      };
      window.addEventListener("languageChanged", handler);
      setTimeout(() => {
        window.removeEventListener("languageChanged", handler);
        resolve(false);
      }, 5000);
    });
  }, langCode);

  await page.evaluate((nextLang) => {
    const select = document.getElementById("languageSelect");
    if (!select) return;
    select.value = nextLang;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  }, langCode);

  await expect(page.locator("#languageSelect")).toHaveValue(langCode);
  await langPromise;
  await expect(page.locator("#languageSelect")).not.toBeDisabled();
}

test("universities page updates key UI texts for eng/rus", async ({ page }) => {
  await markTourAsSeen(page);
  await page.goto("/universities.html");
  await expect(page.locator("#profileBtn")).toBeVisible();

  for (const locale of LOCALES) {
    await switchLanguage(page, locale.code);
    await expect(page.locator(".navbar-center a[data-link='home']")).toContainText(locale.home);
    await expect(page.locator("[data-i18n='universities.filter']")).toContainText(locale.filter);
    await expect(page.locator("#qInput")).toHaveAttribute("placeholder", locale.searchPlaceholder);
  }
});

test("university detail page updates key UI texts for eng/rus", async ({ page }) => {
  await markTourAsSeen(page);
  await page.goto("/university.html?id=suleyman-demirel-university-kaz-kaskelen");
  await expect(page.locator("#profileBtn")).toBeVisible();
  await expect(page.locator("#detailCard")).toBeVisible();
  await expect(page.locator("#detailName")).not.toHaveText("University Name");
  await expect(page.locator("#detailLocation img.flag-icon-inline")).toHaveCount(1);

  for (const locale of LOCALES) {
    await switchLanguage(page, locale.code);
    await expect(page.locator(".navbar-center a[data-link='home']")).toContainText(locale.home);
    await expect(page.locator("[data-i18n='university.back_to_list']")).toContainText(locale.backToList);
    await expect(page.locator(".d-tab-btn[data-tab='tab-programs'] [data-i18n='university.tab.programs']")).toContainText(locale.programsTab);
    await expect(page.locator("#detailLocation img.flag-icon-inline")).toHaveCount(1);
  }
});
