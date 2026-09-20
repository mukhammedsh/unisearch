const { test, expect } = require("@playwright/test");
const { personas, seedProfile } = require("./helpers/personas");
const { selectors } = require("./helpers/selectors");

test("detail page renders UniChance/ROI and recomputes after profile update", async ({ page }) => {
  await seedProfile(page, {
    ...personas.enResearch.profile,
    major: "Computer Science",
    gpa: 99,
    exams: [{ exam: "SAT", score: 1550 }],
  });
  await page.goto("/university.html?id=mit-usa-cambridge");

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

test("detail page hides ROI when official salary data is missing", async ({ page }) => {
  await seedProfile(page, {
    ...personas.enResearch.profile,
    major: "Computer Science",
  });
  await page.goto("/university.html?id=astana-it-university-kaz-astana");

  await expect(page.locator("#detailCard")).toBeVisible();
  await page.click(".d-tab-btn[data-tab='tab-finance']");
  await expect(page.locator(".roi-box")).toHaveCount(0);
});

test("detail page tooltips are tap-friendly and interactive on admission and overview sections", async ({ page }) => {
  await seedProfile(page, {
    ...personas.enResearch.profile,
    major: "Computer Science",
    gpa: 99,
    exams: [{ exam: "SAT", score: 1550 }],
  });
  await page.goto("/university.html?id=mit-usa-cambridge");
  await expect(page.locator("#detailCard")).toBeVisible();

  // 1. Overview Global Rank tooltip click to toggle
  const rankInfoBtn = page.locator("#detailRecommendations .d-info-wrap .d-info").first();
  await expect(rankInfoBtn).toBeVisible();
  const rankTooltip = page.locator("#detailRecommendations .d-info-wrap .d-tooltip").first();
  await expect(rankTooltip).not.toBeVisible();
  await rankInfoBtn.click();
  await expect(rankTooltip).toBeVisible();
  await rankInfoBtn.click();
  await expect(rankTooltip).not.toBeVisible();

  // 2. Admission tab tooltips (chance badge / factor chips)
  await page.click(".d-tab-btn[data-tab='tab-admission']");
  await expect(page.locator(".chance-panel")).toBeVisible();

  const factorTrigger = page.locator(".track-factor-chip-wrap .ui-tooltip-trigger").first();
  if (await factorTrigger.count() > 0) {
    const factorBubble = page.locator(".track-factor-chip-wrap .ui-tooltip-bubble").first();
    await expect(factorBubble).not.toBeVisible();
    await factorTrigger.click();
    await expect(factorBubble).toBeVisible();
    await factorTrigger.click();
    await expect(factorBubble).not.toBeVisible();
  }
});
