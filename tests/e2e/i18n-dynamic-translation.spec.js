const { test, expect } = require("@playwright/test");

const LOCALES = {
  eng: {
    home: "Home",
    filter: "Filter",
    reset: "Reset",
    searchPlaceholder: "Search university...",
    totalPrefix: "Found",
  },
  rus: {
    home: "Главная",
    filter: "Фильтр",
    reset: "Сброс",
    searchPlaceholder: "Поиск университета...",
    totalPrefix: "Найдено",
  },
};

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

test.describe("Dynamic Multi-Language Translation Verification", () => {
  test("dynamically switches all key interface elements between English and Russian", async ({ page }) => {
    // 1. Открываем каталог
    await page.goto("/universities.html");
    await page.waitForSelector(".uni-card");

    // 2. Тестируем английскую локализацию (сначала явно переключаем, чтобы гарантировать чистое состояние)
    await switchLanguage(page, "eng");
    await expect(page.locator(".navbar-center a[data-link='home']")).toContainText(LOCALES.eng.home);
    await expect(page.locator("[data-i18n='universities.filter']")).toContainText(LOCALES.eng.filter);
    await expect(page.locator("#resetFiltersBtn")).toContainText(LOCALES.eng.reset);
    await expect(page.locator("#qInput")).toHaveAttribute("placeholder", LOCALES.eng.searchPlaceholder);
    await expect(page.locator(".u-found")).toContainText(LOCALES.eng.totalPrefix);

    // 3. Переключаемся на русскую локализацию
    await switchLanguage(page, "rus");
    await expect(page.locator(".navbar-center a[data-link='home']")).toContainText(LOCALES.rus.home);
    await expect(page.locator("[data-i18n='universities.filter']")).toContainText(LOCALES.rus.filter);
    await expect(page.locator("#resetFiltersBtn")).toContainText(LOCALES.rus.reset);
    await expect(page.locator("#qInput")).toHaveAttribute("placeholder", LOCALES.rus.searchPlaceholder);
    await expect(page.locator(".u-found")).toContainText(LOCALES.rus.totalPrefix);

    // 4. Переключаемся обратно на английский
    await switchLanguage(page, "eng");
    await expect(page.locator(".navbar-center a[data-link='home']")).toContainText(LOCALES.eng.home);
  });
});
