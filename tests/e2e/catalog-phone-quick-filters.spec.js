const { test, expect } = require("./helpers/coverage-test.cjs");
const { markTourAsSeen } = require("./helpers/personas");

test.use({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });

test.beforeEach(async ({ page }) => {
  await markTourAsSeen(page);
  await page.addInitScript(() => localStorage.setItem("unisearch_ui_language_v1", "rus"));
});

test("quick filter chips toggle the same filters as the panel", async ({ page }) => {
  await page.goto("/index.html");
  await expect(page.locator("#universitiesList .uni-card:not(.is-skeleton)").first()).toBeVisible();
  const chip = page.locator('[data-quick-filter="home-country"]');
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

test("the price field groups digits and accepts grouped input", async ({ page }) => {
  await page.goto("/index.html");
  await expect(page.locator("#universitiesList .uni-card:not(.is-skeleton)").first()).toBeVisible();
  const maxInput = page.locator("#maxCostInput");
  await expect(maxInput).toHaveValue(/^\d{1,3}([\s\u00a0\u202f]\d{3})+$/);
  await maxInput.evaluate((input) => {
    input.value = "20 000";
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await expect(page).toHaveURL(/max_tuition=\d+/);
  await expect(maxInput).toHaveValue(/^20[\s\u00a0\u202f]000$/);
});
