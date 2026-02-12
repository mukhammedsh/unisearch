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

  await page.goto("/universities.html");
  const firstCard = page.locator(".uni-card").first();
  await expect(firstCard).toBeVisible();

  const pills = firstCard.locator(".uni-pill");
  await expect(pills).toHaveCount(3);
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
  await expect(firstCard.locator(".uni-pill")).toContainText(["Top Match", "Paid Admission"]);
  await expect(firstCard.locator(".uni-why")).toContainText("strong");
});
