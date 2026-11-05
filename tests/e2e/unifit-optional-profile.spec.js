const { test, expect } = require("./helpers/coverage-test.cjs");
const { seedProfile } = require("./helpers/personas");

for (const [label, profile] of [["guest", {}], ["budget-only profile", { budget: 50000 }]]) {
  test(`${label} can choose UniFit without a confirmation`, async ({ page }) => {
    await seedProfile(page, profile);
    await page.goto("/index.html?sort=name_asc");
    await expect(page.locator("body")).toHaveAttribute("data-page", "universities");
    await expect(page.locator("#universitiesList .uni-card:not(.is-skeleton)").first()).toBeVisible();
    const wrapper = page.locator(".custom-select-wrapper:has(#sortSelect)");
    await expect(wrapper.locator(".custom-select-trigger")).toBeVisible();
    const response = page.waitForResponse(result => result.url().includes("/universities/ai-sort") && result.request().method() === "POST");
    await wrapper.locator(".custom-select-trigger").click();
    await wrapper.locator('.custom-option[data-value="uni_ai"]').click();
    const result = await response;
    expect(result.status()).toBe(200);
    if (profile.budget) expect(result.request().postDataJSON().profile.budget).toBe(profile.budget);
    await expect(page.locator("#sortSelect")).toHaveValue("uni_ai");
    await expect(page.locator("#universitiesList .uni-card:not(.is-skeleton)").first()).toBeVisible();
    await expect(page.locator("#unifitWarningModal")).toHaveCount(0);
    await expect(page.locator("#unifitWarningBanner")).toBeVisible();
    await page.locator("#dismissUnifitWarningBanner").click();
    await expect(page.locator("#unifitWarningBanner")).toBeHidden();
  });
}
