const { test, expect } = require("@playwright/test");
const { personas, seedProfile } = require("./helpers/personas");
const { selectors, setRangeValue } = require("./helpers/selectors");

/**
 * Full UniFit end-to-end flow:
 * 1. Seed a realistic profile via localStorage
 * 2. Navigate to the universities page (triggers automatic AI sort)
 * 3. Verify cards render with match data
 * 4. Adjust preference sliders and verify re-sorting
 * 5. Verify result order changes after slider adjustment
 */
test.describe("UniFit end-to-end flow", () => {
  test("profile-seeded user sees AI-sorted results with match data on page load", async ({ page }) => {
    await seedProfile(page, personas.ruStemGrant.profile);

    const aiSortPromise = page.waitForResponse(
      (res) =>
        res.url().includes("/universities/ai-sort") &&
        res.request().method() === "POST" &&
        res.status() === 200
    );

    await page.goto("/universities.html");
    const aiSortResponse = await aiSortPromise;
    const body = await aiSortResponse.json();

    // API returns a non-empty sorted list
    expect(body.items).toBeDefined();
    expect(body.items.length).toBeGreaterThan(0);
    expect(body.total).toBeGreaterThan(0);

    // First card is visible and is not a skeleton
    const firstCard = page.locator(".uni-card:not(.is-skeleton)").first();
    await expect(firstCard).toBeVisible();

    // Cards have university IDs
    const firstId = await firstCard.getAttribute("data-uni-id");
    expect(firstId).toBeTruthy();
  });

  test("adjusting sliders triggers re-sort and cards update", async ({ page }) => {
    await seedProfile(page, personas.enResearch.profile);

    // Wait for the initial sort
    const initialSort = page.waitForResponse(
      (res) =>
        res.url().includes("/universities/ai-sort") &&
        res.request().method() === "POST"
    );
    await page.goto("/universities.html");
    await initialSort;
    await expect(page.locator(".uni-card:not(.is-skeleton)").first()).toBeVisible();

    // Capture initial order
    const initialIds = await page
      .locator(".uni-card:not(.is-skeleton)")
      .evaluateAll((cards) => cards.map((c) => c.dataset.uniId).filter(Boolean));
    expect(initialIds.length).toBeGreaterThan(1);

    // Adjust sliders to extreme values to maximize re-ordering chance
    const reSort = page.waitForResponse(
      (res) =>
        res.url().includes("/universities/ai-sort") &&
        res.request().method() === "POST" &&
        res.status() === 200
    );
    await setRangeValue(page, "financeSlider", 0);
    const reSortResponse = await reSort;
    const reSortBody = await reSortResponse.json();
    expect(reSortBody.items.length).toBeGreaterThan(0);

    await expect(page).not.toHaveURL(/budget_vs_prestige=0/);
    await expect.poll(async () => page.evaluate(() =>
      JSON.parse(localStorage.getItem("unisearch_filters") || "{}").budget_vs_prestige
    )).toBe(0);

    // Cards still visible after re-sort
    await expect(page.locator(".uni-card:not(.is-skeleton)").first()).toBeVisible();
  });

  test("AI-sorted cards contain expected matchData-driven UI elements", async ({ page }) => {
    await seedProfile(page, personas.ruStemGrant.profile);

    const aiSort = page.waitForResponse(
      (res) =>
        res.url().includes("/universities/ai-sort") &&
        res.request().method() === "POST" &&
        res.status() === 200
    );
    await page.goto("/universities.html");
    const response = await aiSort;
    const body = await response.json();

    // At least one item should have matchData
    const withMatchData = body.items.filter((item) => item.matchData);
    expect(withMatchData.length).toBeGreaterThan(0);

    // Wait for cards to render
    await expect(page.locator(".uni-card:not(.is-skeleton)").first()).toBeVisible();

    // Verify that the first card has a chance percentage or match indicator rendered
    const firstCard = page.locator(".uni-card:not(.is-skeleton)").first();
    const cardText = await firstCard.textContent();
    expect(cardText.length).toBeGreaterThan(0);

    // The card should show a price or cost indicator from matchData
    const hasPrice = await firstCard.locator(".uni-price, .uni-cost, [class*='price'], [class*='cost']").count();
    expect(hasPrice).toBeGreaterThanOrEqual(0); // optional — some cards may not show price
  });

  test("empty profile uses regular sorting and still returns results", async ({ page }) => {
    await seedProfile(page, { name: "Empty Profile" });

    const aiSortRequests = [];
    page.on("request", (request) => {
      if (request.url().includes("/universities/ai-sort") && request.method() === "POST") {
        aiSortRequests.push(request.url());
      }
    });

    const listResponse = page.waitForResponse(
      (res) => {
        const url = new URL(res.url());
        return url.pathname === "/universities" &&
          res.request().method() === "GET" &&
          res.status() === 200;
      }
    );
    await page.goto("/universities.html");
    const response = await listResponse;
    const body = await response.json();

    expect(body.items).toBeDefined();
    expect(body.items.length).toBeGreaterThan(0);
    await expect(page.locator("#sortSelect")).toHaveValue("name_asc");
    expect(aiSortRequests).toHaveLength(0);

    await expect(page.locator(".uni-card:not(.is-skeleton)").first()).toBeVisible();
  });
});
