const { test, expect } = require("./helpers/coverage-test.cjs");
const { openProfileTab } = require("./helpers/selectors");

test("profile calendar selects and clears a date", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => localStorage.setItem("unisearch_ui_language_v1", "eng"));
  await page.goto("/profile.html");
  await openProfileTab(page, "scores");
  const input = page.locator("#examTakenOnInput");
  const trigger = input.locator("+ button");
  await trigger.click();
  const calendar = page.locator("dialog.profile-calendar");
  await expect(calendar).toBeVisible();
  await calendar.locator('input[type="number"]').fill("2024");
  await calendar.locator('input[type="number"]').press("Tab");
  await calendar.locator("select").selectOption("1");
  const february = await calendar.boundingBox();
  await calendar.locator("select").selectOption("8");
  const september = await calendar.boundingBox();
  expect(september.height).toBe(february.height);
  expect(september.y).toBe(february.y);
  await calendar.locator('[data-date="2024-09-17"]').click();
  await expect(input).toHaveValue("");
  await expect(calendar.locator('[data-date="2024-09-17"]')).toHaveAttribute("aria-pressed", "true");
  await calendar.locator("[data-save]").click();
  await expect(input).toHaveValue("2024-09-17");
  await expect(trigger).toBeFocused();
  await trigger.click();
  await calendar.locator("[data-clear]").click();
  await expect(input).toHaveValue("2024-09-17");
  await calendar.locator("[data-save]").click();
  await expect(input).toHaveValue("");
});


test("calendar animates closing with Escape and restores focus", async ({ page }) => {
  await page.goto("/profile.html");
  await openProfileTab(page, "scores");
  const trigger = page.locator("#examTakenOnInput + button");
  await trigger.click();
  const calendar = page.locator("dialog.profile-calendar");
  await expect(calendar).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(calendar).toHaveClass(/is-closing/);
  await expect(calendar).not.toBeVisible();
  await expect(trigger).toBeFocused();
});
