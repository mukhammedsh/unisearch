const { test, expect } = require("./helpers/coverage-test.cjs");

const MIT = "mit-usa-cambridge";
const STANFORD = "stanford-university-usa-ca";

test("mobile UniFit explains a dated budget reference in the user's language", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    localStorage.setItem("unisearch_ui_language_v1", "rus");
    localStorage.setItem("unisearch_theme", "dark");
    localStorage.setItem("unisearch_universities_tour_seen_v1", "1");
    localStorage.setItem("unisearch_profile", JSON.stringify({
      _v: 2, studyLevel: "Bachelor", budget: 20000, budgetCurrency: "USD",
      intendedEntryCycle: "2027 entry", selectedAdmissionChoices: {},
    }));
  });
  await page.goto("/index.html?sort=uni_ai&q=MIT");
  await expect(page.locator("body")).toHaveAttribute("data-page", "universities");
  const card = page.locator(`[data-uni-id="${MIT}"]`);
  await expect(card.locator(".uni-cost-trigger")).toBeVisible();
  await card.locator(".uni-cost-trigger").click();
  await expect(card.locator("[data-budget-assessment]")).toBeVisible();
  await expect(card.locator("[data-budget-assessment]")).toContainText("Этот ориентир выше бюджета");
  await expect(card.locator("[data-cost-context]")).toContainText("Цикл поступления не подтверждён");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("budget-reference-mobile-ru-dark.png") });
});

test("basic budget profile without a major can discover, filter and shortlist universities", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.addInitScript(() => {
    if (sessionStorage.getItem("reviewed_personalized_journeys_seeded") === "1") return;
    sessionStorage.setItem("reviewed_personalized_journeys_seeded", "1");
    localStorage.setItem("unisearch_ui_language_v1", "eng");
    localStorage.setItem("unisearch_theme", "light");
    localStorage.setItem("unisearch_universities_tour_seen_v1", "1");
    localStorage.setItem("unisearch_profile", JSON.stringify({
      _v: 2,
      budget: 20000,
      budgetCurrency: "USD",
      studyMode: "On-campus",
      fundingType: "any",
      exams: [{ exam: "SAT", score: 1450 }],
      feeStatusContext: "self_reported_international_overseas",
      intendedEntryCycle: "2027 entry",
      selectedAdmissionChoices: {},
    }));
    localStorage.removeItem("unisearch_filters");
    localStorage.removeItem("unisearch_compare_university_ids_v1");
  });

  let rankingRequest;
  page.on("request", request => {
    if (new URL(request.url()).pathname.endsWith("/universities/ai-sort")) rankingRequest = request;
  });
  const rankingResponse = page.waitForResponse(response =>
    new URL(response.url()).pathname.endsWith("/universities/ai-sort") && response.request().method() === "POST");
  await page.goto("/index.html?sort=uni_ai");
  await expect(page.locator("body")).toHaveAttribute("data-page", "universities");
  await expect(page.locator("#universitiesList .uni-card:not(.is-skeleton)").first()).toBeVisible();
  expect((await rankingResponse).status()).toBe(200);

  const profile = rankingRequest.postDataJSON().profile;
  expect(profile.budget).toBe(20000);
  expect(profile.major || "").toBe("");
  expect(Object.values(profile.selectedAdmissionChoices || {}).some(choice => choice.studyOptionId)).toBe(false);

  let catalogRequest;
  page.on("request", request => {
    const url = new URL(request.url());
    if (url.pathname.endsWith("/universities/profiled") && request.method() === "POST") catalogRequest = request;
  });
  await page.goto("/index.html?sort=name_asc&study_level=undergraduate&cost_basis=tuition&max_tuition=70000");
  await expect(page.locator("body")).toHaveAttribute("data-page", "universities");
  await expect(page.locator("#universitiesList .uni-card:not(.is-skeleton)").first()).toBeVisible();
  await expect.poll(() => catalogRequest && catalogRequest.postDataJSON().fee_status_context)
    .toBe("self_reported_international_overseas");
  const query = catalogRequest.postDataJSON();
  expect(query.intended_entry_cycle).toBe("2027 entry");
  expect(query.major).toBeUndefined();
  expect(query.study_level).toBe("undergraduate");
  expect(query.cost_basis).toBe("tuition");
  expect(query.max_tuition).toBe("70001");

  const aiSortResponse = page.waitForResponse(response =>
    new URL(response.url()).pathname.endsWith("/universities/ai-sort") && response.request().method() === "POST");
  await page.goto("/index.html?sort=uni_ai");
  await expect(page.locator("body")).toHaveAttribute("data-page", "universities");
  await expect(page.locator("#universitiesList .uni-card:not(.is-skeleton)").first()).toBeVisible();
  expect((await aiSortResponse).status()).toBe(200);
  await page.locator("#compareModeBtn").click();
  await expect(page.locator("#compareModeBtn")).toHaveAttribute("aria-pressed", "true");
  for (const id of [MIT, STANFORD]) {
    const response = page.waitForResponse(item =>
      new URL(item.url()).pathname.endsWith("/universities/ai-sort") && item.request().method() === "POST");
    await page.fill("#qInput", id === MIT ? "MIT" : "Stanford");
    expect((await response).status()).toBe(200);
    const card = page.locator(`#universitiesList .uni-card[data-uni-id="${id}"]`);
    await expect(card).toBeVisible();
    await card.locator(".uni-card-link-overlay").press("Enter");
    await expect(card).toHaveClass(/uni-card--compare-selected/);
  }
  await expect(page.locator("#compareTray .compare-tray__chip")).toHaveCount(2);
  await page.locator('[data-action="open-compare"]').click();
  await expect(page.locator("body")).toHaveAttribute("data-page", "compare");
  await expect(page.locator(".compare-config-column")).toHaveCount(2);
  await expect(page).toHaveURL(new RegExp(`${MIT}.*${STANFORD}|${STANFORD}.*${MIT}`));
});


for (const [language, heading, action, width, theme] of [
  ["eng", "Minimum requirements match", "Check requirements", 1280, "light"],
  ["rus", "Соответствие минимальным требованиям", "Проверить требования", 390, "dark"],
  ["kaz", "Ең төменгі талаптарға сәйкестік", "Талаптарды тексеру", 390, "light"],
]) {
  test(`${language} cards show the requirements percentage and open the university`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.addInitScript(({ language, theme }) => {
      localStorage.setItem("unisearch_ui_language_v1", language);
      localStorage.setItem("unisearch_theme", theme);
      localStorage.setItem("unisearch_universities_tour_seen_v1", "1");
    }, { language, theme });
    await page.route("**/universities/ai-sort", route => route.fulfill({
      status: 200, contentType: "application/json", body: JSON.stringify({
        items: [{ id: MIT, name: "Massachusetts Institute of Technology",
          location: { country: "USA", city: "Cambridge" }, admissions_catalog: { availability: "reviewed" },
          matchData: { finalScore: 0.1, preferenceMismatch: 0.1,
            userPreferences: { practice_vs_science: 0.99 }, factors: { practice_vs_science: 0.99 },
            requirementsFitPercent: 50, requirementChecks: [
              { measurable: true, status: "met" }, { measurable: true, status: "unmet" },
            ],
          },
        }], total: 1, page: 1, limit: 20, warnings: [],
      }),
    }));
    await page.goto("/index.html?sort=uni_ai");
    await expect(page.locator("body")).toHaveAttribute("data-page", "universities");
    const card = page.locator(`[data-uni-id="${MIT}"]`);
    await expect(card.locator(".uni-status-value")).toHaveText("50%");
    const preference = card.locator(".uni-status-trigger--match");
    await preference.click();
    await expect(card.locator(".uni-status-tooltip__content:visible")).not.toContainText("99/100");
    await expect(card.locator(".uni-status-tooltip__content:visible")).not.toContainText("UniFit penalty");
    await expect(card.getByRole("link", { name: action })).toHaveCount(0);
    await page.keyboard.press("Escape");
    await card.locator(".uni-card-link-overlay").press("Enter");
    await expect(page.locator("body")).toHaveAttribute("data-page", "university");
    await expect(page.locator("#admissionsContext")).toHaveAttribute("data-state", "ready");
    await page.locator('[data-tab="tab-admission"]').click();
    await expect(page.locator("#tab-admission")).toHaveClass(/active/);
    const result = page.locator("#detailRequirements [data-requirements-match]");
    await expect(result.getByRole("heading", { name: heading, exact: true })).toBeVisible();
    await expect(result.getByRole("button")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
