const { test, expect } = require("./helpers/coverage-test.cjs");
const { personas, seedProfile } = require("./helpers/personas");
const { selectors, setRangeValue } = require("./helpers/selectors");
const { mockAllExpensiveEndpoints } = require("./helpers/mocks");

test.beforeEach(async ({ page }) => {
  await mockAllExpensiveEndpoints(page);
});

test("universities page uses AI sort with realistic search/filter interactions", async ({ page }) => {
  await seedProfile(page, personas.ruStemGrant.profile);

  const firstAiSort = page.waitForResponse(
    (response) =>
      response.url().includes("/universities/ai-sort") &&
      response.request().method() === "POST"
  );
  await page.goto("/index.html");
  expect((await firstAiSort).status()).toBe(200);

  await expect(page.locator(".uni-card:not(.is-skeleton)").first()).toBeVisible();

  const queryFetch = page.waitForResponse(
    (response) =>
      response.url().includes("/universities/ai-sort") &&
      response.request().method() === "POST"
  );
  await page.fill(selectors.queryInput, "Cambrdge");
  expect((await queryFetch).status()).toBe(200);

  const focusFetch = page.waitForResponse(
    (response) =>
      response.url().includes("/universities/ai-sort") &&
      response.request().method() === "POST"
  );
  await setRangeValue(page, "focusSlider", 80);
  expect((await focusFetch).status()).toBe(200);

  await expect(page).not.toHaveURL(/practice_vs_science=80/);
  await expect.poll(async () => page.evaluate(() =>
    JSON.parse(localStorage.getItem("unisearch_filters") || "{}").practice_vs_science
  )).toBe(80);
  await expect(page.locator(selectors.focusLabel)).not.toHaveText("");
  await expect(page.locator(".uni-card:not(.is-skeleton)").first()).toBeVisible();

  const atmosphereFetch = page.waitForResponse(
    (response) =>
      response.url().includes("/universities/ai-sort") &&
      response.request().method() === "POST"
  );
  await setRangeValue(page, "atmosphereSlider", 70);
  expect((await atmosphereFetch).status()).toBe(200);
  await expect(page).not.toHaveURL(/social_vs_hardcore=70/);
  await expect.poll(async () => page.evaluate(() =>
    JSON.parse(localStorage.getItem("unisearch_filters") || "{}").social_vs_hardcore
  )).toBe(70);
  await expect(page.locator(selectors.atmosphereLabel)).not.toHaveText("");

  const financeFetch = page.waitForResponse(
    (response) =>
      response.url().includes("/universities/ai-sort") &&
      response.request().method() === "POST"
  );
  await setRangeValue(page, "financeSlider", 25);
  expect((await financeFetch).status()).toBe(200);
  await expect(page).not.toHaveURL(/budget_vs_prestige=25/);
  await expect.poll(async () => page.evaluate(() =>
    JSON.parse(localStorage.getItem("unisearch_filters") || "{}").budget_vs_prestige
  )).toBe(25);
  await expect(page.locator(selectors.financeLabel)).not.toHaveText("");

  const locationFetch = page.waitForResponse(
    (response) =>
      response.url().includes("/universities/ai-sort") &&
      response.request().method() === "POST"
  );
  await setRangeValue(page, "locationSlider", 60);
  expect((await locationFetch).status()).toBe(200);
  await expect(page).not.toHaveURL(/city_vs_campus=60/);
  await expect.poll(async () => page.evaluate(() =>
    JSON.parse(localStorage.getItem("unisearch_filters") || "{}").city_vs_campus
  )).toBe(60);
  await expect(page.locator(selectors.locationLabel)).not.toHaveText("");
});

test("profile discovery context stays soft while explicit level and price context reach the catalog", async ({ page }) => {
  await seedProfile(page, {
    ...personas.ruStemGrant.profile,
    studyLevel: "masters",
    feeStatusContext: "self_reported_international_overseas",
    intendedEntryCycle: "2027 entry",
  });
  let aiRequest;
  page.on("request", request => {
    if (new URL(request.url()).pathname.endsWith("/universities/ai-sort")) aiRequest = request;
  });

  await page.goto("/index.html?sort=uni_ai&study_level=undergraduate");
  await expect(page.locator("body")).toHaveAttribute("data-page", "universities");
  await expect(page.locator("#universitiesList .uni-card:not(.is-skeleton)").first()).toBeVisible();
  await expect.poll(() => aiRequest?.postDataJSON()).toBeTruthy();
  const ranking = aiRequest.postDataJSON();
  expect(ranking.profile.major).toBe("Computer Science");
  expect(ranking.major).toBeUndefined();
  expect(ranking.study_level).toBe("undergraduate");

  let catalogPayload;
  page.on("request", request => {
    const url = new URL(request.url());
    if (url.pathname.endsWith("/universities/profiled") && request.method() === "POST") {
      catalogPayload = request.postDataJSON();
    } else if (url.pathname.endsWith("/universities") && request.method() === "GET") {
      catalogPayload = Object.fromEntries(url.searchParams);
    }
  });
  await page.goto("/index.html?sort=name_asc&study_level=undergraduate");
  await expect(page.locator("#universitiesList .uni-card:not(.is-skeleton)").first()).toBeVisible();
  await expect.poll(() => catalogPayload).toBeTruthy();
  expect(catalogPayload.major || null).toBeNull();
  expect(catalogPayload.format || null).toBeNull();
  expect(catalogPayload.study_level).toBe("undergraduate");
  expect(catalogPayload.fee_status_context).toBe("self_reported_international_overseas");
  expect(catalogPayload.intended_entry_cycle).toBe("2027 entry");
});

test("unifit tradeoff tooltips are hidden by default and toggle on interaction", async ({ page }) => {
  await seedProfile(page, personas.ruStemGrant.profile);
  await page.goto("/index.html");

  const tooltips = page.locator(".u-tooltip");
  const count = await tooltips.count();
  expect(count).toBeGreaterThan(0);

  // All tooltips must be hidden by default
  for (let i = 0; i < count; i++) {
    const tooltip = tooltips.nth(i);
    const opacity = await tooltip.evaluate((el) => window.getComputedStyle(el).opacity);
    const visibility = await tooltip.evaluate((el) => window.getComputedStyle(el).visibility);
    expect(opacity).toBe("0");
    expect(visibility).toBe("hidden");
  }

  // Clicking an info button opens its tooltip
  const firstInfoBtn = page.locator(".u-info").first();
  await firstInfoBtn.click();
  const activeTooltip = firstInfoBtn.locator("..").locator(".u-tooltip");
  await expect(activeTooltip).toBeVisible();

  // Clicking outside closes the tooltip
  await page.locator("body").click({ position: { x: 10, y: 10 } });
  await expect(activeTooltip).toBeHidden();
});

