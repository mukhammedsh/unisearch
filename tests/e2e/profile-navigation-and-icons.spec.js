const { test, expect } = require("@playwright/test");
const { markTourAsSeen } = require("./helpers/personas");
const { selectors } = require("./helpers/selectors");

test.describe("Profile page icons and navigation", () => {
  test("profile page renders clean action buttons and Heroicons inside badges", async ({ page }) => {
    await markTourAsSeen(page);
    await page.goto("/profile.html");

    // Verify back and save buttons do not have icons (clean text buttons)
    expect(await page.locator("#profileCloseBtn svg").count()).toBe(0);
    expect(await page.locator("#saveProfileBtn svg").count()).toBe(0);

    // Verify progress badge icon
    const progressIcon = page.locator(".profile-progress-badge svg");
    await expect(progressIcon).toBeVisible();
    expect(await progressIcon.count()).toBe(1);

    // Switch to scores tab to verify compact GPA block (tooltip sits by the hint, not the title)
    await page.click('[data-profile-tab="scores"]');
    await expect(page.locator('[data-profile-section="scores"]')).toBeVisible();
    // GPA scale is a toggle built into the / 4.0 unit suffix: click switches to / 5.0 and back.
    const gpaUnit = page.locator("#gpaUnit");
    await expect(gpaUnit).toBeVisible();
    await expect(page.locator("#gpaInput")).toBeVisible();
    await expect(page.locator("#gpaHint")).toBeVisible();
    await expect(gpaUnit).toHaveText("/ 4.0");
    await gpaUnit.click();
    await expect(gpaUnit).toHaveText("/ 5.0");
    await expect(page.locator("#gpaInput")).toHaveAttribute("max", "5");
    await gpaUnit.click();
    await expect(gpaUnit).toHaveText("/ 4.0");
    await expect(page.locator("#gpaInput")).toHaveAttribute("max", "4");
    // Title stays clean; the scale tooltip lives in the hint row.
    expect(await page.locator('.profile-card-block:has(#gpaInput) .profile-card-head .profile-info').count()).toBe(0);
    await expect(page.locator(".profile-hint-row .profile-info svg")).toBeVisible();
    expect(await page.locator(".profile-hint-row .profile-info").count()).toBe(1);
    // Compact layout: narrow input, text centered.
    const inputBox = await page.locator(".profile-field--gpa .profile-budget--with-unit").boundingBox();
    expect(inputBox.width).toBeLessThanOrEqual(120);
    expect(await page.$eval("#gpaInput", (el) => getComputedStyle(el).textAlign)).toBe("center");
    // Regression: a full 4-char value (e.g. 4.58) must not slide under the / 4.0 suffix.
    await page.fill("#gpaInput", "4.58");
    const gpaValueClearOfUnit = await page.evaluate(() => {
      const input = document.getElementById("gpaInput");
      const unit = document.getElementById("gpaUnit");
      const inputRect = input.getBoundingClientRect();
      const unitRect = unit.getBoundingClientRect();
      const valueRight = inputRect.right - parseFloat(getComputedStyle(input).paddingRight);
      return valueRight <= unitRect.left;
    });
    expect(gpaValueClearOfUnit).toBe(true);
  });

  test("back button returns to the university catalog opened from the root entry", async ({ page }) => {
    await markTourAsSeen(page);
    await page.goto("/index.html");

    const profileBtn = page.locator(selectors.profileBtn);
    await expect(profileBtn).toBeVisible();
    await profileBtn.click();

    // Verify we are on profile page
    await expect(page).toHaveURL(/profile/);
    await expect(page.locator(selectors.profileModal)).toBeVisible();

    // Click back button
    await page.click(selectors.profileCloseBtn);

    // The root entry now serves the university catalog.
    await expect(page).toHaveURL(/\/(?:index\.html)?(?:\?.*)?$/);
    await expect(page.locator("body")).toHaveAttribute("data-page", "universities");
  });

  test("back button preserves catalog query parameters", async ({ page }) => {
    await markTourAsSeen(page);
    await page.goto("/index.html?view=list");

    const profileBtn = page.locator(selectors.profileBtn);
    await expect(profileBtn).toBeVisible();
    await profileBtn.click();

    await expect(page).toHaveURL(/profile/);
    await expect(page.locator(selectors.profileModal)).toBeVisible();

    // Click back button
    await page.click(selectors.profileCloseBtn);

    // Verify we are back on the catalog with query parameters preserved.
    await expect(page).toHaveURL(/\/index\.html\?.*view=list/);
    await expect(page.locator("body")).toHaveAttribute("data-page", "universities");
  });

  test("back button falls back to the catalog when directly navigated without referrer", async ({ page }) => {
    await markTourAsSeen(page);
    await page.goto("/profile.html");

    await expect(page.locator(selectors.profileModal)).toBeVisible();
    await page.click(selectors.profileCloseBtn);

    // Fallback should be the root catalog route.
    await expect(page).toHaveURL(/\/(?:index\.html)?$/);
    await expect(page.locator("body")).toHaveAttribute("data-page", "universities");
  });
});
