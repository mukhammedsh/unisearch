const { test, expect } = require("./helpers/coverage-test.cjs");
const { markTourAsSeen } = require("./helpers/personas");
const { selectors, setNativeSelect } = require("./helpers/selectors");
const { mockAllExpensiveEndpoints } = require("./helpers/mocks");

test.describe("Profile Budget Multi-Currency", () => {
  test.beforeEach(async ({ page }) => {
    await mockAllExpensiveEndpoints(page);
    await markTourAsSeen(page);
  });

  test("profile budget adapts unit, placeholder, hint and converts on currency switch", async ({ page }) => {
    await page.goto("/index.html");

    // 1. Open Profile Modal in default currency (USD)
    await expect(page.locator(selectors.profileBtn)).toBeVisible();
    await page.click(selectors.profileBtn);
    await expect(page.locator(selectors.profileModal)).toHaveClass(/is-open/);

    const budgetCurrency = page.locator("#profileBudgetCurrency");
    await expect(budgetCurrency).toHaveValue("USD");

    const budgetInput = page.locator(selectors.budgetInput);
    await expect(budgetInput).toBeVisible();

    // 2. Low budget grant hint in USD (< $1,000)
    await budgetInput.fill("500");
    await budgetInput.dispatchEvent("input");

    const grantHint = page.locator("#profileLowBudgetGrantHint");
    await expect(grantHint).toBeVisible();
    await expect(grantHint).toContainText("$1,000");

    // Click "Set Grant only"
    const grantApplyBtn = page.locator("#profileLowBudgetGrantApply");
    await grantApplyBtn.click();
    await expect(grantHint).toBeHidden();
    const fundingSelect = page.locator("#profileFundingTypeSelect");
    await expect(fundingSelect).toHaveValue("grant");

    // Reset funding type to 'any' and set normal budget
    await setNativeSelect(page, "profileFundingTypeSelect", "any");
    await budgetInput.fill("20000");
    await budgetInput.dispatchEvent("input");
    await expect(grantHint).toBeHidden();

    // Save profile
    await page.click(selectors.saveProfileBtn);
    await page.goto("/index.html");

    // 3. Switch currency to KZT via settings
    await page.click("#settingsBtn");
    const settingsModal = page.locator("#settingsModal");
    await expect(settingsModal).toHaveClass(/is-open/);
    await setNativeSelect(page, "settingPreferredCurrency", "KZT");
    await page.click("#settingsCloseBtn");

    // 4. Re-open profile modal and verify KZT conversions
    await page.click(selectors.profileBtn);
    await expect(page.locator(selectors.profileModal)).toHaveClass(/is-open/);

    await expect(budgetCurrency).toHaveValue("KZT");

    // Stored 20,000 USD converted to KZT (~9,000,000 - 10,000,000 KZT)
    const convertedBudgetVal = await budgetInput.inputValue();
    const numBudget = Number(convertedBudgetVal);
    expect(numBudget).toBeGreaterThan(5000000);
    expect(numBudget).toBeLessThan(20000000);

    // The hint states the budget's effect; the converted maximum appears only in the validation message.
    const budgetHint = page.locator('.profile-field:has(#budgetInput) .profile-hint');
    await expect(budgetHint).toBeVisible();
    expect(await budgetHint.textContent()).not.toMatch(/\d{1,3}(,\d{3}){2,}/);
    const keptBudget = await budgetInput.inputValue();
    await budgetInput.fill("99999999999");
    await page.click(selectors.saveProfileBtn);
    await expect(page.locator("#budgetInputError")).toContainText(/KZT/);
    expect(await page.locator("#budgetInputError").textContent()).toMatch(/\d{1,3}(,\d{3})+/);
    await budgetInput.fill(keptBudget);

    // Check API payload returns USD
    const apiBudget = await page.evaluate(() => {
      const p = window.__unisearchProfileDraft?.get ? window.__unisearchProfileDraft.get() : null;
      return p ? p.budget : null;
    });
    expect(apiBudget).toBeTruthy();

    // 5. Validation limit for KZT: exceeding max budget should show error
    await budgetInput.fill("9999999999");
    await budgetInput.dispatchEvent("input");
    await page.click(selectors.saveProfileBtn);
    const budgetError = page.locator("#budgetInputError");
    await expect(budgetError).toBeVisible();
    await expect(budgetError).toContainText("KZT");

    // Valid KZT amount saves properly
    await budgetInput.fill("10000000");
    await budgetInput.dispatchEvent("input");
    await page.click(selectors.saveProfileBtn);
    await expect(budgetError).not.toBeVisible();
  });

  test("choosing the budget currency after typing the amount keeps the number", async ({ page }) => {
    await page.goto("/index.html");
    await page.click(selectors.profileBtn);
    await expect(page.locator(selectors.profileModal)).toHaveClass(/is-open/);
    const budgetInput = page.locator(selectors.budgetInput);
    await budgetInput.fill("45000");
    await budgetInput.dispatchEvent("input");
    await setNativeSelect(page, "profileBudgetCurrency", "GBP");
    await expect(page.locator("#profileBudgetCurrency")).toHaveValue("GBP");
    await expect(budgetInput).toHaveValue("45000");
    await page.click(selectors.saveProfileBtn);
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("unisearch_profile")));
    expect(saved.budgetCurrency).toBe("GBP");
    expect(Number(saved.budget)).toBe(45000);
    await expect(page.locator("#settingPreferredCurrency")).toHaveValue("GBP");
  });
});
