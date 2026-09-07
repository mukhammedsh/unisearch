const { test, expect } = require("@playwright/test");
const { personas, seedProfile } = require("./helpers/personas");
const { setNativeSelect, setRangeValue } = require("./helpers/selectors");
const { mockAiSort } = require("./helpers/mocks");

test.describe("UniFit Tradeoff Sliders Interaction", () => {
  test("sliders are displayed and dynamic when UniFit sort strategy is active", async ({ page }) => {
    // 1. Мокаем AI Sort и задаем профиль пользователя с интересом к исследованиям
    await mockAiSort(page);
    await seedProfile(page, personas.enResearch.profile);
    
    // 2. Открываем каталог университетов и ждем первоначальную загрузку
    const initialSort = page.waitForResponse(
      (res) =>
        res.url().includes("/universities/ai-sort") &&
        res.request().method() === "POST"
    );
    await page.goto("/universities.html");
    await initialSort;
    await expect(page.locator(".uni-card:not(.is-skeleton)").first()).toBeVisible();

    // 3. Открываем мобильные фильтры, если они скрыты
    const mobileFilterBtn = page.locator("#mobileFilterToggle");
    if (await mobileFilterBtn.isVisible()) {
      await mobileFilterBtn.click();
    }

    // 4. Проверяем скрытие/появление при смене сортировки
    const aiSliderContainer = page.locator("#aiSliderContainer");
    await setNativeSelect(page, "sortSelect", "name_asc");
    await expect(aiSliderContainer).toBeHidden();

    // 5. Переключаем стратегию на "UniFit: AI Smart Sort" (uni_ai)
    await setNativeSelect(page, "sortSelect", "uni_ai");

    // 5. Убеждаемся, что контейнер со слайдерами стал видимым
    await expect(aiSliderContainer).toBeVisible();

    // 6. Проверяем сбалансированное состояние слайдера Focus по умолчанию (50/50)
    const focusLabel = page.locator("#focusLabel");
    await expect(focusLabel).toContainText("50/50");

    // 7. Смещаем ползунок Focus в сторону Career (значение 80)
    await setRangeValue(page, "focusSlider", 80);
    await expect(focusLabel).toContainText("Science & Research (80%)");

    // 9. Смещаем слайдер Location в сторону City (значение 20)
    const locationLabel = page.locator("#locationLabel");
    await setRangeValue(page, "locationSlider", 20);
    await expect(locationLabel).toContainText("City (80%)");

    // 11. Убеждаемся, что вузы пересортировались и список отображается корректно
    await expect(page.locator("#universitiesList .uni-card").first()).toBeVisible();
  });
});
