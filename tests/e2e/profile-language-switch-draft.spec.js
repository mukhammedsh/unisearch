const { test, expect } = require("./helpers/coverage-test.cjs");
const { markTourAsSeen } = require("./helpers/personas");
const { openProfileTab, selectors } = require("./helpers/selectors");
const { mockAllExpensiveEndpoints } = require("./helpers/mocks");

test("language switch keeps unsaved profile draft", async ({ page }) => {
  await mockAllExpensiveEndpoints(page);
  await markTourAsSeen(page);
  await page.goto("/index.html");

  await expect(page.locator(selectors.profileBtn)).toBeVisible();
  await page.click(selectors.profileBtn);
  await expect(page.locator(selectors.profileModal)).toHaveClass(/is-open/);

  await openProfileTab(page, "preferences");
  await page.fill(selectors.budgetInput, "27890");
  await expect(page.locator(selectors.saveProfileBtn)).toBeEnabled();

  await page.evaluate(() => {
    const select = document.getElementById("languageSelect");
    if (!select) return;
    select.value = "rus";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.waitForLoadState("domcontentloaded");

  await expect(page.locator(selectors.profileModal)).toHaveClass(/is-open/);

  await expect(page.locator(selectors.budgetInput)).toHaveValue("27890");
  await expect(page.locator('[data-profile-section="preferences"]')).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "ru");
  await expect(page.locator(selectors.saveProfileBtn)).toBeEnabled();
});

test("profile major options are localized on initial russian load", async ({ page }) => {
  await mockAllExpensiveEndpoints(page);
  await markTourAsSeen(page);
  await page.addInitScript(() => {
    window.localStorage.setItem("unisearch_ui_language_v1", "rus");
  });
  await page.goto("/");

  await expect(page.locator(selectors.profileBtn)).toBeVisible();
  await page.click(selectors.profileBtn);
  await expect(page.locator(selectors.profileModal)).toHaveClass(/is-open/);

  await openProfileTab(page, "basics");
  await expect(page.locator(`${selectors.majorSelect} option[value="Computer Science"]`)).toHaveText("Компьютерные науки");
});
