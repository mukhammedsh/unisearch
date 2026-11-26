const { test, expect } = require("./helpers/coverage-test.cjs");
const { markTourAsSeen } = require("./helpers/personas");
const { selectors, setNativeSelect } = require("./helpers/selectors");
const { mockAllExpensiveEndpoints } = require("./helpers/mocks");

const SECTIONS = ["basics", "preferences", "scores", "languages", "specific"];

for (const width of [390, 1440]) {
  test(`UniFit guide link is available at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await openProfile(page);
    const link = page.locator("#profileUnifitGuideLink");
    await expect(link).toHaveAttribute("href", /guide.*#guide-unifit/);
    await expect(link.locator("xpath=preceding-sibling::ol")).toHaveCount(1);
    await link.focus();
    await expect(link).toBeFocused();
  });
}

async function openProfile(page) {
  await mockAllExpensiveEndpoints(page);
  await markTourAsSeen(page);
  await page.addInitScript(() => localStorage.setItem("unisearch_ui_language_v1", "eng"));
  await page.goto("/profile.html");
  await expect(page.locator("body")).toHaveAttribute("data-page", "profile");
  await expect(page.locator("#profileUnifitGuideLink")).toBeVisible();
}

test("profile window and fields stay comfortably narrow on wide screens", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await openProfile(page);
  const shell = await page.locator(".profile-shell").boundingBox();
  const field = await page.locator("#profileInterestsInput").boundingBox();
  expect(shell.width).toBeLessThanOrEqual(952);
  expect(field.width).toBeLessThanOrEqual(680);
  expect(shell.x).toBeGreaterThan(0);
});

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

test("section markers change with unsaved answers and nothing is stored until saving", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openProfile(page);

  const tab = (id) => page.locator(`[data-profile-tab="${id}"]`);
  await expect(tab("preferences")).toHaveAttribute("data-filled", "false");
  await page.fill(selectors.budgetInput, "18000");
  await expect(tab("preferences")).toHaveAttribute("data-filled", "true");

  await setNativeSelect(page, "studyLevelSelect", "Master");
  await expect(tab("basics")).toHaveAttribute("data-filled", "true");

  await page.fill(selectors.gpaInput, "3.5");
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

  // Above 5 is invalid on either scale (4.9 now selects the five-point scale).
  await page.fill(selectors.gpaInput, "5.6");
  await page.locator("#profileShowMatchesBtn").click();
  await expect(page).toHaveURL(/profile/);
  await expect(page.locator("#gpaInput")).toHaveAttribute("aria-invalid", "true");
  expect(await page.evaluate(() => localStorage.getItem("unisearch_profile"))).toBeNull();
});

test("a 5-point GPA typed on the 4.0 scale switches the scale to 5.0, says so, and can be switched back", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openProfile(page);

  await expect(page.locator("#gpaUnit")).toHaveText("/ 4.0");
  await page.fill(selectors.gpaInput, "4.6");
  await expect(page.locator("#gpaUnit")).toHaveText("/ 5.0");
  await expect(page.locator("#gpaHint")).not.toHaveClass(/is-warning/);
  await expect(page.locator("#gpaHint")).toContainText("five-point scale");
  await expect(page.locator("#gpaInput")).toHaveValue("4.6");

  await expect(page.locator('#gpaScaleChoice input[value="5"]')).toBeChecked();

  // Switching back is the reader's choice: the over-scale warning returns instead of switching again.
  await page.locator('#gpaScaleChoice input[value="4"]').check();
  await expect(page.locator("#gpaUnit")).toHaveText("/ 4.0");
  await expect(page.locator("#gpaHint")).toHaveClass(/is-warning/);

  // A grade that fits both scales keeps the chosen scale: 3.6 out of 5 is entered by choosing 5.0.
  await page.locator('#gpaScaleChoice input[value="5"]').check();
  await page.fill(selectors.gpaInput, "3.6");
  await expect(page.locator("#gpaUnit")).toHaveText("/ 5.0");
  await expect(page.locator("#gpaInput")).toHaveValue("3.6");
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
  await expect(page.locator(".profile-outline__list")).toBeHidden();

  const firstSection = await page.locator('[data-profile-section="basics"]').boundingBox();
  const reset = await page.locator("#resetProfileBtn").boundingBox();
  expect(reset.y).toBeGreaterThan(firstSection.y + firstSection.height);

  const bar = await page.locator(".profile-action-bar").boundingBox();
  expect(bar.x).toBeGreaterThanOrEqual(0);
  expect(bar.x + bar.width).toBeLessThanOrEqual(320);
  await expect(page.locator("#profileShowMatchesBtn")).toBeVisible();
});
