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

test("UniFit distinguishes unknown fit from failure and explains the actual evidence and budget", async ({ page }) => {
  await seedProfile(page, { ...personas.enResearch.profile, budget: 20000 });
  await page.addInitScript(() => localStorage.setItem("unisearch_ui_language_v1", "eng"));
  await page.route("**/universities/ai-sort", async (route) => {
    const shared = {
      name: "Scoped Evidence University", location: { country: "USA", city: "Boston" },
      finance: { total_cost_year_usd: 30000 },
      admission_categories: [{ id: "unrelated-aid", requirement_profiles: [{ id: "general", funding_options: [{ id: "award", funding_type: "grant" }] }] }],
    };
    await route.fulfill({ json: makeAiSortResponse([
      { ...shared, id: "unknown-fit-u", matchData: {
        aidAny: false, meetMinRequirements: false, requirementsFitPercent: null,
        requirementsReason: "no_published_requirements", scoreMeaning: "published_requirements_met_percent",
        finalPrice: null, finalPriceUSD: null, costMode: "unavailable", preferenceMismatch: 0.1,
        userPreferences: { practice_vs_science: 0.7 }, factors: { practice_vs_science: 0.8 },
      } },
      { ...shared, id: "unmet-fit-u", matchData: {
        aidAny: false, meetMinRequirements: false, requirementsFitPercent: 0, finalPrice: 30000,
        finalPriceUSD: 30000, currency: "USD", preferenceMismatch: 0.5,
        requirementChecks: [{ exam: "IELTS", minimum: 7.5, provided: 7, status: "unmet" }],
      } },
      { ...shared, id: "missing-fit-u", matchData: {
        aidAny: false, meetMinRequirements: false, requirementsFitPercent: null, conditional: true,
        conditionalRequirements: 1, finalPrice: 10000, preferenceMismatch: 0.5,
        requirementChecks: [{ exam: "GMAT_FOCUS or GMAT or GRE", minimum: null, provided: null, status: "missing" }],
      } },
    ]) });
  });
  await page.goto("/index.html");
  const unknown = page.locator('.uni-card[data-uni-id="unknown-fit-u"]');
  await expect(unknown).toBeVisible();
  await expect(unknown.locator(".uni-status-trigger[aria-label*='Below Requirements']")).toHaveCount(0);
  await expect(unknown.locator(".uni-status-trigger[aria-label*='Aid Available']")).toHaveCount(0);
  await expect(unknown.locator(".uni-status-trigger[aria-label*='No data']")).toHaveAttribute("aria-label", /no measurable published minimums/);
  await expect(unknown.locator(".uni-status-trigger[aria-label*='Your Vibe']")).toHaveAttribute("aria-label", /Focus.*70\/100.*80\/100/);
  const unmet = page.locator('.uni-card[data-uni-id="unmet-fit-u"]');
  await expect(unmet.locator(".uni-status-trigger[aria-label*='Below Requirements']")).toHaveAttribute("aria-label", /IELTS.*7.5.*7.*Below minimum/);
  await expect(unmet.locator(".uni-status-trigger[aria-label*='Over Budget']")).toHaveAttribute("aria-label", /30.*20.*Potential funding has not been deducted/);
  const missing = page.locator('.uni-card[data-uni-id="missing-fit-u"]');
  await expect(missing.locator(".uni-status-trigger[aria-label*='Conditional']")).toHaveAttribute("aria-label", /GMAT.*GRE.*Not provided/);
  await expect(missing.locator(".uni-status-trigger[aria-label*='Below Requirements']")).toHaveCount(0);
});

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

test("UniFit cards show requirement and preference signals without grant odds", async ({ page }) => {
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
  await expect(statuses).toHaveCount(2);
  await expect(statuses.nth(0)).toHaveAttribute("aria-label", /Conditional/);
  await expect(statuses.nth(1)).toHaveAttribute("aria-label", /Your Vibe/);
  await expect(firstCard).not.toContainText("Likely Grant");
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
  await expect(statuses).toHaveCount(1);
  await expect(statuses.nth(0)).toHaveAttribute("aria-label", /Good Match/);
  await expect(firstCard).not.toContainText("Paid Admission");
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
  await expect(statuses).toHaveCount(2);
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
          requirementsFitPercent: 0, // Verified minimum failure, distinct from an unknown fit.
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

  const rowStatuses = firstCard.locator(".uni-card-statuses > .uni-status-tooltip > .uni-status-trigger");
  await expect(rowStatuses).toHaveCount(4);
  await expect(rowStatuses.nth(0)).toHaveAttribute("aria-label", /Conditional/);
  await expect(rowStatuses.nth(1)).toHaveAttribute("aria-label", /Your Vibe/);
  await expect(rowStatuses.nth(2)).toHaveAttribute("aria-label", /Below Requirements/);
  await expect(rowStatuses.nth(3)).toHaveAttribute("aria-label", /Aid Available/);
  await expect(firstCard).not.toContainText("Likely Grant");

  const overflowTrigger = firstCard.locator(".uni-status-overflow-trigger");
  await expect(overflowTrigger).toHaveCount(0);
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
          requirementsFitPercent: 0, // Verified minimum failure, distinct from an unknown fit.
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
  const cardStatuses = page.locator('.uni-card[data-uni-id="mit-usa-cambridge"]').locator(".uni-card-statuses > *");
  await expect(cardStatuses).toHaveCount(4);
  await expect(page.locator('.uni-card[data-uni-id="mit-usa-cambridge"]').locator(".uni-status-overflow-trigger")).toHaveCount(0);
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
          meetMinRequirements: false,
          requirementsFitPercent: 0, // Verified minimum failure, distinct from an unknown fit. // Below requirements
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
  await expect(page.locator('.uni-card[data-uni-id="stanford-university-usa-ca"]').locator(".uni-status-trigger")).toHaveCount(1);
  await expect(page.locator('.uni-card[data-uni-id="eth-zurich-ch-zurich"]').locator(".uni-status-trigger")).toHaveCount(2);
  await expect(page.locator('.uni-card[data-uni-id="epfl-ch-lausanne"]').locator(".uni-status-trigger")).toHaveCount(3);
  await expect(page.locator('.uni-card[data-uni-id="technical-university-of-munich-de-munich"]').locator(".uni-card-statuses > *")).toHaveCount(4);
  await expect(page.locator('.uni-card[data-uni-id="technical-university-of-munich-de-munich"]').locator(".uni-status-overflow-trigger")).toHaveCount(0);
});

test("UniFit card renders Program Not Offered warning badge when selected profile major is missing", async ({ page }) => {
  await seedProfile(page, personas.enResearch.profile);

  await page.route("**/universities/ai-sort", async (route) => {
    const items = [
      {
        id: "mit-usa-cambridge",
        name: "Missing Program University",
        rank: 1,
        location: { country: "USA", city: "Cambridge" },
        finance: { total_cost_year_usd: 50000 },
        academics: { acceptance_rate_percent: 4 },
        matchData: {
          finalPrice: 50000,
          missingProgram: true,
          uiBadgeHints: {
            missingProgram: true,
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

  const badge = firstCard.locator(".uni-status-trigger--warning");
  await expect(badge).toBeVisible();
  await expect(badge).toHaveAttribute("aria-label", /Program Not Offered/);
  await badge.hover();
  await expect(firstCard.locator(".uni-status-tooltip__content")).toContainText("Program Not Offered");
});

test("UniFit overflow popover toggles on click and dismisses on Escape", async ({ page }) => {
  await seedProfile(page, personas.enResearch.profile);

  await page.route("**/universities/ai-sort", async (route) => {
    const items = [
      {
        id: "mit-usa-cambridge",
        name: "Overflow Test University",
        rank: 1,
        location: { country: "USA", city: "Cambridge" },
        finance: { total_cost_year_usd: 95000 },
        academics: { acceptance_rate_percent: 5 },
        matchData: {
          finalPrice: 95000,
          preferenceMismatch: 0.08,
          selectedChanceType: "grant",
          grantChance: 90,
          generalChance: 40,
          conditional: true,
          conditionalRequirements: 2,
          meetMinRequirements: false,
          requirementsFitPercent: 0, // Verified minimum failure, distinct from an unknown fit.
          missingProgram: true,
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

  const overflowBtn = firstCard.locator(".uni-status-overflow-trigger");
  const popover = firstCard.locator(".uni-status-overflow-popover");
  await expect(overflowBtn).toBeVisible();
  await expect(overflowBtn).toHaveAttribute("aria-expanded", "false");
  await expect(popover).toBeHidden();

  // Open popover
  await overflowBtn.click();
  await expect(overflowBtn).toHaveAttribute("aria-expanded", "true");
  await expect(popover).toBeVisible();

  // Dismiss on Escape
  await page.keyboard.press("Escape");
  await expect(overflowBtn).toHaveAttribute("aria-expanded", "false");
  await expect(popover).toBeHidden();
});
