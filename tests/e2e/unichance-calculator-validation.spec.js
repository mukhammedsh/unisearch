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
  const analysis = page.locator("#detailRequirements [data-requirements-match]");
  await openDisclosureParents(analysis);
  await expect(analysis).toBeVisible();
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
    // Without evidence the checklist of published minimums is the answer: it says what to add, and no percentage is claimed.
    await expect(analysis).toContainText("Your results against the published minimums");
    await expect(analysis).toContainText(/Add: /);
    await expect(analysis.getByRole("link", { name: "Edit profile" })).toBeVisible();
    await expect(analysis).not.toContainText("not an admission probability");
    await expect(analysis.locator(".admissions-key-facts__value")).not.toContainText(/\b0%/);
    await expect(analysis.locator(".admissions-key-facts__value")).not.toContainText(/\d+(?:\.\d+)?\s*%/);
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
    await expect(analysis.locator(".admissions-key-facts__value")).toContainText("(100%)");
    await expect(analysis).not.toContainText("No requirements-match percentage is available");
    // The caveat that the share is not an admission probability appears next to a measured share.
    await expect(analysis).toContainText("not an admission probability");
    for (const kind of ["academic_requirement", "language_requirement"]) {
      const check = assessment.activeChoice.details.checks.find(item => item.kind === kind);
      expect(check.status).toBe("met");
      expect(check.provided.minimum_checks.every(item => item.status === "met")).toBe(true);
    }
    // Each measured minimum is marked met in the key-facts checklist; the test alternatives name SAT with its published minimum.
    const met = analysis.locator(".admissions-key-facts__checklist li[data-mark='met']");
    await expect(met).toHaveCount(2);
    await expect(met.filter({ hasText: "SAT 1240" })).toBeVisible();
    expect(await analysis.locator(".admissions-key-facts__value").evaluate(node => node.getBoundingClientRect().width)).toBeGreaterThan(0);
  });
});
