const { test, expect } = require("@playwright/test");
const { markTourAsSeen } = require("./helpers/personas");
const { selectors } = require("./helpers/selectors");

test.describe("Profile beforeunload unsaved changes protection", () => {
  test("clean profile does not prevent unload", async ({ page }) => {
    await markTourAsSeen(page);
    await page.goto("/profile.html");
    await page.waitForFunction(() => !!window.__unisearchProfileDraft);

    const check = await page.evaluate(() => {
      const event = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(event);
      return { defaultPrevented: event.defaultPrevented };
    });

    expect(check.defaultPrevented).toBe(false);
  });

  test("profile with dirty inputs prevents beforeunload", async ({ page }) => {
    await markTourAsSeen(page);
    await page.goto("/profile.html");
    await page.waitForFunction(() => !!window.__unisearchProfileDraft);

    await page.fill(selectors.budgetInput, "45000");

    const check = await page.evaluate(() => {
      const event = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(event);
      return { defaultPrevented: event.defaultPrevented };
    });

    expect(check.defaultPrevented).toBe(true);
  });

  test("saving profile clears beforeunload prevention", async ({ page }) => {
    await markTourAsSeen(page);
    await page.goto("/profile.html");
    await page.waitForFunction(() => !!window.__unisearchProfileDraft);

    await page.fill(selectors.budgetInput, "45000");
    await expect(page.locator(selectors.saveProfileBtn)).toBeEnabled();
    await page.click(selectors.saveProfileBtn);
    await expect(page.locator(selectors.saveProfileBtn)).toBeDisabled();

    const check = await page.evaluate(() => {
      const event = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(event);
      return { defaultPrevented: event.defaultPrevented };
    });

    expect(check.defaultPrevented).toBe(false);
  });

  test("discarding changes via close modal clears beforeunload and navigates away", async ({ page }) => {
    await markTourAsSeen(page);
    await page.goto("/index.html");

    // Navigate to profile from index so returnUrl is set
    await page.click(selectors.profileBtn);
    await page.waitForFunction(() => !!window.__unisearchProfileDraft);

    await page.fill(selectors.budgetInput, "45000");

    // Click close button to trigger the unsaved changes dialog
    await page.click(selectors.profileCloseBtn);
    await expect(page.locator("#profileUnsavedModal")).toHaveClass(/is-open/);

    // Click "Close without saving" - should navigate back without beforeunload blocking
    await page.click("#profileDiscardBtn");
    await expect(page).toHaveURL(/\/(?:index\.html)?(?:\?.*)?$/);
  });
});
