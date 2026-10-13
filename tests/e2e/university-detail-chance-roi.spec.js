const { test, expect } = require("@playwright/test");
const { personas, seedProfile } = require("./helpers/personas");
const { selectors } = require("./helpers/selectors");

const MIT_ID = "mit-usa-cambridge";
const MBA_URL = "/university.html?id=mit-usa-cambridge&admission_option=mit-sloan-mba-full-time&admission_application_route=mit_sloan_mba_admissions&admission_level=masters&admission_route=graduate&admission_cycle=2027%20entry&admission_fee=unknown";
const MIT_FIRST_YEAR_URL = "/university.html?id=mit-usa-cambridge&admission_option=mit-course-6-3-bachelor&admission_application_route=mit-first-year&admission_level=undergraduate&admission_route=first_year&admission_cycle=Fall%202027%20entry&admission_fee=unknown";

async function openAssessment(page) {
  const details = page.locator("#detailRequirements details.admissions-catalog__assessment-detail");
  if (await details.count() && !(await details.evaluate((node) => node.open))) await details.locator(":scope > summary").click();
  return page.locator("#detailRequirements .admissions-catalog__assessment");
}

async function openEvidence(fact) {
  const evidence = fact.locator("details.admissions-catalog__evidence");
  if (await evidence.count() && !(await evidence.evaluate((node) => node.open))) await evidence.locator(":scope > summary").click();
}

function contextResponse(response) {
  return response.url().includes(`/universities/${MIT_ID}/admissions-context`)
    && response.request().method() === "POST";
}

test("MIT Sloan stays unscored after a profile update and keeps its current annual total unresolved", async ({ page }) => {
  await seedProfile(page, {
    ...personas.enResearch.profile,
    studyLevel: "Master",
    applicantRoute: "graduate",
    major: "Business",
    gpa: 4,
    exams: [{ exam: "SAT", score: 1550 }],
  });
  const initialResponsePromise = page.waitForResponse(contextResponse);
  await page.goto(MBA_URL);
  await expect(page.locator("#detailCard")).toBeVisible();
  await expect(page.locator("#admissionsContext")).toHaveAttribute("data-state", "ready");
  const initialResponse = await initialResponsePromise;
  expect(initialResponse.ok()).toBeTruthy();
  expect((await initialResponse.json()).assessment.chancePercent).toBeNull();

  await page.locator('.d-tab-btn[data-tab="tab-admission"]').click();
  const assessment = await openAssessment(page);
  await expect(assessment).toBeVisible();
  await expect(assessment).not.toContainText(/\d+(?:\.\d+)?\s*%/);

  await page.click(selectors.profileBtn);
  await expect(page.locator(selectors.profileModal)).toHaveClass(/is-open/);
  await page.fill(selectors.budgetInput, "42000");
  await page.click(selectors.saveProfileBtn);
  await expect(page.locator(selectors.saveProfileBtn)).toBeDisabled();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("unisearch_profile") || "{}").budget)).toBe(42000);
  const refreshedResponsePromise = page.waitForResponse(contextResponse);
  await page.click(selectors.profileCloseBtn);
  await expect(page.locator("body")).toHaveAttribute("data-page", "university");
  const refreshedResponse = await refreshedResponsePromise;
  expect(refreshedResponse.ok()).toBeTruthy();
  expect((await refreshedResponse.json()).assessment.chancePercent).toBeNull();
  await expect(page.locator("#admissionsContext")).toHaveAttribute("data-state", "ready");
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("unisearch_profile") || "{}").budget)).toBe(42000);

  await page.locator('.d-tab-btn[data-tab="tab-finance"]').click();
  const finance = page.locator("#detailFinance");
  await expect(finance).toContainText(/comparable annual total is not established/i);
  const feeConflict = finance.locator('[data-admissions-domain="costs"] [data-admissions-fact="mba-tuition-fee-conflict"]');
  await expect(feeConflict).toBeVisible();
  await feeConflict.locator(":scope > summary").click();
  await expect(feeConflict).toContainText(/2026[-\u2011]2027/);
  await expect(feeConflict).toContainText(/91,?892/);
  await expect(feeConflict).toContainText("Confirm current billed tuition");
  await expect(finance).not.toContainText(/\$\s?0(?:\.00)?\b/);
  await expect(page.locator(".roi-box")).toHaveCount(0);
});

test("detail page hides ROI when official salary data is missing", async ({ page }) => {
  await seedProfile(page, {
    ...personas.enResearch.profile,
    major: "Computer Science",
  });
  await page.goto("/university.html?id=astana-it-university-kaz-astana");

  await expect(page.locator("#detailCard")).toBeVisible();
  await page.click(".d-tab-btn[data-tab='tab-finance']");
  await expect(page.locator(".roi-box")).toHaveCount(0);
});

test("rank tooltip stays usable for the legacy catalog and MIT admissions sources expand", async ({ page }) => {
  await seedProfile(page, {
    ...personas.enResearch.profile,
    major: "Computer Science",
    gpa: 4,
    exams: [{ exam: "SAT", score: 1550 }],
  });
  await page.goto("/university.html?id=astana-it-university-kaz-astana");
  await expect(page.locator("#detailCard")).toBeVisible();

  const rankInfoBtn = page.locator("#detailRecommendations .d-info-wrap .d-info").first();
  await expect(rankInfoBtn).toBeVisible();
  const rankTooltip = page.locator("#detailRecommendations .d-info-wrap .d-tooltip").first();
  await expect(rankTooltip).not.toBeVisible();
  await rankInfoBtn.click();
  await expect(rankTooltip).toBeVisible();
  await rankInfoBtn.click();
  await expect(rankTooltip).not.toBeVisible();

  const contextResponsePromise = page.waitForResponse(contextResponse);
  await page.goto(MIT_FIRST_YEAR_URL);
  await expect(page.locator("#admissionsContext")).toHaveAttribute("data-state", "ready");
  expect((await contextResponsePromise).ok()).toBeTruthy();
  await page.locator('.d-tab-btn[data-tab="tab-admission"]').click();
  const fact = page.locator('#detailRequirements [data-admissions-fact="ug-sat-act-presence"]');
  await expect(fact).toBeVisible();
  await fact.locator(":scope > summary").click();
  await openEvidence(fact);
  await expect(fact.locator("a[href^='https://']").first()).toBeVisible();
  await expect(fact.locator("a[href^='https://']").first()).toHaveAttribute("href", /^https:\/\/mitadmissions\.org\//);
});
