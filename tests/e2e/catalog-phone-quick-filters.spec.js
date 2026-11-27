const { test, expect } = require("./helpers/coverage-test.cjs");
const { markTourAsSeen, seedProfile } = require("./helpers/personas");

test.use({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, timezoneId: "Asia/Almaty" });

test.beforeEach(async ({ page }) => {
  await markTourAsSeen(page);
  await page.addInitScript(() => localStorage.setItem("unisearch_ui_language_v1", "rus"));
});

test("quick filter chips toggle the same filters as the panel", async ({ page }) => {
  await page.goto("/index.html");
  await expect(page.locator("#universitiesList .uni-card:not(.is-skeleton)").first()).toBeVisible();
  const chip = page.locator('[data-quick-filter="country"]');
  await expect(chip).toHaveText("Казахстан");
  await expect(chip).toHaveAttribute("aria-pressed", "false");

  await chip.tap();
  await expect(page).toHaveURL(/country=Kazakhstan/);
  await expect(chip).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#countrySelect")).toHaveValue("Kazakhstan");
  await expect(page.locator("#mobileFilterCount")).toHaveText("1");

  await chip.tap();
  await expect(page).not.toHaveURL(/country=Kazakhstan/);
  await expect(chip).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator("#countrySelect")).toHaveValue("");
});

test("chips offer bachelor's by default and the visitor's country and profile level when known", async ({ page }) => {
  await page.goto("/index.html");
  await expect(page.locator("#universitiesList .uni-card:not(.is-skeleton)").first()).toBeVisible();
  const level = page.locator('[data-quick-filter="level"]');
  await expect(level).toHaveText("Бакалавриат");
  // Offered only: the catalog keeps all study levels until the chip is tapped.
  await expect(level).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator("#studyLevelSelect")).toHaveValue("");
  await expect(page.locator('[data-quick-filter="detailed-admissions"]')).toHaveText("Подробные условия поступления");
});

test.describe("a visitor in the United States with a master's profile", () => {
  test.use({ timezoneId: "America/New_York" });

  test("sees their own country and saved level as chips", async ({ page }) => {
    await seedProfile(page, { studyLevel: "Master" });
    await page.goto("/index.html");
    await expect(page.locator("#universitiesList .uni-card:not(.is-skeleton)").first()).toBeVisible();
    await expect(page.locator('[data-quick-filter="country"]')).toHaveText("США");
    await expect(page.locator('[data-quick-filter="level"]')).toHaveText("Магистратура");
  });
});

test("the price field groups digits and accepts grouped input", async ({ page }) => {
  await page.goto("/index.html");
  await expect(page.locator("#universitiesList .uni-card:not(.is-skeleton)").first()).toBeVisible();
  const maxInput = page.locator("#maxCostInput");
  await expect(maxInput).toHaveValue(/^\d{1,3}([\s\u00a0\u202f]\d{3})+$/);
  // Type half of the current range with spaces between digit groups, whatever the currency is.
  const typed = await maxInput.evaluate((input) => {
    const slider = document.getElementById("maxCostSlider");
    const step = Number(slider.step) || 1;
    const amount = Math.round(Number(slider.max) / 2 / step) * step;
    input.value = String(amount).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    input.dispatchEvent(new Event("change", { bubbles: true }));
    return amount;
  });
  await expect(page).toHaveURL(/max_tuition=\d+/);
  await expect.poll(() => maxInput.inputValue().then((value) => Number(value.replace(/\D/g, "")))).toBe(typed);
  await expect(maxInput).toHaveValue(/^\d{1,3}([\s\u00a0\u202f]\d{3})+$/);
});
