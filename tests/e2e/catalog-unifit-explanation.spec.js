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

test("cards stay compact and the banner legend explains only the icons on screen", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await seed(page, { profile: { studyLevel: "Bachelor", major: "Computer Science", budget: "6000", budgetCurrency: "USD" } });
  await page.goto("/index.html?sort=uni_ai&study_level=bachelor");
  await expect(page.locator("body")).toHaveAttribute("data-page", "universities");

  const cards = page.locator("#universitiesList .uni-card:not(.is-skeleton)");
  await expect(cards.first()).toBeVisible();
  // No reason text on the cards: the icons carry the meaning, the legend teaches them.
  await expect(page.locator("#universitiesList .uni-reasons")).toHaveCount(0);

  const legendDetails = page.locator("#unifitLegendDetails");
  const legend = page.locator("#unifitLegend");
  await expect(legendDetails).toBeVisible();
  await expect(legend).toBeHidden();
  await legendDetails.locator(":scope > summary").click();
  await expect(legend).toBeVisible();
  const badges = await page.locator("#universitiesList .uni-card .uni-status-trigger[data-legend]").evaluateAll((nodes) =>
    Array.from(new Set(nodes.map((node) => `${node.dataset.legend}|${node.dataset.legendIcon}|${node.dataset.legendTone}`))));
  expect(badges.length).toBeGreaterThan(0);
  const items = legend.locator(".u-unifit-legend__item");
  await expect(items).toHaveCount(badges.length);
  // Each legend entry reuses the badge icon tone, hides its decorative icon, and has a real text label.
  const entries = await items.evaluateAll((nodes) => nodes.map((node) => ({
    tone: node.querySelector(".uni-status-trigger").className.match(/uni-status-trigger--(\w+)/)[1],
    hasSvg: Boolean(node.querySelector("svg")),
    iconHidden: node.querySelector(".uni-status-trigger").getAttribute("aria-hidden"),
    label: node.querySelector(".u-unifit-legend__label").textContent.trim(),
  })));
  for (const entry of entries) {
    expect(entry.hasSvg).toBe(true);
    expect(entry.iconHidden).toBe("true");
    expect(entry.label.length).toBeGreaterThan(2);
  }
  expect(entries.map((entry) => entry.tone).sort()).toEqual(badges.map((badge) => badge.split("|")[2]).sort());
  const labels = entries.map((entry) => entry.label);
  expect(labels).toContain("Over budget");
  expect(labels).not.toContain("Aid available");

  // The legend belongs to the banner: dismissing the banner hides it.
  await page.locator("#dismissUnifitWarningBanner").click();
  await expect(legendDetails).toBeHidden();
  await expect(legend).toBeHidden();

  await page.goto("/index.html?sort=name_asc");
  await expect(cards.first()).toBeVisible();
  await expect(page.locator("#unifitWarningBanner")).toBeHidden();
  await expect(page.locator("#universitiesList .uni-reasons")).toHaveCount(0);
});

test("icon tooltips name the missing exam and the amount over budget", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await seed(page, { profile: { studyLevel: "Bachelor", major: "Computer Science", budget: "6000", budgetCurrency: "USD" } });
  await page.goto("/index.html?sort=uni_ai&study_level=bachelor");
  await expect(page.locator("body")).toHaveAttribute("data-page", "universities");
  await expect(page.locator("#universitiesList .uni-card:not(.is-skeleton)").first()).toBeVisible();

  const tipText = (legend) => page.locator(`#universitiesList .uni-status-tooltip:has([data-legend="${legend}"]) .uni-status-tooltip__text`);
  const exam = await tipText("exam_needed").allTextContents();
  expect(exam.length).toBeGreaterThan(0);
  for (const text of exam) expect(text).toMatch(/^To check the requirements, add to your profile: .+\./);
  // Language rules are alternatives, so they read as one language test, never as a single option such as "Native en".
  for (const text of exam) expect(text.split(". ")[0]).not.toMatch(/Native|CEFR/);
  const over = await tipText("over_budget").allTextContents();
  expect(over.length).toBeGreaterThan(0);
  for (const text of over) expect(text).toMatch(/^\$[\d,]+ a year, \$[\d,]+ more than your budget\. Financial aid is not deducted\./);
});

test("on a phone the legend wraps inside the banner without sideways scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seed(page, { profile: { studyLevel: "Bachelor", major: "Computer Science", budget: "6000", budgetCurrency: "USD" } });
  await page.goto("/index.html?sort=uni_ai&study_level=bachelor");
  await expect(page.locator("body")).toHaveAttribute("data-page", "universities");
  await expect(page.locator("#universitiesList .uni-card:not(.is-skeleton)").first()).toBeVisible();
  const legendDetails = page.locator("#unifitLegendDetails");
  await expect(legendDetails).toBeVisible();
  await legendDetails.locator(":scope > summary").click();
  await expect(page.locator("#unifitLegend")).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  const box = await page.locator("#unifitLegend").boundingBox();
  const banner = await page.locator("#unifitWarningBanner").boundingBox();
  expect(box.x + box.width).toBeLessThanOrEqual(banner.x + banner.width);
});

test("a visitor who opens the catalog directly still gets the first-visit tour", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await seed(page, { tourSeen: false });
  await page.goto("/index.html");
  await expect(page.locator("#uTourModal")).toBeVisible();
});

test("the first-visit tour closes with Escape or its close button and then counts as skipped", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await seed(page, { tourSeen: false });
  await page.goto("/index.html");
  await expect(page.locator("#uTourModal")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("#uTourModal")).toBeHidden();
  expect(await page.evaluate((key) => localStorage.getItem(key), TOUR_SEEN_KEY)).toBe("1");

  await page.evaluate((key) => localStorage.removeItem(key), TOUR_SEEN_KEY);
  await page.reload();
  await expect(page.locator("#uTourModal")).toBeVisible();
  await page.locator("#uTourModal [data-action='close']").click();
  await expect(page.locator("#uTourModal")).toBeHidden();
  await expect(page.locator("#languageSelect")).toBeVisible();
});

test("an empty catalog names the price filter that hides results and offers a way out", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await seed(page, {});
  await page.goto("/index.html?q=MIT&max_tuition=1000");
  await expect(page.locator("#listState [data-empty-filters]")).toBeVisible();
  await expect(page.locator("#listState [data-action='reset-filters']")).toBeVisible();
});
