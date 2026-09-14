const { test, expect } = require("@playwright/test");
const { markTourAsSeen } = require("./helpers/personas");
const { selectors } = require("./helpers/selectors");

test("root page opens the university catalog as the main workspace", async ({ page }) => {
  await markTourAsSeen(page);
  await page.goto("/index.html");

  await expect(page.locator("body")).toHaveAttribute("data-page", "universities");
  await expect(page.locator(".u-layout")).toBeVisible();
  await expect(page.locator("#universitiesList .uni-card:not(.is-skeleton)").first()).toBeVisible();
  await expect(page.locator(".navbar-center")).toHaveCount(0);
  await expect(page.locator(".navbar-logo-link")).toHaveAttribute("href", "index.html");
  await expect(page.locator("#universitySearch")).toBeVisible();
  await expect(page.locator(selectors.profileBtn)).toBeVisible();
  await expect(page.locator("main h1")).toHaveCount(1);

  await page.locator("#compareModeBtn").click();
  await expect(page.locator("#compareModeBtn")).toHaveAttribute("aria-pressed", "true");
  await expect(page).toHaveURL(/tab=compare/);
  await expect(page.locator("main h1")).toHaveCount(1);
});

test("first-visit tutorial requires completion or an explicit skip", async ({ page }) => {
  await page.goto("/index.html");

  const tour = page.locator("#uTourModal");
  await expect(tour).toHaveClass(/is-open/);
  await expect(tour.locator(".u-tour-steps__item")).toHaveCount(6);
  await expect(tour.locator("[data-action='next']")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(tour.locator("[data-action='skip']")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(tour).toBeVisible();
  await expect(tour.locator("[data-action='close']")).toHaveCount(0);
  await tour.locator("[data-action='skip']").click();
  await expect(tour).toBeHidden();
  await expect.poll(() => page.evaluate(() => localStorage.getItem("unisearch_universities_tour_seen_v1"))).toBe("1");

  await page.reload();
  await expect(page.locator("#universitiesList .uni-card:not(.is-skeleton)").first()).toBeVisible();
  await expect(page.locator("#uTourModal")).toHaveCount(0);
});

test("tutorial opens the profile and resumes after saving it", async ({ page }) => {
  await page.goto("/index.html");

  const tour = page.locator("#uTourModal");
  await expect(tour).toBeVisible();
  await tour.locator("[data-action='next']").click();
  await tour.locator("[data-action='open-profile']").click();

  await expect(page).toHaveURL(/profile\.html/);
  await expect(page.locator("#profileMajorSelect option").nth(1)).toBeAttached();
  await page.locator("#budgetInput").fill("10000");
  await expect(page.locator("#saveProfileBtn")).toBeEnabled();
  await page.locator("#saveProfileBtn").click();

  await expect(page).toHaveURL(/index\.html/);
  await expect(page.locator("#uTourModal")).toBeVisible();
  await expect(page.locator("#uTourProgressLabel")).toHaveText("Step 2 of 6");
});

test("first-visit tutorial completes on mobile without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto("/index.html");

  const tour = page.locator("#uTourModal");
  await expect(tour).toBeVisible();
  await expect(tour.locator(".u-tour-steps__item")).toHaveCount(6);
  for (let step = 1; step <= 6; step += 1) {
    await tour.locator("[data-action='next']").click();
  }
  await expect(tour).toBeHidden();
  const dimensions = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
});

test("keyboard users can skip the header and enter comparison mode", async ({ page }) => {
  await markTourAsSeen(page);
  await page.goto("/index.html");
  await expect(page.locator("#universitiesList .uni-card:not(.is-skeleton)").first()).toBeVisible();

  await page.keyboard.press("Tab");
  await expect(page.locator(".skip-link")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("main")).toBeFocused();

  const compareModeButton = page.locator("#compareModeBtn");
  await compareModeButton.focus();
  await page.keyboard.press("Enter");
  await expect(compareModeButton).toHaveAttribute("aria-pressed", "true");
  await expect(page).toHaveURL(/tab=compare/);
});

test("mobile catalog omits an empty active-filter summary", async ({ page }) => {
  await markTourAsSeen(page);
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto("/index.html");

  await expect(page.locator("#universitiesList .uni-card:not(.is-skeleton)").first()).toBeVisible();
  await expect(page.locator("#mobileFilterSummary")).toBeHidden();
});

test("desktop university search remains visible in the redesigned navbar", async ({ page }) => {
  await markTourAsSeen(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/index.html");

  const search = page.locator("#universitySearch");
  await expect(search).toBeVisible();
  await expect(search.locator("input")).toBeVisible();
});

test("root catalog shows university suggestions below the navbar search", async ({ page }) => {
  await markTourAsSeen(page);
  await page.goto("/index.html");

  await expect(page.locator("#universitiesList .uni-card:not(.is-skeleton)").first()).toBeVisible();
  await page.locator("#qInput").fill("Harvard");

  await expect(page.locator(".navbar-search-suggestions.is-open .navbar-search-suggestion").first()).toBeVisible();
});

test("root catalog has no horizontal overflow on narrow and wide screens", async ({ page }) => {
  await markTourAsSeen(page);
  for (const viewport of [
    { width: 375, height: 667 },
    { width: 1280, height: 800 },
    { width: 1920, height: 1080 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/index.html");
    await expect(page.locator(".u-page")).toBeVisible();

    const dimensions = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
  }
});
