const { test, expect } = require("./helpers/coverage-test.cjs");
const { personas, seedProfile } = require("./helpers/personas");
const { openDisclosureParents } = require("./helpers/selectors");

const NU = "nazarbayev-university-kaz-astana";
const PROGRAM = "nu-a-study-bachelor-of-science-in-computer-science";
const ROUTE = "nu-a-route-regular-foundation-undergraduate";

async function openPublishedChecks(page) {
  const params = new URLSearchParams({ id: NU, admission_option: PROGRAM, admission_application_route: ROUTE,
    admission_level: "undergraduate", admission_route: "first_year", admission_cycle: "2027/28", admission_fee: "unknown" });
  const response = page.waitForResponse(item => item.url().includes(`/universities/${NU}/admissions-context`)
    && item.request().method() === "POST");
  await page.goto(`/university.html?${params}`);
  await expect(page.locator("body")).toHaveAttribute("data-page", "university");
  await expect(page.locator("#admissionsContext")).toHaveAttribute("data-state", "ready");
  await expect(page.locator("#tab-admission")).toHaveClass(/active/);
  const evaluated = await response;
  expect(evaluated.status()).toBe(200);
  const resolved = await evaluated.json();
  expect(resolved.context.study_option_id).toBe(PROGRAM);
  expect(resolved.context.application_route_id).toBe(ROUTE);
  const analysis = page.locator("#detailRequirements .admissions-catalog__assessment");
  await openDisclosureParents(analysis);
  await expect(analysis).toBeVisible();
  await expect(analysis).toContainText("not an admission probability");
  await expect(page.locator(".mit-admission-analysis")).toHaveCount(0);
  return { analysis, assessment: resolved.assessment };
}

test.describe("UniChance Calculator Validation", () => {
  test("anonymous user sees unavailable requirements fit", async ({ page }) => {
    await seedProfile(page, { _v: 2 });
    const { analysis, assessment } = await openPublishedChecks(page);
    expect(assessment.chanceAvailable).toBe(false);
    expect(assessment.chancePercent).toBeNull();
    expect(assessment.reason).toBe("missing_evidence");
    await expect(analysis).toContainText("No requirements-match percentage is available");
    await expect(analysis.locator(":scope > p").first()).not.toContainText(/\b0%/);
    await expect(analysis.locator(":scope > p > strong")).toHaveCount(0);
  });

  test("user with strong profile sees positive requirements fit", async ({ page }) => {
    await seedProfile(page, { ...personas.ruStemGrant.profile,
      exams: [{ exam: "SAT", score: 1490, taken_on: "2026-03-01" }],
      languages: [{ code: "en", kind: "exam", exam: "IELTS", score: 7.5, taken_on: "2026-03-01",
        details: { components: ["WRITING", "READING", "LISTENING", "SPEAKING"].map(part => ({ exam: `IELTS_${part}`, score: 7.5 })) } }],
    });
    const { analysis, assessment } = await openPublishedChecks(page);
    expect(assessment.chanceAvailable).toBe(true);
    expect(assessment.chancePercent).toBe(100);
    expect(assessment.scoreMeaning).toBe("published_requirements_met_percent");
    await expect(analysis.locator(":scope > p > strong")).toHaveText("100%");
    await expect(analysis).not.toContainText("No requirements-match percentage is available");
    for (const kind of ["academic_requirement", "language_requirement"]) {
      const check = assessment.activeChoice.details.checks.find(item => item.kind === kind);
      expect(check.status).toBe("met");
      expect(check.provided.minimum_checks.every(item => item.status === "met")).toBe(true);
    }
    const sat = analysis.locator("[data-minimum-exam='SAT'][data-minimum-status='met']");
    await openDisclosureParents(sat);
    await expect(sat).toBeVisible();
    await expect(sat).toContainText("1240");
    expect(await analysis.locator(":scope > p > strong").evaluate(node => node.getBoundingClientRect().width)).toBeGreaterThan(0);
  });
});
