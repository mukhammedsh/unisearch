const { test, expect } = require("@playwright/test");
const { personas, seedProfile } = require("./helpers/personas");
const { selectors } = require("./helpers/selectors");

test("detail page renders UniChance/ROI and recomputes after profile update", async ({ page }) => {
  await seedProfile(page, {
    ...personas.enResearch.profile,
    major: "Computer Science",
  });
  await page.goto("/universities.html");

  await expect(page.locator(".uni-card").first()).toBeVisible();
  await page.locator(".uni-card").first().click();

  await expect(page).toHaveURL(/university\.html\?id=/);
  await expect(page.locator("#detailCard")).toBeVisible();
  await expect(page.locator("#detailName")).not.toHaveText("University Name");

  await page.click(".d-tab-btn[data-tab='tab-admission']");
  await expect(page.locator(".chance-panel")).toBeVisible();
  await expect(page.locator(".chance-percent")).toContainText("%");

  await page.click(".d-tab-btn[data-tab='tab-finance']");
  await expect(page.locator(".roi-box")).toBeVisible();
  await expect(page.locator(".roi-box")).toContainText("ROI");

  await page.click(selectors.profileBtn);
  await expect(page.locator(selectors.profileModal)).toHaveClass(/is-open/);
  await page.fill(selectors.budgetInput, "42000");

  const uniChanceRefresh = page.waitForResponse(
    (response) =>
      response.url().includes("/uni-chance") &&
      response.request().method() === "POST"
  );
  const roiRefresh = page.waitForResponse(
    (response) =>
      response.url().includes("/roi") &&
      response.request().method() === "POST"
  );
  await page.click(selectors.saveProfileBtn);
  expect((await uniChanceRefresh).status()).toBe(200);
  expect((await roiRefresh).status()).toBe(200);

  await page.click(selectors.profileCloseBtn);
  await page.click(".d-tab-btn[data-tab='tab-finance']");
  await expect(page.locator(".roi-box")).toBeVisible();
});
