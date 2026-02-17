const { test, expect } = require("@playwright/test");
const { markTourAsSeen } = require("./helpers/personas");
const { selectors } = require("./helpers/selectors");

test("pressing Enter in budget saves edited username as part of profile save", async ({ page }) => {
  await markTourAsSeen(page);
  await page.goto("/universities.html");

  await expect(page.locator(selectors.profileBtn)).toBeVisible();
  await page.click(selectors.profileBtn);
  await expect(page.locator(selectors.profileModal)).toHaveClass(/is-open/);

  await page.click(selectors.editNameBtn);
  await page.fill(selectors.nameInput, "Aruzhan Enter");
  await page.fill(selectors.budgetInput, "31000");
  await page.press(selectors.budgetInput, "Enter");

  await page.click(selectors.profileCloseBtn);
  await page.reload();
  await page.click(selectors.profileBtn);

  await expect(page.locator(selectors.nameInput)).toHaveValue("Aruzhan Enter");
  await expect(page.locator(selectors.budgetInput)).toHaveValue("31000");
});

