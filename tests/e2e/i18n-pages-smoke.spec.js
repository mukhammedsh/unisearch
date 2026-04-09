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
  await page.evaluate((nextLang) => {
    const select = document.getElementById("languageSelect");
    if (!select) return;
    select.value = nextLang;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  }, langCode);
  await expect(page.locator("#languageSelect")).toHaveValue(langCode);
}

test("universities page updates key UI texts for eng/rus", async ({ page }) => {
  await markTourAsSeen(page);
  await page.goto("/universities.html");
  await page.waitForSelector("#languageSelect", { state: "attached" });

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
  await page.waitForSelector("#languageSelect", { state: "attached" });
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
