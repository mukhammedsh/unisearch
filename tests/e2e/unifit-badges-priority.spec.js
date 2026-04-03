const { test, expect } = require("@playwright/test");
const { personas, seedProfile } = require("./helpers/personas");

function makeAiSortResponse(items) {
  return {
    items,
    total: items.length,
    page: 1,
    limit: items.length,
    warnings: [],
  };
}

test("UniFit cards prioritize badges in order: conditional -> vibe -> finance", async ({ page }) => {
  await seedProfile(page, personas.enResearch.profile);

  await page.route("**/universities/ai-sort", async (route) => {
    const items = [
      {
        id: "mit-usa-cambridge",
        name: "Priority University",
        rank: 21,
        location: { country: "USA", city: "Boston" },
        finance: { total_cost_year_usd: 39000 },
        academics: { acceptance_rate_percent: 28 },
        matchData: {
          finalPrice: 32000,
          preferenceMismatch: 0.08,
          selectedChanceType: "grant",
          grantChance: 88,
          generalChance: 74,
          conditional: true,
          conditionalRequirements: 1,
          uiBadgeHints: {
            showConditionalExamNeeded: true,
            vibe: "your_vibe",
            finance: "likely_grant",
          },
        },
      },
    ];
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(makeAiSortResponse(items)),
    });
  });

  await page.goto("/universities.html", { waitUntil: "domcontentloaded" });
  const firstCard = page.locator(".uni-card").first();
  await expect(firstCard).toBeVisible();

  const pills = firstCard.locator(".uni-badge .uni-pill");
  const pillCount = await pills.count();
  expect(pillCount).toBeGreaterThanOrEqual(3);
  await expect(pills.nth(0)).toContainText("Conditional");
  await expect(pills.nth(1)).toContainText("Your Vibe");
  await expect(pills.nth(2)).toContainText("Likely Grant");
  await expect(firstCard.locator(".uni-why")).toContainText("conditional");
});

test("UniFit card badges still work when backend hints are missing (frontend fallback)", async ({ page }) => {
  await seedProfile(page, personas.enResearch.profile);

  await page.route("**/universities/ai-sort", async (route) => {
    const items = [
      {
        id: "harvard-usa-cambridge",
        name: "Fallback University",
        rank: 32,
        location: { country: "USA", city: "Seattle" },
        finance: { total_cost_year_usd: 28000 },
        academics: { acceptance_rate_percent: 36 },
        matchData: {
          finalPrice: 28000,
          preferenceMismatch: 0.18,
          selectedChanceType: "general",
          grantChance: 31,
          generalChance: 70,
          conditional: false,
          conditionalRequirements: 0,
        },
      },
    ];
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(makeAiSortResponse(items)),
    });
  });

  await page.goto("/universities.html");
  const firstCard = page.locator(".uni-card").first();
  await expect(firstCard).toBeVisible();
  await expect(firstCard.locator(".uni-pill")).toContainText(["Good Match", "Paid Admission"]);
  await expect(firstCard.locator(".uni-why")).toContainText("good preference match");
});

test("UniFit card hides Requirements Met when conditional exam warning is present", async ({ page }) => {
  await seedProfile(page, personas.enResearch.profile);

  await page.route("**/universities/ai-sort", async (route) => {
    const items = [
      {
        id: "mit-usa-cambridge",
        name: "Conflicting Badge University",
        rank: 5,
        location: { country: "USA", city: "Boston" },
        finance: { total_cost_year_usd: 42000 },
        academics: { acceptance_rate_percent: 22 },
        matchData: {
          finalPrice: 42000,
          preferenceMismatch: 0.08,
          selectedChanceType: "grant",
          grantChance: 88,
          generalChance: 60,
          conditional: true,
          conditionalRequirements: 1,
          meetMinRequirements: true,
          uiBadgeHints: {
            showConditionalExamNeeded: true,
            vibe: "your_vibe",
            finance: "likely_grant",
          },
        },
      },
    ];
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(makeAiSortResponse(items)),
    });
  });

  await page.goto("/universities.html", { waitUntil: "domcontentloaded" });
  const firstCard = page.locator(".uni-card").first();
  await expect(firstCard).toBeVisible();
  await expect(firstCard.locator(".uni-pill")).toContainText(["Conditional", "Your Vibe", "Likely Grant"]);
  await expect(firstCard.locator(".uni-badge")).not.toContainText("Requirements Met");
});

test("UniFit card keeps all badges and switches to compact mode when badge count is above 4", async ({ page }) => {
  await seedProfile(page, personas.enResearch.profile);

  await page.route("**/universities/ai-sort", async (route) => {
    const items = [
      {
        id: "mit-usa-cambridge",
        name: "Dense Badge University",
        rank: 7,
        location: { country: "USA", city: "Boston" },
        finance: {
          total_cost_year_usd: 98000,
          financial_aid: { merit_based: true, need_based: true },
        },
        academics: { acceptance_rate_percent: 17 },
        matchData: {
          finalPrice: 98000,
          preferenceMismatch: 0.08,
          selectedChanceType: "grant",
          grantChance: 90,
          generalChance: 40,
          conditional: true,
          conditionalRequirements: 2,
          meetMinRequirements: false,
          aidAny: true,
          uiBadgeHints: {
            showConditionalExamNeeded: true,
            vibe: "your_vibe",
            finance: "likely_grant",
          },
        },
      },
    ];
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(makeAiSortResponse(items)),
    });
  });

  await page.goto("/universities.html");
  const firstCard = page.locator(".uni-card").first();
  await expect(firstCard).toBeVisible();

  const badgeBox = firstCard.locator(".uni-badge");
  await expect(badgeBox).toHaveClass(/uni-badge--count-5/);

  const pills = firstCard.locator(".uni-badge .uni-pill");
  await expect(pills).toHaveCount(5);
  await expect(pills.nth(0)).toContainText("Conditional");
  await expect(pills.nth(1)).toContainText("Your Vibe");
  await expect(pills.nth(2)).toContainText("Likely Grant");
  await expect(pills.nth(3)).toContainText("Below Requirements");
  await expect(pills.nth(4)).toContainText("Over Budget");
});

test("UniFit card badge logic caps at 5 computed status badges", async ({ page }) => {
  await seedProfile(page, personas.enResearch.profile);

  await page.route("**/universities/ai-sort", async (route) => {
    const items = [
      {
        id: "mit-usa-cambridge",
        name: "Max Badge University",
        rank: 9,
        location: { country: "USA", city: "Boston" },
        finance: {
          total_cost_year_usd: 96000,
          financial_aid: { merit_based: true, need_based: true },
        },
        academics: { acceptance_rate_percent: 15 },
        matchData: {
          finalPrice: 96000,
          preferenceMismatch: 0.08,
          selectedChanceType: "grant",
          grantChance: 95,
          generalChance: 50,
          conditional: true,
          conditionalRequirements: 2,
          meetMinRequirements: false,
          aidAny: true,
          uiBadgeHints: {
            showConditionalExamNeeded: true,
            vibe: "your_vibe",
            finance: "likely_grant",
          },
        },
      },
    ];
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(makeAiSortResponse(items)),
    });
  });

  await page.goto("/universities.html");
  const pills = page.locator(".uni-card").first().locator(".uni-badge .uni-pill");
  await expect(pills).toHaveCount(5);
});

test("UniFit cards apply count-based badge size classes for 0-5 tag scenarios", async ({ page }) => {
  await seedProfile(page, personas.enResearch.profile);

  await page.route("**/universities/ai-sort", async (route) => {
    const base = {
      location: { country: "USA", city: "Boston" },
      finance: { total_cost_year_usd: 30000, financial_aid: { merit_based: false, need_based: false } },
      academics: { acceptance_rate_percent: 40 },
      matchData: {
        finalPrice: 30000,
        conditional: false,
        conditionalRequirements: 0,
        grantChance: 10,
        generalChance: 10,
        selectedChanceType: "general",
      },
    };

    const items = [
      {
        ...base,
        id: "mit-usa-cambridge",
        name: "Count 0",
      },
      {
        ...base,
        id: "harvard-usa-cambridge",
        name: "Count 1",
        matchData: {
          ...base.matchData,
          preferenceMismatch: 0.18, // Good Match
        },
      },
      {
        ...base,
        id: "stanford-university-usa-ca",
        name: "Count 2",
        matchData: {
          ...base.matchData,
          preferenceMismatch: 0.18, // Good Match
          generalChance: 70, // Paid Admission
        },
      },
      {
        ...base,
        id: "eth-zurich-ch-zurich",
        name: "Count 3",
        matchData: {
          ...base.matchData,
          preferenceMismatch: 0.08, // Your Vibe
          selectedChanceType: "grant",
          grantChance: 80, // Likely Grant
          conditional: true, // Conditional
          conditionalRequirements: 1,
        },
      },
      {
        ...base,
        id: "epfl-ch-lausanne",
        name: "Count 4",
        finance: { total_cost_year_usd: 30000, financial_aid: { merit_based: true, need_based: false } },
        matchData: {
          ...base.matchData,
          preferenceMismatch: 0.08, // Your Vibe
          selectedChanceType: "grant",
          grantChance: 80, // Likely Grant
          meetMinRequirements: true, // Requirements Met
          aidAny: true, // Aid Available
        },
      },
      {
        ...base,
        id: "technical-university-of-munich-de-munich",
        name: "Count 5",
        finance: { total_cost_year_usd: 90000, financial_aid: { merit_based: true, need_based: true } },
        matchData: {
          ...base.matchData,
          finalPrice: 90000, // Over budget
          preferenceMismatch: 0.08, // Your Vibe
          selectedChanceType: "grant",
          grantChance: 80, // Likely Grant
          conditional: true, // Conditional
          conditionalRequirements: 1,
          meetMinRequirements: false, // Below requirements
          aidAny: true,
        },
      },
    ];

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(makeAiSortResponse(items)),
    });
  });

  await page.goto("/universities.html", { waitUntil: "domcontentloaded" });
  await expect(page.locator('.uni-card[data-uni-id="technical-university-of-munich-de-munich"]')).toBeVisible();

  await expect(page.locator('.uni-card[data-uni-id="mit-usa-cambridge"]').locator(".uni-badge")).toHaveCount(0);
  await expect(page.locator('.uni-card[data-uni-id="harvard-usa-cambridge"]').locator(".uni-badge")).toHaveClass(/uni-badge--count-1/);
  await expect(page.locator('.uni-card[data-uni-id="stanford-university-usa-ca"]').locator(".uni-badge")).toHaveClass(/uni-badge--count-2/);
  await expect(page.locator('.uni-card[data-uni-id="eth-zurich-ch-zurich"]').locator(".uni-badge")).toHaveClass(/uni-badge--count-3/);
  await expect(page.locator('.uni-card[data-uni-id="epfl-ch-lausanne"]').locator(".uni-badge")).toHaveClass(/uni-badge--count-4/);
  await expect(page.locator('.uni-card[data-uni-id="technical-university-of-munich-de-munich"]').locator(".uni-badge")).toHaveClass(/uni-badge--count-5/);
});
