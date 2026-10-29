const { test, expect } = require("./helpers/coverage-test.cjs");
const { markTourAsSeen } = require("./helpers/personas");
const { openProfileTab, selectors } = require("./helpers/selectors");

for (const phone of [false, true]) {
test(`reset profile button clears profile inputs and removes profile from localStorage${phone ? " on a phone" : ""}`, async ({ page }) => {
  if (phone) await page.setViewportSize({ width: 390, height: 844 });
  await markTourAsSeen(page);
  await page.goto("/index.html");

  await expect(page.locator(selectors.profileBtn)).toBeVisible();
  await page.click(selectors.profileBtn);
  await expect(page.locator(selectors.profileModal)).toHaveClass(/is-open/);

  // Fill in profile data
  await page.fill(selectors.budgetInput, "15000");
  await openProfileTab(page, "scores");
  await page.fill(selectors.gpaInput, "3.6");
  await page.click(selectors.saveProfileBtn);

  // Verify stored in localStorage
  const storedBefore = await page.evaluate(() => localStorage.getItem("unisearch_profile"));
  expect(storedBefore).not.toBeNull();
  expect(JSON.parse(storedBefore).budget).toBe(15000);

  // Click reset profile button
  const resetBtn = page.locator("#resetProfileBtn");
  await expect(resetBtn).toBeVisible();
  await resetBtn.click();

  // Confirmation modal should open
  const resetModal = page.locator("#profileResetModal");
  await expect(resetModal).toHaveClass(/is-open/);

  await page.locator("#profileResetCancelBtn").click();
  await expect(resetModal).not.toHaveClass(/is-open/);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("unisearch_profile")).budget)).toBe(15000);
  await resetBtn.click();

  // Click confirm in modal
  await page.locator("#profileResetConfirmBtn").click();

  // Modal should close
  await expect(resetModal).not.toHaveClass(/is-open/);

  // LocalStorage should be cleared
  const storedAfter = await page.evaluate(() => localStorage.getItem("unisearch_profile"));
  expect(storedAfter).toBeNull();

  // Inputs should be reset to default
  await openProfileTab(page, "basics");
  await expect(page.locator(selectors.budgetInput)).toHaveValue("");
  await openProfileTab(page, "scores");
  await expect(page.locator(selectors.gpaInput)).toHaveValue("");
});
}
