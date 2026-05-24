const { test, expect } = require("@playwright/test");

test.describe("Responsive Layout and Overflow Verification", () => {
  test("adjusts sidebar and mobile filter button based on desktop viewport", async ({ page }) => {
    // Устанавливаем десктопный вьюпорт ДО загрузки страницы
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/universities.html");
    await page.waitForSelector(".uni-card");

    // На десктопе сайдбар фильтрации должен быть полностью виден
    const sidebar = page.locator("#uSidebar");
    await expect(sidebar).toBeVisible();

    // Кнопка переключения мобильных фильтров должна быть скрыта
    const mobileFilterToggle = page.locator("#mobileFilterToggle");
    await expect(mobileFilterToggle).not.toBeVisible();
  });

  test("adjusts sidebar and mobile filter button based on mobile viewport", async ({ page }) => {
    // Устанавливаем мобильный вьюпорт ДО загрузки страницы
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/universities.html");
    await page.waitForSelector(".uni-card");

    const sidebar = page.locator("#uSidebar");
    const mobileFilterToggle = page.locator("#mobileFilterToggle");

    // На мобильном кнопка переключения мобильных фильтров должна показываться
    await expect(mobileFilterToggle).toBeVisible();

    // Сайдбар по умолчанию скрыт
    await expect(sidebar).not.toBeVisible();
  });
});
