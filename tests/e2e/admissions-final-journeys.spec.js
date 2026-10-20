const { test, expect } = require("./helpers/coverage-test.cjs");
const { setNativeSelect, openDisclosureParents } = require("./helpers/selectors");

const MIT = "mit-usa-cambridge";
const STANFORD = "stanford-university-usa-ca";

async function preparePage(page, { mobile = false, profile = null } = {}) {
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 });
  await page.addInitScript(({ savedProfile }) => {
    localStorage.setItem("unisearch_ui_language_v1", "eng");
    localStorage.setItem("unisearch_theme", "light");
    localStorage.setItem("unisearch_universities_tour_seen_v1", "1");
    if (sessionStorage.getItem("admissions_final_journeys_seeded_v1") === "1") return;
    sessionStorage.setItem("admissions_final_journeys_seeded_v1", "1");
    if (savedProfile) localStorage.setItem("unisearch_profile", JSON.stringify(savedProfile));
    else localStorage.removeItem("unisearch_profile");
  }, { savedProfile: profile });
}

async function openAdmission(page) {
  const viewRequirements = page.locator("#admissionsViewRequirements");
  if (await viewRequirements.isVisible()) await viewRequirements.click();
  else if (!(await page.locator("#tab-admission").evaluate((node) => node.classList.contains("active")))) await page.locator('.d-tab-btn[data-tab="tab-admission"]').click();
  await expect(page.locator("#tab-admission")).toHaveClass(/active/);
  await expect(page.locator("#admissionsContext")).toHaveAttribute("data-state", "ready");
}

async function selectRoute(page, route) {
  await openAdmission(page);
  const wrapper = page.locator("#admissionsRoute").locator("xpath=..");
  await wrapper.locator(".custom-select-trigger").click();
  await wrapper.locator(`.custom-option[data-value="${route}"]`).click();
  await expect(page.locator("#admissionsRoute")).toHaveValue(route);
}

async function chooseOption(page, optionId, search, level) {
  await page.locator('.d-tab-btn[data-tab="tab-programs"]').click();
  await expect(page.locator("#tab-programs")).toHaveClass(/active/);
  await setNativeSelect(page, "admissionsStudyLevel", level);
  await page.locator("#admissionsSearch").fill(search);
  await page.locator("#admissionsSearchSubmit").click();
  const option = page.locator(`#admissionsProgramList [data-study-option="${optionId}"]`);
  await expect(option).toBeVisible();
  const title = await option.locator(".admissions-programs__option-title").innerText();
  await option.click();
  await expect(page.locator("#tab-programs")).toHaveClass(/active/);
  await expect(page.locator("#admissionsStudyDetails")).toBeVisible();
  await expect(page.locator("#admissionsStudyDetails > .admissions-context__heading > h3")).toHaveText(title);
  await expect(page.locator("#admissionsViewRequirements")).toBeEnabled();
  await expect(page.locator("#admissionsRoute")).toHaveValue("");
}

async function applyContext(page, route, applicant, cycle) {
  await selectRoute(page, route);
  const advanced = page.locator("#admissionsAdvanced");
  if (await advanced.count() && !(await advanced.evaluate((node) => node.open))) await advanced.locator(":scope > summary").click();
  await setNativeSelect(page, "admissionsApplicant", applicant);
  await page.locator("#admissionsCycle").fill(cycle);
  await setNativeSelect(page, "admissionsFee", "unknown");
  const response = page.waitForResponse((item) => item.url().includes("/admissions-context") && item.request().method() === "POST");
  await page.locator("#admissionsContextApply").click();
  const result = await response;
  expect(result.status()).toBe(200);
  await expect(page.locator("#admissionsContext")).toHaveAttribute("data-state", "ready");
  return result.json();
}

async function openFact(page, tab, id) {
  await page.locator(`.d-tab-btn[data-tab="tab-${tab}"]`).click();
  await expect(page.locator(`#tab-${tab}`)).toHaveClass(/active/);
  const fact = page.locator(`#tab-${tab} [data-admissions-fact="${id}"]`).first();
  await openDisclosureParents(fact);
  const group = fact.locator("xpath=ancestor::details[@data-admissions-group][1]");
  if (await group.count() && !(await group.evaluate((node) => node.open))) await group.locator(":scope > summary").click();
  await expect(fact).toBeVisible();
  const isDetails = await fact.evaluate((node) => node.tagName === "DETAILS");
  if (isDetails && !(await fact.evaluate((node) => node.open))) await fact.locator(":scope > summary").click();
  const evidence = fact.locator("details.admissions-catalog__evidence");
  if (await evidence.count() && !(await evidence.evaluate((node) => node.open))) await evidence.locator(":scope > summary").click();
  const unknowns = fact.locator("details.admissions-catalog__unknowns");
  if (await unknowns.count() && !(await unknowns.evaluate((node) => node.open))) await unknowns.locator(":scope > summary").click();
  return fact;
}

async function openAssessment(page) {
  const details = page.locator("#detailRequirements details.admissions-catalog__assessment-detail");
  if (await details.count() && !(await details.evaluate((node) => node.open))) await details.locator(":scope > summary").click();
  return page.locator("#detailRequirements .admissions-catalog__assessment");
}

test("Kazakhstan secondary-school guest and applicant can distinguish university-wide MIT and Stanford first-year and transfer routes", async ({ page }, testInfo) => {
  const kazakhstanApplicant = {
    languageEvidence: [{ kind: "education", language: "en", country: "Kazakhstan", qualification_level: "secondary", status: "completed", entirely_in_language: false }],
    citizenships: ["KZ"],
  };
  await preparePage(page);

  const journeys = [
    { university: MIT, option: "mit-course-6-3-bachelor", search: "Computer Science and Engineering", route: "mit-first-year", applicant: "first_year", cycle: "Fall 2027 entry", guest: true },
    { university: MIT, option: "mit-course-6-3-bachelor", search: "Computer Science and Engineering", route: "mit-transfer", applicant: "transfer", cycle: "Fall 2027 entry" },
    { university: STANFORD, option: "stanford-option-cs-bs", search: "Computer Science", route: "undergraduate-shared-evidence:stanford-first-year", applicant: "first_year", cycle: "2027 entry" },
    { university: STANFORD, option: "stanford-option-cs-bs", search: "Computer Science", route: "undergraduate-shared-evidence:stanford-transfer", applicant: "transfer", cycle: "2027 entry", guest: true },
  ];

  for (const journey of journeys) {
    const mobile = journey.university === STANFORD && journey.applicant === "transfer";
    const width = mobile ? 390 : 1280;
    await page.setViewportSize({ width, height: mobile ? 844 : 900 });
    await page.goto(`/university.html?id=${journey.university}`);
    await expect(page.locator("body")).toHaveAttribute("data-page", "university");
    await expect(page.locator("#detailCard")).toBeVisible();
    await expect(page.locator("#tab-general")).toHaveClass(/active/);
    await chooseOption(page, journey.option, journey.search, "undergraduate");
    const savedProfile = journey.guest ? {} : kazakhstanApplicant;
    await page.evaluate((profile) => {
      if (Object.keys(profile).length) localStorage.setItem("unisearch_profile", JSON.stringify(profile));
      else localStorage.removeItem("unisearch_profile");
    }, savedProfile);
    const result = await applyContext(page, journey.route, journey.applicant, journey.cycle);
    expect(result.selected_option.id).toBe(journey.option);
    expect(result.selected_route.id).toBe(journey.route);
    expect(result.selected_route.target).toMatch(/university|MIT undergraduate (?:transfer )?admission/i);

    const routeLabel = await page.locator("#admissionsRoute option:checked").innerText();
    expect(routeLabel).toBe(journey.applicant === "transfer" ? "Transfer from another university" : "First-year admission after school");
    await expect(page.locator("#admissionsReferenceSummary")).toContainText(journey.search);
    await expect(page.locator("#admissionsSaveChoice")).toBeEnabled();
    if (journey.university === MIT && journey.applicant === "first_year") {
      await page.locator("#admissionsContext").scrollIntoViewIfNeeded();
      await page.screenshot({ path: testInfo.outputPath("mit-first-year-context-viewport.png") });
    }
    if (mobile) {
      await page.locator("#admissionsContext").scrollIntoViewIfNeeded();
      await page.screenshot({ path: testInfo.outputPath("stanford-transfer-context-mobile.png") });
    }

    if (journey.university === STANFORD) {
      const universityWideFact = await openFact(page, "admission", "undergraduate-shared-evidence:stanford-ug-admission-is-university-wide");
      await expect(universityWideFact).toContainText(/not admitted to a major|not an admission target/i);
      await expect(universityWideFact.locator("a[href^='https://']").first()).toHaveAttribute("href", /^https:\/\//);
      const deadlineId = journey.applicant === "transfer"
        ? "undergraduate-shared-evidence:stanford-transfer-deadline"
        : "undergraduate-shared-evidence:stanford-firstyear-decision-rounds-deadlines";
      const deadline = await openFact(page, "deadlines", deadlineId);
      await expect(deadline.locator("a[href^='https://']").first()).toHaveAttribute("href", /^https:\/\//);
    } else if (journey.applicant === "transfer") {
      const deadlines = await openFact(page, "deadlines", "mit-transfer-deadlines");
      await expect(deadlines).toContainText(/2027.03.01|2026.10.15/);
      await expect(deadlines).toContainText(/U\.S\. citizen|permanent resident/i);
      await expect(deadlines.locator("a[href^='https://']").first()).toHaveAttribute("href", /^https:\/\//);
      if (journey.university === MIT) {
        await deadlines.scrollIntoViewIfNeeded();
        await page.screenshot({ path: testInfo.outputPath("mit-transfer-deadlines-viewport.png") });
      }
    } else {
      await openFact(page, "admission", "ug-sat-act-presence");
      await expect(page.locator("#detailRequirements")).toContainText(/Evidence missing|No requirements-match percentage/i);
    }

    if (journey.university === MIT && journey.applicant === "first_year") {
      const fact = page.locator('#tab-admission [data-admissions-fact="ug-sat-act-presence"]').first();
      await fact.scrollIntoViewIfNeeded();
      await page.screenshot({ path: testInfo.outputPath("mit-first-year-evidence-viewport.png") });
    }
    if (mobile) {
      const deadline = page.locator('#tab-deadlines [data-admissions-fact="undergraduate-shared-evidence:stanford-transfer-deadline"]').first();
      await deadline.scrollIntoViewIfNeeded();
      await page.screenshot({ path: testInfo.outputPath("stanford-transfer-deadline-mobile.png") });
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  }
});

test("typed Course 6-9 evidence changes the real BCS MEng assessment while its source rule and remaining conditions stay visible", async ({ page }) => {
  await preparePage(page);
  await page.goto("/profile.html");
  await expect(page.locator("body")).toHaveAttribute("data-page", "profile");
  const evidence = page.locator("#admissionEvidenceFields");
  await expect(evidence).toBeVisible();
  const evidenceDetails = evidence.locator("details.profile-admission-evidence");
  if (!(await evidenceDetails.evaluate((node) => node.open))) await evidenceDetails.locator(":scope > summary").click();

  async function addEvidence({ kind, metric, value, scale, status, majorUnits }) {
    await setNativeSelect(page, "institutionEvidenceUniversity", MIT);
    await setNativeSelect(page, "institutionEvidenceKind", kind);
    await setNativeSelect(page, "institutionEvidenceProgram", "mit-bs-6-9");
    if (kind === "enrollment") {
      await setNativeSelect(page, "institutionEvidenceEnrollmentStatus", status);
      await page.locator("#institutionEvidenceMajorUnits").fill(String(majorUnits));
    } else {
      await setNativeSelect(page, "institutionEvidenceMetric", metric);
      await page.locator("#institutionEvidenceValue").fill(String(value));
      await page.locator("#institutionEvidenceScale").fill(String(scale));
      await page.locator("#institutionEvidenceTerm").fill("Synthetic Fall 2026");
    }
    await page.locator("#addInstitutionEvidence").click();
  }

  await addEvidence({ kind: "enrollment", status: "enrolled", majorUnits: 102 });
  await addEvidence({ kind: "gpa", metric: "technical", value: 4.25, scale: 5 });
  await addEvidence({ kind: "gpa", metric: "overall", value: 4, scale: 5 });
  await expect(evidence.locator("#institutionalEvidenceList .profile-exam-item")).toHaveCount(3);
  await page.locator("#saveProfileBtn").click();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("unisearch_profile") || "{}").institutionalEvidence?.length)).toBe(3);

  await page.goto(`/university.html?id=${MIT}`);
  await expect(page.locator("#tab-general")).toHaveClass(/active/);
  await chooseOption(page, "mit-course-6-9p-meng", "Course 6-9P", "masters");
  await openAdmission(page);
  await expect(page.locator('#admissionsRoute option[value="mit_bcs_meng_admissions"]')).toContainText(/MIT Brain and Cognitive Sciences Course 6[\u2011-]9P internal MEng application/);
  const result = await applyContext(page, "mit_bcs_meng_admissions", "graduate", "");
  expect(result.assessment.chancePercent).toBe(100);
  const checks = Object.fromEntries(result.assessment.activeChoice.details.checks.filter((check) => check.checkId).map((check) => [check.checkId, check]));
  expect(["current-course-6-9", "technical-gpa", "overall-gpa", "major-subject-units"].map((id) => checks[id].status)).toEqual(["met", "met", "met", "met"]);
  expect(checks["technical-gpa"].rule.metric).toBe("technical");
  expect(checks["overall-gpa"].rule.metric).toBe("overall");
  expect(checks["overall-gpa"].sourceRule.id).toBe("bcs-meng-entry-conditions");
  const bcsContextUrl = page.url();
  const assessment = await openAssessment(page);
  await expect(assessment).toContainText("100%");
  const scopedAverages = assessment.locator(".admissions-catalog__list > .admissions-catalog__check").filter({ hasText: "Scoped academic average" });
  await expect(scopedAverages).toHaveCount(2);
  await expect(scopedAverages.nth(0).locator(":scope > summary")).toContainText(/Met/i);
  const overallCheck = scopedAverages.nth(1);
  await expect(overallCheck.locator(":scope > summary")).toContainText(/Met/i);
  await overallCheck.locator(":scope > summary").click();
  const unknowns = overallCheck.locator("details.admissions-catalog__unknowns");
  if (await unknowns.count() && !(await unknowns.evaluate((node) => node.open))) await unknowns.locator(":scope > summary").click();
  await expect(overallCheck).toContainText(/overall/i);
  await expect(overallCheck).toContainText(/Value\s*4(?:\.0)?Original scale\s*5/);
  await expect(overallCheck).toContainText("4");
  await expect(overallCheck).toContainText(/published/i);
  await expect(overallCheck.locator("a[href^='https://']").first()).toHaveAttribute("href", /^https:\/\//);
  await expect(page.locator("#detailRequirements")).toContainText(/supervisor|UROP/i);

  await page.goto("/profile.html");
  await expect(page.locator("#admissionEvidenceFields")).toBeVisible();
  const savedEvidenceDetails = page.locator("#admissionEvidenceFields details.profile-admission-evidence");
  if (!(await savedEvidenceDetails.evaluate((node) => node.open))) await savedEvidenceDetails.locator(":scope > summary").click();
  const savedEvidence = page.locator("#admissionEvidenceFields #institutionalEvidenceList .profile-exam-item");
  await expect(savedEvidence).toHaveCount(3);
  await savedEvidence.nth(2).locator("[data-remove-institutional-evidence]").click();
  await page.locator("#saveProfileBtn").click();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("unisearch_profile") || "{}").institutionalEvidence?.length)).toBe(2);

  await page.goto(bcsContextUrl);
  await expect(page.locator("#admissionsContext")).toHaveAttribute("data-state", "ready");
  const incompleteResponse = page.waitForResponse((item) => item.url().includes("/admissions-context") && item.request().method() === "POST");
  await page.reload();
  const updated = await (await incompleteResponse).json();
  expect(updated.assessment.chancePercent).toBeNull();
  const overallMissing = updated.assessment.activeChoice.details.checks.find((check) => check.checkId === "overall-gpa");
  expect(overallMissing.status).toBe("missing");
  expect(overallMissing.rule.metric).toBe("overall");
  expect(overallMissing.sourceRule.id).toBe("bcs-meng-entry-conditions");
  await page.locator('.d-tab-btn[data-tab="tab-admission"]').click();
  await expect(page.locator("#tab-admission")).toHaveClass(/active/);
  const updatedAssessment = await openAssessment(page);
  await expect(updatedAssessment).toContainText(/No requirements-match percentage is available/);
  const missingOverall = updatedAssessment.locator(".admissions-catalog__list > .admissions-catalog__check").filter({ hasText: "Scoped academic average" }).nth(1);
  await expect(missingOverall.locator(":scope > summary")).toContainText(/Evidence missing/i);
  await missingOverall.locator(":scope > summary").click();
  await expect(missingOverall).toContainText("Original published rule");
  await expect(missingOverall).toContainText(/overall/i);
  await expect(missingOverall).toContainText("4");
  await expect(missingOverall.locator("a[href^='https://']").first()).toHaveAttribute("href", /^https:\/\//);
});

test("MIT DEDP routes a credential-based professional master's choice to its own dates, cost period, funding conditions, and official application", async ({ page }, testInfo) => {
  await preparePage(page, { mobile: true });
  await page.goto(`/university.html?id=${MIT}`);
  await expect(page.locator("#detailCard")).toBeVisible();
  await expect(page.locator("#tab-general")).toHaveClass(/active/);
  await chooseOption(page, "mit-data-economics-and-design-of-policy-masc-mit-grad-data-economics-and-design-of-policy", "Data, Economics, and Design of Policy", "masters");
  await selectRoute(page, "mit_grad_dedp_admissions");
  const advanced = page.locator("#admissionsAdvanced");
  if (await advanced.count() && !(await advanced.evaluate((node) => node.open))) await advanced.locator(":scope > summary").click();
  await setNativeSelect(page, "admissionsApplicant", "graduate");
  await page.locator("#admissionsCycle").fill("Spring 2028");
  await setNativeSelect(page, "admissionsFee", "unknown");
  const response = page.waitForResponse((item) => item.url().includes("/admissions-context") && item.request().method() === "POST");
  await page.locator("#admissionsContextApply").click();
  const result = await (await response).json();
  expect(result.selected_route.id).toBe("mit_grad_dedp_admissions");
  expect(result.selected_route.target).toMatch(/Data, Economics, and Design of Policy/i);
  await expect(page.locator("#admissionsCycle")).toHaveValue("Spring 2028");
  await expect(page.locator("#admissionsContext")).toContainText("Data, Economics, and Design of Policy");
  await page.locator("#admissionsContext").scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("mit-dedp-context-mobile.png") });

  const credential = await openFact(page, "admission", "dedp-no-prior-degree-and-track-condition");
  await expect(credential).toContainText(/Complete DEDP MicroMasters/);
  await expect(credential).toContainText(/five courses|five-course/i);
  await expect(credential.locator("a[href^='https://']").first()).toHaveAttribute("href", /^https:\/\//);
  await credential.scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("mit-dedp-credential-mobile.png") });
  const application = await openFact(page, "admission", "mit_grad_dedp_admissions-description");
  await expect(application).toContainText(/Apply to Data, Economics, and Design of Policy/);
  await expect(application.locator("a[href^='https://']").first()).toHaveAttribute("href", /^https:\/\//);

  const cycle = await openFact(page, "deadlines", "dedp-spring-2028-cycle-and-documents");
  await expect(cycle).toContainText(/November 2026/);
  await expect(cycle).toContainText(/exact day not published/i);
  await expect(cycle.locator("a[href^='https://']").first()).toHaveAttribute("href", /^https:\/\//);

  const cost = await openFact(page, "finance", "dedp-2027-cost-and-funding");
  await expect(cost).toContainText(/2027/);
  await expect(cost).toContainText(/USD/);
  await expect(cost).toContainText(/not a Spring 2028 quote/i);
  const funding = await openFact(page, "finance", "dedp-fellowship-eligibility-and-consideration");
  await expect(funding).toContainText(/eligibility|need|funds/i);
  await expect(funding.locator("a[href^='https://']").first()).toHaveAttribute("href", /^https:\/\//);

  await openAdmission(page);
  await expect(page.locator('#admissionsContext a[href^="https://apply.mit.edu/"]')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
