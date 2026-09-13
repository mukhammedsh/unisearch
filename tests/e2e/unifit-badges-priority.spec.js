const { test, expect } = require("@playwright/test");
const { personas, seedProfile } = require("./helpers/personas");
const { setNativeSelect } = require("./helpers/selectors");

function makeAiSortResponse(items) {
  return {
    items,
    total: items.length,
    page: 1,
    limit: items.length,
    warnings: [],
  };
}

test("UniFit warning returns after a reload or a new UniFit selection", async ({ page }) => {
  await seedProfile(page, personas.enResearch.profile);

  await page.route("**/universities/ai-sort", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(makeAiSortResponse([
        {
          id: "conditional-warning-university",
          name: "Conditional Warning University",
          location: { country: "USA", city: "Boston" },
          finance: { total_cost_year_usd: 25000 },
          academics: { acceptance_rate_percent: 30 },
          matchData: {
            conditional: true,
            conditionalRequirements: 1,
            uiBadgeHints: { showConditionalExamNeeded: true },
          },
        },
      ])),
    });
  });

  await page.goto("/index.html", { waitUntil: "domcontentloaded" });
  const warning = page.locator("#unifitWarningBanner");
  const dismiss = page.locator("#dismissUnifitWarningBanner");
  await expect(warning).toBeVisible();
  await page.locator("#compareModeBtn").click();
  await expect(warning).toBeVisible();
  await page.locator("#compareModeBtn").click();
  await expect(dismiss).toHaveCSS("border-radius", "10px");
  const isDismissIconCentered = await dismiss.evaluate((button) => {
    const icon = button.querySelector("svg");
    if (!icon) return false;
    const buttonBox = button.getBoundingClientRect();
    const iconBox = icon.getBoundingClientRect();
    return Math.abs((buttonBox.left + buttonBox.width / 2) - (iconBox.left + iconBox.width / 2)) < 0.1
      && Math.abs((buttonBox.top + buttonBox.height / 2) - (iconBox.top + iconBox.height / 2)) < 0.1;
  });
  expect(isDismissIconCentered).toBe(true);

  await dismiss.click();
  await expect(warning).toBeHidden();

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(warning).toBeVisible();

  await dismiss.click();
  await setNativeSelect(page, "sortSelect", "name_asc");
  await expect(warning).toBeHidden();

  await setNativeSelect(page, "sortSelect", "uni_ai");
  await expect(warning).toBeVisible();
});

test("UniFit cards prioritize status icons in order: conditional -> vibe -> finance", async ({ page }) => {
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

  await page.goto("/index.html", { waitUntil: "domcontentloaded" });
  const firstCard = page.locator('.uni-card[data-uni-id="mit-usa-cambridge"]');
  await expect(firstCard).toBeVisible();

  const statuses = firstCard.locator(".uni-card-statuses .uni-status-trigger");
  await expect(statuses).toHaveCount(3);
  await expect(statuses.nth(0)).toHaveAttribute("aria-label", /Conditional/);
  await expect(statuses.nth(1)).toHaveAttribute("aria-label", /Your Vibe/);
  await expect(statuses.nth(2)).toHaveAttribute("aria-label", /Likely Grant/);
  await expect(page.locator("#unifitWarningBanner")).toBeVisible();
  await expect(firstCard.locator(".uni-why")).toHaveCount(0);
});

test("UniFit card status icons still work when backend hints are missing (frontend fallback)", async ({ page }) => {
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

  await page.goto("/index.html");
  const firstCard = page.locator('.uni-card[data-uni-id="harvard-usa-cambridge"]');
  await expect(firstCard).toBeVisible();
  const statuses = firstCard.locator(".uni-card-statuses .uni-status-trigger");
  await expect(statuses).toHaveCount(2);
  await expect(statuses.nth(0)).toHaveAttribute("aria-label", /Good Match/);
  await expect(statuses.nth(1)).toHaveAttribute("aria-label", /Paid Admission/);
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

  await page.goto("/index.html", { waitUntil: "domcontentloaded" });
  const firstCard = page.locator('.uni-card[data-uni-id="mit-usa-cambridge"]');
  await expect(firstCard).toBeVisible();
  const statuses = firstCard.locator(".uni-card-statuses .uni-status-trigger");
  await expect(statuses).toHaveCount(3);
});

test("UniFit card caps overlay status icons at four by priority", async ({ page }) => {
  await seedProfile(page, personas.enResearch.profile);

  await page.route("**/universities/ai-sort", async (route) => {
    const items = [
      {
        id: "mit-usa-cambridge",
        name: "Dense Badge University",
        rank: 7,
        location: { country: "USA", city: "Boston" },
        finance: {
          total_cost_year_usd: 98000
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

  await page.goto("/index.html");
  const firstCard = page.locator('.uni-card[data-uni-id="mit-usa-cambridge"]');
  await expect(firstCard).toBeVisible();

  const statuses = firstCard.locator(".uni-card-statuses .uni-status-trigger");
  await expect(statuses).toHaveCount(4);
  await expect(statuses.nth(0)).toHaveAttribute("aria-label", /Conditional/);
  await expect(statuses.nth(1)).toHaveAttribute("aria-label", /Your Vibe/);
  await expect(statuses.nth(2)).toHaveAttribute("aria-label", /Likely Grant/);
  await expect(statuses.nth(3)).toHaveAttribute("aria-label", /Below Requirements/);
});

test("UniFit card status icon logic caps at four", async ({ page }) => {
  await seedProfile(page, personas.enResearch.profile);

  await page.route("**/universities/ai-sort", async (route) => {
    const items = [
      {
        id: "mit-usa-cambridge",
        name: "Max Badge University",
        rank: 9,
        location: { country: "USA", city: "Boston" },
        finance: {
          total_cost_year_usd: 96000
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

  await page.goto("/index.html");
  const statuses = page.locator('.uni-card[data-uni-id="mit-usa-cambridge"]').locator(".uni-card-statuses .uni-status-trigger");
  await expect(statuses).toHaveCount(4);
});

test("UniFit cards render zero to four compact status icons", async ({ page }) => {
  await seedProfile(page, personas.enResearch.profile);

  await page.route("**/universities/ai-sort", async (route) => {
    const base = {
      location: { country: "USA", city: "Boston" },
      finance: { total_cost_year_usd: 30000 },
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
        finance: { total_cost_year_usd: 30000 },
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
        finance: { total_cost_year_usd: 90000 },
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

  await page.goto("/index.html", { waitUntil: "domcontentloaded" });
  await expect(page.locator('.uni-card[data-uni-id="technical-university-of-munich-de-munich"]')).toBeVisible();

  await expect(page.locator('.uni-card[data-uni-id="mit-usa-cambridge"]').locator(".uni-card-statuses")).toHaveCount(0);
  await expect(page.locator('.uni-card[data-uni-id="harvard-usa-cambridge"]').locator(".uni-status-trigger")).toHaveCount(1);
  await expect(page.locator('.uni-card[data-uni-id="stanford-university-usa-ca"]').locator(".uni-status-trigger")).toHaveCount(2);
  await expect(page.locator('.uni-card[data-uni-id="eth-zurich-ch-zurich"]').locator(".uni-status-trigger")).toHaveCount(3);
  await expect(page.locator('.uni-card[data-uni-id="epfl-ch-lausanne"]').locator(".uni-status-trigger")).toHaveCount(4);
  await expect(page.locator('.uni-card[data-uni-id="technical-university-of-munich-de-munich"]').locator(".uni-status-trigger")).toHaveCount(4);
});
