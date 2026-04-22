const { test, expect } = require("@playwright/test");
const { personas, seedProfile } = require("./helpers/personas");
const { selectors, setRangeValue } = require("./helpers/selectors");

test("universities page uses AI sort with realistic search/filter interactions", async ({ page }) => {
  await seedProfile(page, personas.ruStemGrant.profile);

  const firstAiSort = page.waitForResponse(
    (response) =>
      response.url().includes("/universities/ai-sort") &&
      response.request().method() === "POST"
  );
  await page.goto("/universities.html");
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
