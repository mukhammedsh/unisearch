/**
 * Playwright network mocks for UniSearch AI endpoints.
 * Use these to avoid 429 rate limits in CI and ensure deterministic test data.
 */

async function mockAiSort(page, options = {}) {
  const items = options.items || [
    {
      id: "harvard",
      name: "Harvard University",
      location: { city: "Cambridge", country: "USA" },
      rank: 1,
      finance: { total_cost_year_usd: 80000 },
      academics: { acceptance_rate_percent: 4.5 },
      matchData: { preferenceMismatch: 0.05 }
    },
    {
      id: "mit",
      name: "MIT",
      location: { city: "Cambridge", country: "USA" },
      rank: 2,
      finance: { total_cost_year_usd: 78000 },
      academics: { acceptance_rate_percent: 6.7 },
      matchData: { preferenceMismatch: 0.08 }
    }
  ];

  await page.route("**/universities/ai-sort", async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          items,
          total: items.length,
          count: items.length,
          page: 1,
          limit: options.limit || 24,
          sort: "uni_ai",
          warnings: options.warnings || []
        })
      });
    } else {
      await route.continue();
    }
  });
}

async function mockExamValidation(page) {
  await page.route("**/exams/validate", async (route) => {
    if (route.request().method() === "POST") {
      const payload = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ...payload,
          ok: true,
          display_value: payload.score ? String(payload.score) : (payload.raw_value || "OK")
        })
      });
    } else {
      await route.continue();
    }
  });
}

async function mockLanguageValidation(page) {
  await page.route("**/languages/validate", async (route) => {
    if (route.request().method() === "POST") {
      const payload = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ...payload,
          ok: true
        })
      });
    } else {
      await route.continue();
    }
  });
}

async function mockUniversitiesList(page, options = {}) {
  const items = options.items || [
    {
      id: "mit-usa-cambridge",
      name: "MIT",
      location: { city: "Cambridge", country: "USA" },
      rank: 1,
      finance: { total_cost_year_usd: 78000 }
    },
    {
      id: "imperial-college-london-uk",
      name: "Imperial College London",
      location: { city: "London", country: "UK" },
      rank: 2,
      finance: { total_cost_year_usd: 45000 }
    }
  ];

  await page.route("**/universities?*", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          items,
          total: items.length,
          count: items.length,
          page: 1,
          limit: 24
        })
      });
    } else {
      await route.continue();
    }
  });
}

async function mockAllExpensiveEndpoints(page, options = {}) {
  await mockAiSort(page, options);
  await mockExamValidation(page);
  await mockLanguageValidation(page);
  await mockUniversitiesList(page, options);
}

module.exports = {
  mockAiSort,
  mockExamValidation,
  mockLanguageValidation,
  mockUniversitiesList,
  mockAllExpensiveEndpoints
};
