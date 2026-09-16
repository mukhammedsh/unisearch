const { test, expect } = require("@playwright/test");
const { personas, seedProfile } = require("./helpers/personas");
const { setNativeSelect, setRangeValue } = require("./helpers/selectors");
const { mockAiSort } = require("./helpers/mocks");

test.describe("UniFit Tradeoff Sliders Interaction", () => {
  test("sliders are displayed and dynamic when UniFit sort strategy is active", async ({ page }) => {
    // 1. Mock AI Sort and set user profile with research interest
    await mockAiSort(page);
    await seedProfile(page, personas.enResearch.profile);
    
    // 2. Open university catalog and wait for initial load
    const initialSort = page.waitForResponse(
      (res) =>
        res.url().includes("/universities/ai-sort") &&
        res.request().method() === "POST"
    );
    await page.goto("/index.html");
    await initialSort;
    await expect(page.locator(".uni-card:not(.is-skeleton)").first()).toBeVisible();

    // 3. Open mobile filters if hidden
    const mobileFilterBtn = page.locator("#mobileFilterToggle");
    if (await mobileFilterBtn.isVisible()) {
      await mobileFilterBtn.click();
    }

    // 4. Verify slider container visibility toggling on sort change
    const aiSliderContainer = page.locator("#aiSliderContainer");
    await setNativeSelect(page, "sortSelect", "name_asc");
    await expect(aiSliderContainer).toBeHidden();

    // 5. Switch sort strategy to "UniFit: AI Smart Sort" (uni_ai)
    await setNativeSelect(page, "sortSelect", "uni_ai");

    // 6. Ensure slider container becomes visible
    await expect(aiSliderContainer).toBeVisible();

    // 7. Verify balanced default state for Focus slider (50/50)
    const focusLabel = page.locator("#focusLabel");
    await expect(focusLabel).toContainText("50/50");

    // 8. Shift Focus slider toward Science & Research (value 80)
    await setRangeValue(page, "focusSlider", 80);
    await expect(focusLabel).toContainText("Science & Research (80%)");

    // 9. Shift Location slider toward City (value 20)
    const locationLabel = page.locator("#locationLabel");
    await setRangeValue(page, "locationSlider", 20);
    await expect(locationLabel).toContainText("City (80%)");

    // 10. Verify universities are re-sorted and catalog list displays correctly
    await expect(page.locator("#universitiesList .uni-card").first()).toBeVisible();
  });
});
