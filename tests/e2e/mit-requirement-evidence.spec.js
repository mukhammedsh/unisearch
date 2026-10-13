const { test, expect } = require("@playwright/test");
const { markTourAsSeen, seedProfile } = require("./helpers/personas");
const { openProfileTab, selectors, setNativeSelect } = require("./helpers/selectors");

const MIT_ID = "mit-usa-cambridge";
const MBA_OPTION = "mit-sloan-mba-full-time";
const MBA_ROUTE = "mit_sloan_mba_admissions";
const MBA_EXAMS_FACT = "mit_sloan_mba_admissions-required-exam-alternatives";

function contextUrl({ option, route, level, applicant, cycle, fee = "unknown" }) {
  const params = new URLSearchParams({
    id: MIT_ID,
    admission_option: option,
    admission_application_route: route,
    admission_level: level,
    admission_route: applicant,
    admission_cycle: cycle,
    admission_fee: fee,
  });
  return `/university.html?${params}`;
}

async function openContext(page, context, { language = "eng", theme = "light", profile } = {}) {
  await page.setViewportSize({ width: language === "eng" ? 1280 : 390, height: 900 });
  await markTourAsSeen(page);
  if (profile) await seedProfile(page, profile);
  await page.addInitScript(({ selectedLanguage, selectedTheme }) => {
    localStorage.setItem("unisearch_ui_language_v1", selectedLanguage);
    localStorage.setItem("unisearch_theme", selectedTheme);
  }, { selectedLanguage: language, selectedTheme: theme });

  const responsePromise = page.waitForResponse((response) =>
    response.url().includes(`/universities/${MIT_ID}/admissions-context`)
    && response.request().method() === "POST");
  await page.goto(contextUrl(context));
  await expect(page.locator("body")).toHaveAttribute("data-page", "university");
  await expect(page.locator("#detailName")).not.toBeEmpty();
  await expect(page.locator("#tab-admission")).toHaveClass(/active/);
  await expect(page.locator("#admissionsContext")).toHaveAttribute("data-state", "ready");
  const response = await responsePromise;
  expect(response.status()).toBe(200);
  return { data: await response.json(), response };
}

async function openFact(page, tab, id) {
  await page.locator(`.d-tab-btn[data-tab="tab-${tab}"]`).click();
  await expect(page.locator(`#tab-${tab}`)).toHaveClass(/active/);
  const fact = page.locator(`#tab-${tab} [data-admissions-fact="${id}"]`).first();
  await expect(fact).toBeVisible();
  const summary = fact.locator("summary");
  if (await summary.count() && !(await fact.evaluate((node) => node.open))) await fact.locator(":scope > summary").click();
  return fact;
}

async function openAssessment(page) {
  const details = page.locator("#detailRequirements details.admissions-catalog__assessment-detail");
  if (await details.count() && !(await details.evaluate((node) => node.open))) await details.locator(":scope > summary").click();
  return page.locator("#detailRequirements .admissions-catalog__assessment");
}

async function openAdvanced(page) {
  const advanced = page.locator("#admissionsAdvanced");
  if (await advanced.count() && !(await advanced.evaluate((node) => node.open))) await advanced.locator(":scope > summary").click();
}

function expectNoPercentage(data) {
  expect(data.assessment.chancePercent).toBeNull();
  expect(data.assessment.overallChance).toBeNull();
  expect(data.assessment.activeChoice.chancePercent).toBeNull();
}

test("MIT AeroAstro preserves English waiver, test-age, source conflict, and an unspecified cycle", async ({ page }) => {
  const context = {
    option: "mit-aeroastro-phd",
    route: "mit_aeroastro_doctoral_admissions",
    level: "doctoral",
    applicant: "graduate",
    cycle: "",
  };
  const { data } = await openContext(page, context, {
    profile: {
      studyLevel: "Doctorate",
      applicantRoute: "graduate",
      intendedEntryCycle: "2027 entry",
      languages: [{ code: "en", kind: "exam", exam: "IELTS", score: 7.5, taken_on: "2025-03-15" }],
    },
  });

  expect(data.selected_option.id).toBe(context.option);
  expect(data.selected_route.id).toBe(context.route);
  expect(data.context.intended_entry_cycle).toBeNull();
  expectNoPercentage(data);

  const testsFact = data.facts.find((fact) => fact.id === "reviewed-mit_aeroastro_doctoral_admissions-tests");
  const waiverFact = data.facts.find((fact) => fact.id === "reviewed-mit_aeroastro_doctoral_admissions-elp-exceptions");
  const conflictFact = data.facts.find((fact) => fact.id === "aeroastro-source-elp-conflict");
  expect(testsFact).toBeTruthy();
  expect(JSON.stringify(testsFact.value)).toContain("under 2 years old by deadline");
  expect(JSON.stringify(testsFact.value)).toContain("not_accepted");
  expect(JSON.stringify(waiverFact.value)).toContain("English was primary/secondary instruction from ages 6–18");
  expect(conflictFact.publication_status).toBe("conflicting");
  expect(JSON.stringify(conflictFact.value)).toContain("do not silently choose one source");

  const tests = await openFact(page, "admission", testsFact.id);
  await expect(tests).toContainText("under 2 years old by deadline");
  await expect(tests).toContainText("GRE");
  const waiver = await openFact(page, "admission", waiverFact.id);
  await expect(waiver).toContainText("automatic exemptions");
  await expect(waiver).toContainText("ages 6–18");
  const conflict = await openFact(page, "admission", conflictFact.id);
  await expect(conflict).toContainText("Cambridge 190");
  await expect(conflict).toContainText(/Confirm accepted exam\/scale/i);
  await expect(page.locator("#admissionsCycle")).toHaveValue("");
  await expect(await openAssessment(page)).not.toContainText(/\d+(?:\.\d+)?\s*%/);
});

test("MIT Sloan MBA keeps its published GMAT/GRE rule unassessed without an invented score", async ({ page }) => {
  const context = {
    option: MBA_OPTION,
    route: MBA_ROUTE,
    level: "masters",
    applicant: "graduate",
    cycle: "2027 entry",
  };
  const { data } = await openContext(page, context);
  expect(data.selected_option.id).toBe(MBA_OPTION);
  expect(data.selected_route.id).toBe(MBA_ROUTE);
  expect(data.assessment.chancePercent).toBeNull();

  const examFact = data.facts.find((fact) => fact.id === MBA_EXAMS_FACT);
  expect(examFact).toBeTruthy();
  expect(JSON.stringify(examFact.value)).toContain("GMAT_FOCUS");
  expect(JSON.stringify(examFact.value)).toContain("GRE");
  const check = data.assessment.activeChoice.details.checks.find((row) => row.factId === MBA_EXAMS_FACT);
  expect(check).toMatchObject({ kind: "published_rule", status: "unassessed" });
  expect(data.assessment.missingEvidenceItems).toEqual([]);
  expect(data.facts.some((fact) => fact.id.startsWith("mit-first-year-funding"))).toBe(false);

  const fact = await openFact(page, "admission", MBA_EXAMS_FACT);
  await expect(fact).toContainText("GMAT (Focus Edition");
  await expect(fact).toContainText("GRE");
  const assessment = await openAssessment(page);
  await expect(assessment).toContainText("No requirements-match percentage is available");
  await expect(assessment).not.toContainText(/\d+(?:\.\d+)?\s*%/);
  await expect(page.locator("#admissionsCycle")).toHaveValue("2027 entry");
});

test("saved GRE evidence persists while Sloan's unassessed rule and cleared cycle stay explicit", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await markTourAsSeen(page);
  await page.addInitScript(() => {
    localStorage.setItem("unisearch_ui_language_v1", "rus");
    localStorage.setItem("unisearch_theme", "dark");
    if (!sessionStorage.getItem("mit-mba-profile-seeded")) {
      localStorage.setItem("unisearch_profile", JSON.stringify({ studyLevel: "Master", applicantRoute: "graduate" }));
      sessionStorage.setItem("mit-mba-profile-seeded", "1");
    }
  });

  await page.goto("/profile.html");
  await expect(page.locator("body")).toHaveAttribute("data-page", "profile");
  await page.waitForFunction(() => !!window.__unisearchProfileDraft);
  await openProfileTab(page, "scores");
  await page.waitForFunction(() => document.getElementById("examNameSelect")?.options.length > 1);
  await setNativeSelect(page, "examNameSelect", "GRE");
  for (const [component, score] of [
    ["GRE_VERBAL", "160"],
    ["GRE_QUANTITATIVE", "168"],
    ["GRE_ANALYTICAL_WRITING", "4.5"],
  ]) {
    await page.locator(`[data-breakdown-fixed-row='${component}'] [data-breakdown-value='number']`).fill(score);
  }
  const validationPromise = page.waitForResponse((response) => response.url().includes("/exams/validate")
    && response.request().method() === "POST");
  await page.locator(selectors.addExamBtn).click();
  expect((await validationPromise).ok()).toBeTruthy();
  await expect(page.locator(selectors.examList)).toContainText("160");
  await expect(page.locator(selectors.examList)).toContainText("168");
  await expect(page.locator(selectors.examList)).toContainText("4.5");
  await page.locator(selectors.saveProfileBtn).click();
  await expect(page.locator(selectors.saveProfileBtn)).toBeDisabled();
  await page.reload();
  await page.waitForFunction(() => !!window.__unisearchProfileDraft);
  await openProfileTab(page, "scores");
  await expect(page.locator(selectors.examList)).toContainText("160");
  await expect(page.locator(selectors.examList)).toContainText("168");
  await expect(page.locator(selectors.examList)).toContainText("4.5");

  const context = {
    option: MBA_OPTION,
    route: MBA_ROUTE,
    level: "masters",
    applicant: "graduate",
    cycle: "2027 entry",
  };
  const { data, response } = await openContext(page, context, { language: "rus", theme: "dark" });
  const requestExams = response.request().postDataJSON().profile.exams;
  expect(JSON.stringify(requestExams)).toContain("GRE");
  expect(JSON.stringify(requestExams)).toContain("168");
  expectNoPercentage(data);
  const examFact = await openFact(page, "admission", MBA_EXAMS_FACT);
  await expect(examFact).toContainText("GMAT (Focus Edition");
  await expect(examFact).toContainText("GRE");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  const cycle = page.locator("#admissionsCycle");
  await openAdvanced(page);
  await expect(cycle).toHaveValue("2027 entry");
  await cycle.fill("");
  const clearedResponsePromise = page.waitForResponse((candidate) =>
    candidate.url().includes(`/universities/${MIT_ID}/admissions-context`)
    && candidate.request().method() === "POST"
    && candidate.request().postDataJSON().context?.intended_entry_cycle === "");
  await page.locator("#admissionsContextApply").click();
  const clearedResponse = await clearedResponsePromise;
  expect(clearedResponse.ok()).toBeTruthy();
  const cleared = await clearedResponse.json();
  expect(cleared.context.intended_entry_cycle).toBeNull();
  expect(cleared.assessment.chancePercent).toBeNull();
  await expect(page.locator("#admissionsContext")).toHaveAttribute("data-state", "ready");
  await expect(cycle).toHaveValue("");
  await expect(await openAssessment(page)).not.toContainText(/\d+(?:\.\d+)?\s*%/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
