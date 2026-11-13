const { test, expect } = require("./helpers/coverage-test.cjs");
const { markTourAsSeen } = require("./helpers/personas");
const { selectors, setNativeSelect } = require("./helpers/selectors");
const { mockAllExpensiveEndpoints } = require("./helpers/mocks");

const SECTIONS = ["basics", "preferences", "scores", "languages", "specific"];

async function openProfile(page) {
  await mockAllExpensiveEndpoints(page);
  await markTourAsSeen(page);
  await page.addInitScript(() => localStorage.setItem("unisearch_ui_language_v1", "eng"));
  await page.goto("/profile.html");
  await expect(page.locator("body")).toHaveAttribute("data-page", "profile");
  await expect(page.locator("#profileSummaryList li")).toHaveCount(6);
}

test("every profile section is visible at once and the outline jumps to one", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openProfile(page);

  for (const id of SECTIONS) {
    await expect(page.locator(`[data-profile-section="${id}"]`)).toBeAttached();
    expect(await page.locator(`[data-profile-section="${id}"]`).evaluate((node) => getComputedStyle(node).display)).not.toBe("none");
  }
  await expect(page.locator('.profile-section-tab[data-profile-tab="basics"]')).toHaveAttribute("aria-current", "location");

  await page.locator('.profile-section-tab[data-profile-tab="languages"]').click();
  await expect(page.locator('.profile-section-tab[data-profile-tab="languages"]')).toHaveAttribute("aria-current", "location");
  await expect(page.locator('[data-profile-section="languages"] .profile-section-title')).toBeInViewport();
  await expect(page.locator('[data-profile-section="languages"] .profile-section-title')).toBeFocused();
});

test("the summary changes with unsaved answers and nothing is stored until saving", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openProfile(page);

  const row = (id) => page.locator(`[data-summary-row="${id}"]`);
  await expect(row("budget")).toHaveAttribute("data-state", "not_used");
  await page.fill(selectors.budgetInput, "18000");
  await expect(row("budget")).toHaveAttribute("data-state", "used");
  await expect(row("budget")).toContainText("18,000");

  await setNativeSelect(page, "studyLevelSelect", "Master");
  await expect(row("level")).toHaveAttribute("data-state", "used");

  await page.fill(selectors.gpaInput, "3.5");
  await expect(row("requirements")).toHaveAttribute("data-state", "used");
  await expect(page.locator('.profile-section-tab[data-profile-tab="scores"]')).toHaveAttribute("data-filled", "true");

  expect(await page.evaluate(() => localStorage.getItem("unisearch_profile"))).toBeNull();
  await expect(page.locator("#profileUnifitGuideLink")).toHaveAttribute("href", /guide.*#guide-unifit/);
});

test("Save and show matches stores the profile and opens the catalog sorted by UniFit", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openProfile(page);

  await page.fill(selectors.budgetInput, "21000");
  await setNativeSelect(page, "studyLevelSelect", "Bachelor");
  await page.locator("#profileShowMatchesBtn").click();

  await expect(page).toHaveURL(/sort=uni_ai/);
  await expect(page.locator("#profileUnsavedModal.is-open")).toHaveCount(0);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("unisearch_profile") || "{}"));
  expect(String(saved.budget)).toBe("21000");
  expect(saved.studyLevel).toBe("Bachelor");
});

test("Save and show matches stays on the page when validation fails", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openProfile(page);

  await page.fill(selectors.gpaInput, "4.9");
  await page.locator("#profileShowMatchesBtn").click();
  await expect(page).toHaveURL(/profile/);
  await expect(page.locator("#gpaInput")).toHaveAttribute("aria-invalid", "true");
  expect(await page.evaluate(() => localStorage.getItem("unisearch_profile"))).toBeNull();
});

test("a 5-point GPA on the 4.0 scale is flagged while typing and the summary echoes the scale", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openProfile(page);

  await page.fill(selectors.gpaInput, "4.6");
  await expect(page.locator("#gpaHint")).toHaveClass(/is-warning/);
  await expect(page.locator("#gpaHint")).toContainText("4.6");

  await page.locator("#gpaUnit").click();
  await expect(page.locator("#gpaHint")).not.toHaveClass(/is-warning/);
  await expect(page.locator('[data-summary-row="requirements"]')).toContainText("4.6 / 5");
});

test("the exams field points language tests to the Languages section", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openProfile(page);

  await page.locator('[data-profile-jump="languages"]').click();
  await expect(page.locator('[data-profile-section="languages"] .profile-section-title')).toBeInViewport();
});

test("phone layout has no horizontal overflow and Reset is not above the first section", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await openProfile(page);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await expect(page.locator(".profile-outline")).toBeHidden();

  const firstSection = await page.locator('[data-profile-section="basics"]').boundingBox();
  const reset = await page.locator("#resetProfileBtn").boundingBox();
  expect(reset.y).toBeGreaterThan(firstSection.y + firstSection.height);

  const bar = await page.locator(".profile-action-bar").boundingBox();
  expect(bar.x).toBeGreaterThanOrEqual(0);
  expect(bar.x + bar.width).toBeLessThanOrEqual(320);
  await expect(page.locator("#profileShowMatchesBtn")).toBeVisible();
});
