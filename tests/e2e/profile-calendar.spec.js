const { test, expect } = require("./helpers/coverage-test.cjs");

test("profile calendar selects and clears a date", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("unisearch_ui_language_v1", "eng"));
  await page.goto("/profile.html");
  await expect(page.locator("#profileBudgetCurrency")).toHaveAttribute("aria-label", /Budget currency/);
  await page.locator("[data-profile-tab='scores']").click();
  const input = page.locator("#examTakenOnInput");
  const trigger = input.locator("+ button");
  await trigger.click();
  const calendar = page.locator("dialog.profile-calendar");
  await expect(calendar).toBeVisible();
  await calendar.locator('input[type="number"]').fill("2024");
  await calendar.locator('input[type="number"]').press("Tab");
  await calendar.locator("select").selectOption("8");
  await calendar.locator('[data-date="2024-09-17"]').click();
  await expect(input).toHaveValue("2024-09-17");
  await expect(trigger).toBeFocused();
  await trigger.click();
  await calendar.locator("[data-clear]").click();
  await expect(input).toHaveValue("");
});
