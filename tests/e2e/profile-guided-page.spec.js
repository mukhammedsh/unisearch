const { test, expect } = require("./helpers/coverage-test.cjs");
const { markTourAsSeen } = require("./helpers/personas");
const { openProfileTab } = require("./helpers/selectors");
const { mockAllExpensiveEndpoints } = require("./helpers/mocks");

async function openProfile(page) {
  await mockAllExpensiveEndpoints(page);
  await markTourAsSeen(page);
  await page.addInitScript(() => localStorage.setItem("unisearch_ui_language_v1", "eng"));
  await page.goto("/profile.html");
  await page.waitForFunction(() => !!window.__unisearchProfileDraft);
  await expect(page.locator("#siteInitialLoader")).toBeHidden();
}

test("desktop profile keeps the overview next to the selected editor", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openProfile(page);
  const overview = page.locator(".profile-overview");
  const budget = page.locator('[data-profile-section="preferences"]');
  await openProfileTab(page, "preferences");
  await expect(overview).toBeVisible();
  await expect(budget).toBeVisible();
  await expect(budget.locator("h2")).toBeFocused();
  await expect(page.locator("[data-profile-section]:visible")).toHaveCount(1);
  expect((await overview.boundingBox()).x).toBeLessThan((await budget.boundingBox()).x);
  await expect(page.getByRole("link", { name: "How UniFit works" })).toHaveCount(0);

  await page.locator("#budgetInput").fill("21000");
  await page.locator('[data-profile-tab="scores"]').click();
  await expect(page.locator("#profileUnsavedModal")).toBeVisible();
  await page.locator("#profileSaveAndCloseBtn").click();
  await expect(page.locator('[data-profile-section="scores"] h2')).toBeFocused();
  await expect(page.locator('[data-profile-tab="preferences"]')).toContainText("21,000");
  await expect(page.locator("#saveProfileBtn")).toBeHidden();
});

for (const viewport of [
  { width: 320, height: 640 },
  { width: 768, height: 1024 },
  { width: 844, height: 390 },
]) {
  test(`overview and focused editor at ${viewport.width}×${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await openProfile(page);
    const overview = page.locator(".profile-overview");
    const scores = page.locator('[data-profile-tab="scores"]');
    await expect(overview).toBeVisible();
    await expect(page.locator("[data-profile-section]:visible")).toHaveCount(0);
    await expect(page.locator("#saveProfileBtn")).toBeHidden();

    await scores.click();
    await expect(overview).toBeHidden();
    await expect(page.locator("#profileSectionBackBtn")).toBeInViewport();
    await expect(page.locator(".navbar")).toBeHidden();
    const gpa = page.locator("#gpaInput");
    await gpa.fill("5.6");
    await page.locator("#saveProfileBtn").click();
    await expect(gpa).toHaveAttribute("aria-invalid", "true");
    await expect(gpa).toBeFocused();
    await gpa.fill("3.5");
    await page.locator("#saveProfileBtn").click();
    await expect(page.locator("#saveProfileBtn")).toBeHidden();
    await page.locator("#profileSectionBackBtn").click();
    await expect(scores).toBeFocused();
    await expect(scores).toContainText("3.5");
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
    await page.locator("#resetProfileBtn").click();
    await expect(page.locator("#profileResetModal")).toBeVisible();
    await page.locator("#profileResetCancelBtn").click();
    await expect(page.locator("#profileResetModal")).toBeHidden();
  });
}

test("phone browser back protects the draft and forward restores the editor", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openProfile(page);
  await page.locator('[data-profile-tab="preferences"]').click();
  await page.locator("#budgetInput").fill("12000");
  await page.goBack();
  await expect(page.locator("#profileUnsavedModal")).toBeVisible();
  await page.locator("#profileCancelCloseBtn").click();
  await expect(page.locator("#profileUnsavedModal")).toBeHidden();
  await expect(page.locator("#budgetInput")).toHaveValue("12000");
  await page.locator("#profileSectionBackBtn").click();
  await page.locator("#profileDiscardBtn").click();
  await expect(page.locator(".profile-overview")).toBeVisible();
  await page.goForward();
  await expect(page.locator("#budgetInput")).toBeVisible();
  await expect(page.locator("#budgetInput")).toHaveValue("");
});

test("the exams section opens the language editor", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openProfile(page);
  await openProfileTab(page, "scores");
  await page.locator('[data-profile-jump="languages"]').click();
  await expect(page.locator("#profileSectionLanguagesTitle")).toBeFocused();
  await expect(page.locator('[data-profile-section="scores"]')).toBeHidden();
});

test("the UniFit help link opens the guide beside the ranking context", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await markTourAsSeen(page);
  await mockAllExpensiveEndpoints(page);
  await page.goto("/index.html?sort=uni_ai&lang=eng");
  const guide = page.locator("#unifitContextBar").getByRole("link", { name: "How UniFit works" });
  await expect(guide).toBeVisible();
  await guide.click();
  await expect(page).toHaveURL(/guide.*#guide-unifit/);
  await expect(page.locator("#guide-unifit h2")).toBeInViewport();
});
