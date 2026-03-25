const { test, expect } = require("@playwright/test");
const { markTourAsSeen } = require("./helpers/personas");

async function switchLanguage(page, value) {
  await page.evaluate((lang) => {
    const select = document.getElementById("languageSelect");
    if (!select) return;
    select.value = lang;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
  await page.waitForLoadState("domcontentloaded");
}

test("language switch updates UI labels for eng and ru locales", async ({ page }) => {
  await markTourAsSeen(page);
  await page.goto("/index.html");
  await page.waitForSelector("#languageSelect", { state: "attached" });

  await switchLanguage(page, "eng");
  await expect(page.locator(".navbar-center a[data-link='home']")).toContainText("Home");

  await switchLanguage(page, "rus");
  await expect(page.locator(".navbar-center a[data-link='home']")).toContainText("Главная");
});
