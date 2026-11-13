const { test, expect } = require("./helpers/coverage-test.cjs");
const { selectors, setNativeSelect } = require("./helpers/selectors");

const TOUR_SEEN_KEY = "unisearch_universities_tour_seen_v1";
const PROFILE_KEY = "unisearch_profile";

async function seed(page, { profile, tourSeen = true } = {}) {
  await page.addInitScript(({ profile: value, tourSeen: seen, tourKey, profileKey }) => {
    localStorage.setItem("unisearch_ui_language_v1", "eng");
    localStorage.removeItem("unisearch_filters");
    if (seen) localStorage.setItem(tourKey, "1");
    if (value) localStorage.setItem(profileKey, JSON.stringify(value));
  }, { profile, tourSeen, tourKey: TOUR_SEEN_KEY, profileKey: PROFILE_KEY });
}

test("the UniFit banner names the profile values the ranking was built for", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await seed(page, { profile: { studyLevel: "Bachelor", major: "Computer Science", budget: "6000", budgetCurrency: "USD", fundingType: "any" } });
  await page.goto("/index.html?sort=uni_ai&study_level=bachelor");
  await expect(page.locator("body")).toHaveAttribute("data-page", "universities");

  const banner = page.locator("#unifitWarningBanner");
  await expect(banner).toBeVisible();
  const title = page.locator("#unifitBannerTitle");
  await expect(title).toContainText("Ranked for your profile");
  await expect(title).toContainText("Bachelor");
  await expect(title).toContainText("Computer Science");
  await expect(title).toContainText("$6,000/yr");
  await expect(title).not.toContainText("Grant");
  await expect(banner).toContainText("not an admission prediction");
  await expect(page.locator("#unifitBannerEdit")).toHaveText("Edit profile");
  await expect(page.locator("#unifitBannerEdit")).toHaveAttribute("href", /profile/);

  await page.locator("#dismissUnifitWarningBanner").click();
  await expect(banner).toBeHidden();
});

test("an empty profile says the ranking is generic and links to the profile", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await seed(page, { profile: {} });
  await page.goto("/index.html?sort=uni_ai");
  await expect(page.locator("body")).toHaveAttribute("data-page", "universities");

  await expect(page.locator("#unifitBannerTitle")).toContainText("generic");
  await expect(page.locator("#unifitBannerEdit")).toHaveText("Set up profile");
});

test("cards show up to three visible reasons in UniFit mode and none in other sorts", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await seed(page, { profile: { studyLevel: "Bachelor", major: "Computer Science", budget: "6000", budgetCurrency: "USD" } });
  await page.goto("/index.html?sort=uni_ai&study_level=bachelor");
  await expect(page.locator("body")).toHaveAttribute("data-page", "universities");

  const cards = page.locator("#universitiesList .uni-card:not(.is-skeleton)");
  await expect(cards.first()).toBeVisible();
  const reasons = page.locator("#universitiesList .uni-card .uni-reasons");
  await expect(reasons.first()).toBeVisible();
  const counts = await page.locator("#universitiesList .uni-card").evaluateAll((nodes) => nodes.map((node) => node.querySelectorAll(".uni-reason").length));
  expect(Math.max(...counts)).toBeLessThanOrEqual(3);
  expect(Math.max(...counts)).toBeGreaterThan(0);
  const text = await page.locator("#universitiesList").innerText();
  expect(text).toMatch(/Within your budget|Over Budget|Above your budget|No price to compare|Offers your subject|Program Not Offered|Your subject was not found/);

  // Negative reasons come before positive ones inside each card.
  const orders = await page.locator("#universitiesList .uni-reasons").evaluateAll((lists) => lists.map((list) =>
    Array.from(list.querySelectorAll(".uni-reason")).map((item) => item.className.match(/uni-reason--(\w+)/)[1])));
  const rank = { negative: 0, unknown: 1, positive: 2 };
  for (const order of orders) {
    expect(order.map((value) => rank[value])).toEqual([...order.map((value) => rank[value])].sort((a, b) => a - b));
  }

  await page.goto("/index.html?sort=name_asc");
  await expect(cards.first()).toBeVisible();
  await expect(page.locator("#universitiesList .uni-reasons")).toHaveCount(0);
});

test("Save and show matches lands on the catalog with the level selected and no tour over the results", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await seed(page, { tourSeen: false });
  await page.goto("/profile.html");
  await expect(page.locator("body")).toHaveAttribute("data-page", "profile");
  await expect(page.locator("#profileSummaryList li")).toHaveCount(6);

  await setNativeSelect(page, "studyLevelSelect", "Master");
  await page.fill(selectors.budgetInput, "30000");
  await page.locator("#profileShowMatchesBtn").click();

  await expect(page).toHaveURL(/sort=uni_ai/);
  await expect(page).toHaveURL(/study_level=master/);
  await expect(page.locator("body")).toHaveAttribute("data-page", "universities");
  await expect(page.locator("#studyLevelSelect")).toHaveValue("master");
  await expect(page.locator("#unifitBannerTitle")).toContainText("Master");
  await expect(page.locator("#universitiesList .uni-card:not(.is-skeleton)").first()).toBeVisible();
  await page.waitForTimeout(800);
  await expect(page.locator("#uTourModal")).toHaveCount(0);
  expect(await page.evaluate((key) => localStorage.getItem(key), TOUR_SEEN_KEY)).toBe("1");
  expect(await page.evaluate(() => sessionStorage.getItem("unisearch_universities_tour_skip_once_v1"))).toBeNull();
});

test("a visitor who opens the catalog directly still gets the first-visit tour", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await seed(page, { tourSeen: false });
  await page.goto("/index.html");
  await expect(page.locator("#uTourModal")).toBeVisible();
});
