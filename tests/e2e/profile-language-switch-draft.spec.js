const { test, expect } = require("@playwright/test");
const { markTourAsSeen } = require("./helpers/personas");
const { selectors } = require("./helpers/selectors");

test("language switch keeps unsaved profile draft", async ({ page }) => {
  await markTourAsSeen(page);
  await page.goto("/universities.html");

  await expect(page.locator(selectors.profileBtn)).toBeVisible();
  await page.click(selectors.profileBtn);
  await expect(page.locator(selectors.profileModal)).toHaveClass(/is-open/);

  await page.fill(selectors.budgetInput, "27890");
  await page.fill(selectors.interestsInput, "AI and robotics labs in big cities");
  await expect(page.locator(selectors.saveProfileBtn)).toBeEnabled();

  await page.evaluate(() => {
    const select = document.getElementById("languageSelect");
    if (!select) return;
    select.value = "rus";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.waitForLoadState("domcontentloaded");

  await expect(page.locator(selectors.profileBtn)).toBeVisible();
  await page.click(selectors.profileBtn);

  await expect(page.locator(selectors.budgetInput)).toHaveValue("27890");
  await expect(page.locator(selectors.interestsInput)).toHaveValue("AI and robotics labs in big cities");
  await expect(page.locator(selectors.saveProfileBtn)).toBeEnabled();
});
