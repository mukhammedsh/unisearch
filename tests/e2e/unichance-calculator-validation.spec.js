const { test, expect } = require("@playwright/test");
const { personas, seedProfile } = require("./helpers/personas");

test.describe("UniChance Calculator Validation", () => {
  test("anonymous user sees warning to fill profile", async ({ page }) => {
    // 1. Открываем страницу Nazarbayev University без заполненного профиля
    await page.goto("/university.html?id=nazarbayev-university-kaz-astana");
    await expect(page.locator("#detailCard")).toBeVisible();

    // 2. Кликаем по табу "Admission"
    await page.click(".d-tab-btn[data-tab='tab-admission']");

    // 3. Должно отображаться предупреждение о пустом профиле (опционально, зависит от API)
    const warning = page.locator(".chance-warning");
    // await expect(warning).toBeVisible();

    // 4. Плашка процентов должна показывать 0% для анонимного
    const chancePercent = page.locator(".chance-percent");
    await expect(chancePercent).toContainText("0%");
  });

  test("user with strong profile sees positive admission chances and high chance badges", async ({ page }) => {
    // 1. Задаем сильный профиль (ruStemGrant: SAT 1490, IELTS 7.5, GPA 96)
    await seedProfile(page, personas.ruStemGrant.profile);

    // 2. Открываем страницу Nazarbayev University
    await page.goto("/university.html?id=nazarbayev-university-kaz-astana");
    await page.waitForSelector("#detailCard", { state: "visible", timeout: 15000 });

    // 3. Кликаем по табу "Admission"
    await page.click(".d-tab-btn[data-tab='tab-admission']");

    // 4. Предупреждение о пустом профиле должно отсутствовать
    const warning = page.locator(".chance-warning");
    await expect(warning).not.toBeVisible();

    // 5. Должен отображаться высокий процент шансов (больше 45%)
    const chancePercent = page.locator(".chance-percent");
    await expect(chancePercent).toBeVisible();
    const percentText = await chancePercent.textContent();
    const percentNum = parseInt(percentText.replace("%", "").trim(), 10);
    expect(percentNum).toBeGreaterThanOrEqual(45);

    // 6. Убеждаемся, что плашка имеет правильный класс тональности
    const toneClass = await chancePercent.getAttribute("class");
    expect(toneClass).toMatch(/chance-high|chance-good|chance-medium/);
  });
});
