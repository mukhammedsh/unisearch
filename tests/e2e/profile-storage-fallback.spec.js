const { test, expect } = require("@playwright/test");
const { selectors } = require("./helpers/selectors");

test("profile keeps edits in-session when localStorage is unavailable", async ({ page }) => {
  await page.addInitScript(() => {
    const blockedStorageError = () => {
      throw new DOMException("Access denied", "SecurityError");
    };

    try {
      Object.defineProperty(Storage.prototype, "getItem", {
        configurable: true,
        value: blockedStorageError,
      });
      Object.defineProperty(Storage.prototype, "setItem", {
        configurable: true,
        value: blockedStorageError,
      });
      Object.defineProperty(Storage.prototype, "removeItem", {
        configurable: true,
        value: blockedStorageError,
      });
    } catch (e) {
      // Ignore if browser does not allow descriptor overrides.
    }
  });

  await page.goto("/index.html");

  await expect(page.locator(selectors.profileBtn)).toBeVisible();
  await page.click(selectors.profileBtn);
  await expect(page.locator(selectors.profileModal)).toHaveClass(/is-open/);

  await page.fill(selectors.budgetInput, "12000");
  await page.fill(selectors.gpaInput, "87");
  await page.click(selectors.saveProfileBtn);

  await page.click(selectors.profileCloseBtn);
  await page.click(selectors.profileBtn);

  await expect(page.locator(selectors.budgetInput)).toHaveValue("12000");
  await expect(page.locator(selectors.gpaInput)).toHaveValue("87");
});

