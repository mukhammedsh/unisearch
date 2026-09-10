const { test, expect } = require("@playwright/test");
const { markTourAsSeen } = require("./helpers/personas");
const { selectors } = require("./helpers/selectors");

test.describe("Profile page icons and navigation", () => {
  test("profile page renders all Heroicons inside action buttons and badges", async ({ page }) => {
    await markTourAsSeen(page);
    await page.goto("/profile.html");

    // Verify edit name icon
    const editNameIcon = page.locator("#editNameBtn svg");
    await expect(editNameIcon).toBeVisible();
    expect(await editNameIcon.count()).toBe(1);

    // Verify back button icon
    const backBtnIcon = page.locator("#profileCloseBtn svg");
    await expect(backBtnIcon).toBeVisible();
    expect(await backBtnIcon.count()).toBe(1);

    // Verify save profile icon
    const saveBtnIcon = page.locator("#saveProfileBtn svg");
    await expect(saveBtnIcon).toBeVisible();
    expect(await saveBtnIcon.count()).toBe(1);

    // Verify progress badge icon
    const progressIcon = page.locator(".profile-progress-badge svg");
    await expect(progressIcon).toBeVisible();
    expect(await progressIcon.count()).toBe(1);

    // Switch to scores tab to verify GPA info icon
    await page.click('[data-profile-tab="scores"]');
    const gpaInfoIcon = page.locator(".profile-info svg");
    await expect(gpaInfoIcon).toBeVisible();
    expect(await gpaInfoIcon.count()).toBe(1);
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
