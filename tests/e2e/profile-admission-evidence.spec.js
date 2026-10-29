const { test, expect } = require("./helpers/coverage-test.cjs");
const { openProfileTab, selectors, setNativeSelect } = require("./helpers/selectors");

const tourKey = "unisearch_universities_tour_seen_v1";

for (const language of ["eng", "rus"]) {
  for (const theme of ["light", "dark"]) {
    for (const viewport of [{ label: "desktop", width: 1280, height: 900 }, { label: "mobile", width: 390, height: 844 }]) {
      test(`admission evidence form fits ${viewport.label} ${language} ${theme}`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.addInitScript(({ key, preference }) => {
          localStorage.setItem(key, "1");
          localStorage.setItem("unisearch_theme", preference);
        }, { key: tourKey, preference: theme });
        await page.goto(`/profile.html?lang=${language}`);
        await expect(page.locator("body")).toHaveAttribute("data-page", "profile");
        await expect(page.locator(selectors.profileModal)).toBeVisible();
        const evidenceSummary = page.locator("#admissionEvidenceFields summary");
        await expect(evidenceSummary).toBeVisible();
        await evidenceSummary.click();
        await expect(page.locator("#languageEvidenceKind")).toBeVisible();
        await expect(page.locator("#institutionEvidenceUniversity")).toBeVisible();
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        const fits = await page.locator("#admissionEvidenceFields").evaluate((node) => node.scrollWidth <= node.clientWidth + 1);
        expect(fits).toBe(true);
      });
    }
  }
}

test("language evidence rejects invalid entries and supports deleting a saved record", async ({ page }) => {
  await page.addInitScript((key) => localStorage.setItem(key, "1"), tourKey);
  await page.goto("/profile.html?lang=eng");
  await expect(page.locator("body")).toHaveAttribute("data-page", "profile");
  await page.waitForFunction(() => !!window.__unisearchProfileDraft);
  await openProfileTab(page, "basics");

  const evidenceSummary = page.locator("#admissionEvidenceFields summary");
  if (!(await page.locator("#languageEvidenceLanguage").isVisible())) await evidenceSummary.click();
  const languageList = page.locator("#languageEvidenceList .profile-exam-item");

  await setNativeSelect(page, "languageEvidenceKind", "primary_language");
  await page.fill("#languageEvidenceLanguage", "English");
  await page.click("#addLanguageEvidence");
  await expect(page.locator(".toast.error")).toBeVisible();
  await expect(languageList).toHaveCount(0);
  await expect(page.locator(".toast.error")).toHaveCount(0, { timeout: 10000 });

  await setNativeSelect(page, "languageEvidenceKind", "education");
  await page.fill("#languageEvidenceLanguage", "en");
  await page.click("#addLanguageEvidence");
  await expect(page.locator(".toast.error")).toBeVisible();
  await expect(languageList).toHaveCount(0);
  await expect(page.locator(".toast.error")).toHaveCount(0, { timeout: 10000 });

  await setNativeSelect(page, "languageEvidenceQualification", "bachelor");
  await page.fill("#languageEvidenceStarted", "2025-09-01");
  await page.fill("#languageEvidenceCompleted", "2025-08-01");
  await page.click("#addLanguageEvidence");
  await expect(page.locator(".toast.error")).toBeVisible();
  await expect(languageList).toHaveCount(0);
  await expect(page.locator(".toast.error")).toHaveCount(0, { timeout: 10000 });

  await page.fill("#languageEvidenceCompleted", "2025-09-02");
  await setNativeSelect(page, "languageEvidenceStatus", "completed");
  await page.click("#addLanguageEvidence");
  await expect(languageList).toHaveCount(1);
  await expect(page.locator("#languageEvidenceList")).toContainText("EN");
  await page.locator("#languageEvidenceList [data-remove-language-evidence='0']").click();
  await expect(languageList).toHaveCount(0);
});

test("institutional evidence follows university support and keeps the selected program", async ({ page }) => {
  await page.addInitScript((key) => localStorage.setItem(key, "1"), tourKey);
  await page.goto("/profile.html?lang=eng");
  await expect(page.locator("body")).toHaveAttribute("data-page", "profile");
  await page.waitForFunction(() => !!window.__unisearchProfileDraft);
  await openProfileTab(page, "basics");

  const evidenceSummary = page.locator("#admissionEvidenceFields summary");
  if (!(await page.locator("#institutionEvidenceUniversity").isVisible())) await evidenceSummary.click();
  const unavailable = page.locator("#institutionEvidenceUnavailable");
  const institutionList = page.locator("#institutionalEvidenceList .profile-exam-item");

  await setNativeSelect(page, "institutionEvidenceUniversity", "imperial-college-london-uk");
  await setNativeSelect(page, "institutionEvidenceKind", "enrollment");
  await expect(unavailable).toBeVisible();
  await page.click("#addInstitutionEvidence");
  await expect(page.locator(".toast.error")).toBeVisible();
  await expect(institutionList).toHaveCount(0);
  await expect(page.locator(".toast.error")).toHaveCount(0, { timeout: 10000 });

  await setNativeSelect(page, "institutionEvidenceUniversity", "stanford-university-usa-ca");
  await setNativeSelect(page, "institutionEvidenceKind", "gpa");
  await setNativeSelect(page, "institutionEvidenceProgram", "stanford-option-cs-bs");
  await setNativeSelect(page, "institutionEvidenceMetric", "major");
  await page.fill("#institutionEvidenceValue", "3.7");
  await page.fill("#institutionEvidenceScale", "4");
  await page.fill("#institutionEvidenceTerm", "Spring 2026");
  await page.click("#addInstitutionEvidence");
  await expect(institutionList).toHaveCount(1);
  await expect(page.locator("#institutionalEvidenceList")).toContainText("3.7/4");
  await expect(page.locator("#institutionalEvidenceList")).toContainText("Stanford");
  await page.locator("#institutionalEvidenceList [data-remove-institutional-evidence='0']").click();
  await expect(institutionList).toHaveCount(0);
});

for (const scenario of [{ name: "desktop", language: "eng", theme: "light", width: 1280, height: 900 }, { name: "mobile", language: "rus", theme: "dark", width: 390, height: 844 }]) {
test(`dated exam attempts and evidence save independently on ${scenario.name} and reach the admissions API`, async ({ page }, testInfo) => {
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.setViewportSize({ width: scenario.width, height: scenario.height });
  await page.addInitScript(({ key, theme }) => {
    localStorage.setItem(key, "1");
    localStorage.setItem("unisearch_theme", theme);
  }, { key: tourKey, theme: scenario.theme });
  await page.goto(`/profile.html?lang=${scenario.language}`);
  await expect(page.locator("body")).toHaveAttribute("data-page", "profile");
  await page.waitForFunction(() => !!window.__unisearchProfileDraft);

  await openProfileTab(page, "scores");
  await page.waitForFunction(() => [...document.getElementById("examNameSelect").options].some((option) => option.value === "TMUA"));
  await setNativeSelect(page, "examNameSelect", "ACT");
  await page.fill("#examScoreInput", "34");
  await page.fill("#examTakenOnInput", "2025-03-15");
  await expect(page.locator("#examScoreInput")).toHaveValue("34");
  const firstExamResponse = page.waitForResponse((response) => response.url().includes("/exams/validate") && response.request().method() === "POST");
  await page.click(selectors.addExamBtn);
  expect((await firstExamResponse).status()).toBe(200);

  await setNativeSelect(page, "examNameSelect", "ACT");
  await page.fill("#examScoreInput", "35");
  await page.fill("#examTakenOnInput", "2025-11-20");
  const secondExamResponse = page.waitForResponse((response) => response.url().includes("/exams/validate") && response.request().method() === "POST");
  await page.click(selectors.addExamBtn);
  expect((await secondExamResponse).status()).toBe(200);
  await expect(page.locator("#examList .profile-exam-item")).toHaveCount(2);
  await expect(page.locator(selectors.examList)).toContainText(/2025[-\u2011]03[-\u2011]15/);
  await expect(page.locator(selectors.examList)).toContainText(/2025[-\u2011]11[-\u2011]20/);

  await setNativeSelect(page, "examNameSelect", "ACT");
  await page.fill("#examScoreInput", "36");
  const futureTestDate = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  await page.fill("#examTakenOnInput", futureTestDate);
  await page.click(selectors.addExamBtn);
  await expect(page.locator(".toast.error")).toHaveCount(1);
  await expect(page.locator("#examList .profile-exam-item")).toHaveCount(2);
  await expect(page.locator(".toast.error")).toHaveCount(0, { timeout: 10000 });
  await page.locator("#clearExamDraftBtn").click();
  await expect(page.locator("#examScoreInput")).toHaveValue("");
  await expect(page.locator("#examList .profile-exam-item")).toHaveCount(2);
  await page.locator('#examList button[data-idx="0"]').click();
  await expect(page.locator("#examList .profile-exam-item")).toHaveCount(1);
  await expect(page.locator(selectors.examList)).not.toContainText(/2025[-\u2011]03[-\u2011]15/);

  await openProfileTab(page, "languages");
  await page.waitForFunction(() => document.querySelectorAll("#langCode option").length > 1);
  await setNativeSelect(page, "langCode", "en");
  await setNativeSelect(page, "langKind", "exam");
  await setNativeSelect(page, "langExam", "IELTS");
  await expect(page.locator("#langExamTakenOnContainer")).toBeVisible();
  for (const [testDate, score] of [["2025-03-15", "6.5"], ["2025-11-20", "7.0"]]) {
    for (const component of ["IELTS_LISTENING", "IELTS_READING", "IELTS_WRITING", "IELTS_SPEAKING"]) {
      await page.locator(`[data-lang-breakdown-input="${component}"]`).fill(score);
    }
    await page.fill("#langExamTakenOn", testDate);
    await expect(page.locator('[data-lang-breakdown-input="IELTS_LISTENING"]')).toHaveValue(score);
    const languageResponse = page.waitForResponse((response) => response.url().includes("/languages/validate") && response.request().method() === "POST");
    await page.click("#langAddBtn");
    const response = await languageResponse;
    expect(response.status()).toBe(200);
    expect((await response.json()).language.taken_on).toBe(testDate);
    if (testDate === "2025-03-15") {
      await setNativeSelect(page, "langCode", "en");
      await setNativeSelect(page, "langKind", "exam");
      await setNativeSelect(page, "langExam", "IELTS");
    }
  }
  await expect(page.locator("#langList .lang-item")).toHaveCount(2);
  await page.locator('#langList button[data-idx="0"]').click();
  await expect(page.locator("#langList .lang-item")).toHaveCount(1);
  await expect(page.locator("#langList")).toContainText(/2025[-\u2011]11[-\u2011]20/);

  await openProfileTab(page, "basics");
  const evidenceSummary = page.locator("#admissionEvidenceFields summary");
  if (!(await page.locator("#languageEvidenceKind").isVisible())) await evidenceSummary.click();
  await setNativeSelect(page, "languageEvidenceKind", "education");
  await page.fill("#languageEvidenceLanguage", "en");
  await page.fill("#languageEvidenceCountry", "Canada");
  await setNativeSelect(page, "languageEvidenceQualification", "bachelor");
  await page.fill("#languageEvidenceStarted", "2021-09-01");
  await page.fill("#languageEvidenceCompleted", "2025-06-01");
  await setNativeSelect(page, "languageEvidenceStatus", "completed");
  await setNativeSelect(page, "languageEvidenceEntirely", "yes");
  await page.click("#addLanguageEvidence");
  await expect(page.locator("#languageEvidenceList .profile-exam-item")).toHaveCount(1);

  await setNativeSelect(page, "institutionEvidenceUniversity", "mit-usa-cambridge");
  await setNativeSelect(page, "institutionEvidenceKind", "gpa");
  await setNativeSelect(page, "institutionEvidenceProgram", "mit-bs-6-9");
  await setNativeSelect(page, "institutionEvidenceMetric", "technical");
  await page.fill("#institutionEvidenceValue", "4.25");
  await page.fill("#institutionEvidenceScale", "4");
  await page.click("#addInstitutionEvidence");
  await expect(page.locator(".toast.error")).toHaveCount(1);
  await expect(page.locator("#institutionalEvidenceList .profile-exam-item")).toHaveCount(0);
  await expect(page.locator(".toast.error")).toHaveCount(0, { timeout: 10000 });
  await page.fill("#institutionEvidenceScale", "5");
  await page.fill("#institutionEvidenceTerm", "Spring 2026");
  await page.click("#addInstitutionEvidence");
  await expect(page.locator("#institutionalEvidenceList .profile-exam-item")).toHaveCount(1);
  await setNativeSelect(page, "institutionEvidenceKind", "credential");
  await setNativeSelect(page, "institutionEvidenceCredential", "mitx-dedp-micromasters");
  await setNativeSelect(page, "institutionEvidenceCredentialStatus", "completed");
  await page.fill("#institutionEvidenceCredentialDate", "2025-06-01");
  await page.click("#addInstitutionEvidence");
  await expect(page.locator("#institutionalEvidenceList .profile-exam-item")).toHaveCount(2);
  await setNativeSelect(page, "institutionEvidenceCredential", "sc0x-course-credential");
  await page.fill("#institutionEvidenceCredentialScore", "86");
  await page.fill("#institutionEvidenceCredentialDate", "2025-06-01");
  await page.click("#addInstitutionEvidence");
  await expect(page.locator("#institutionalEvidenceList .profile-exam-item")).toHaveCount(3);
  await expect(page.locator("#institutionalEvidenceList")).toContainText("86%");
  await expect(page.locator("#institutionalEvidenceList")).not.toContainText("mit-bs-6-9");
  await expect(page.locator("#institutionalEvidenceList")).not.toContainText("mitx-dedp-micromasters");
  await setNativeSelect(page, "institutionEvidenceKind", "enrollment");
  await setNativeSelect(page, "institutionEvidenceProgram", "mit-bs-6-9");
  await setNativeSelect(page, "institutionEvidenceEnrollmentStatus", "enrolled");
  await page.fill("#institutionEvidenceUnits", "200");
  await page.fill("#institutionEvidenceMajorUnits", "102");
  await page.fill("#institutionEvidenceMajorSubjects", "9");
  await page.click("#addInstitutionEvidence");
  await expect(page.locator("#institutionalEvidenceList .profile-exam-item")).toHaveCount(4);

  await page.click(selectors.saveProfileBtn);
  await expect(page.locator(selectors.saveProfileBtn)).toBeDisabled();
  await page.reload();
  await page.waitForFunction(() => !!window.__unisearchProfileDraft);
  await openProfileTab(page, "scores");
  await expect(page.locator("#examList .profile-exam-item")).toHaveCount(1);
  await expect(page.locator(selectors.examList)).toContainText(/2025[-\u2011]11[-\u2011]20/);
  await openProfileTab(page, "basics");
  const reloadedEvidence = page.locator("#admissionEvidenceFields summary");
  if (!(await page.locator("#languageEvidenceKind").isVisible())) await reloadedEvidence.click();
  await expect(page.locator("#languageEvidenceList .profile-exam-item")).toHaveCount(1);
  await expect(page.locator("#institutionalEvidenceList .profile-exam-item")).toHaveCount(4);
  await openProfileTab(page, "languages");
  await expect(page.locator("#langList .lang-item")).toHaveCount(1);
  await expect(page.locator("#langList")).toContainText(/2025[-\u2011]11[-\u2011]20/);

  const apiResult = await page.evaluate(async () => {
    const { loadProfileForApi } = await import("/javascript/utils/persistence.js");
    const profile = loadProfileForApi();
    const requestBody = {
      profile,
      context: {
        study_option_id: "mit-course-6-9p-meng",
        application_route_id: "mit_bcs_meng_admissions",
        study_level: "masters",
        applicant_route: "graduate",
      },
    };
    const { API_BASE } = await import("/javascript/utils.js");
    const response = await fetch(`${API_BASE}/universities/mit-usa-cambridge/admissions-context`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });
    return { status: response.status, requestBody, responseBody: await response.json() };
  });
  expect(apiResult.status).toBe(200);
  expect(apiResult.requestBody.profile.exams).toContainEqual(expect.objectContaining({ exam: "ACT", taken_on: "2025-11-20" }));
  expect(apiResult.requestBody.profile.language_evidence).toContainEqual(expect.objectContaining({ language: "en", entirely_in_language: true }));
  expect(apiResult.requestBody.profile.institutional_evidence).toContainEqual(expect.objectContaining({ kind: "gpa", metric: "technical", value: 4.25, scale: 5 }));
  expect(apiResult.requestBody.profile.institutional_evidence).toContainEqual(expect.objectContaining({ kind: "credential", credential_id: "sc0x-course-credential", score_percent: 86 }));
  expect(apiResult.requestBody.profile.institutional_evidence).toContainEqual(expect.objectContaining({ kind: "enrollment", units: 200, major_units: 102, completed_major_subjects: 9 }));
  expect(apiResult.responseBody).toHaveProperty("assessment");
  await openProfileTab(page, "basics");
  if (!(await page.locator("#languageEvidenceKind").isVisible())) await page.locator("#admissionEvidenceFields summary").click();
  await setNativeSelect(page, "institutionEvidenceUniversity", "mit-usa-cambridge");
  await setNativeSelect(page, "institutionEvidenceKind", "enrollment");
  await setNativeSelect(page, "institutionEvidenceProgram", "mit-bs-6-9");
  await expect(page.locator("#institutionEvidenceMajorUnits")).toBeVisible();
  expect(await page.locator("#admissionEvidenceFields").evaluate((node) => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
  expect(pageErrors).toEqual([]);
  await page.locator("#admissionEvidenceFields").screenshot({ path: testInfo.outputPath("admission-evidence.png") });
});
}

test("new admission exams preserve decimals, modules, reported totals and current UCAT sections", async ({ page }) => {
  await page.addInitScript((key) => localStorage.setItem(key, "1"), tourKey);
  await page.goto("/profile.html?lang=eng");
  await expect(page.locator("body")).toHaveAttribute("data-page", "profile");
  await page.waitForFunction(() => !!window.__unisearchProfileDraft);
  await openProfileTab(page, "scores");
  await page.waitForFunction(() => document.getElementById("examNameSelect")?.options.length > 1);

  const submit = async () => {
    const response = page.waitForResponse((res) => res.url().includes("/exams/validate") && res.request().method() === "POST");
    await page.click(selectors.addExamBtn);
    const result = await response;
    expect(result.status()).toBe(200);
    return result.json();
  };
  await setNativeSelect(page, "examNameSelect", "TMUA");
  await page.fill("#examScoreInput", "6.4");
  expect((await submit()).score).toBe(6.4);

  await setNativeSelect(page, "examNameSelect", "ESAT");
  for (const [slot, exam] of [[0, "ESAT_MATH_1"], [1, "ESAT_MATH_2"], [2, "ESAT_PHYSICS"]]) {
    await page.locator(`[data-breakdown-subject-select='${slot}']`).selectOption(exam);
    await page.locator(`[data-breakdown-slot='selectable-${slot}'][data-breakdown-value='number']`).fill("6.4");
  }
  const esat = await submit();
  expect(esat.score).toBeUndefined();
  expect(esat.details.components).toHaveLength(3);

  await setNativeSelect(page, "examNameSelect", "GAMSAT");
  await page.fill("#examScoreInput", "61.5");
  expect((await submit()).score).toBe(61.5);

  await setNativeSelect(page, "examNameSelect", "UCAT");
  await page.locator("[data-breakdown-fixed-row='UCAT_VERBAL_REASONING'] [data-breakdown-value='number']").fill("299");
  await page.locator("[data-breakdown-fixed-row='UCAT_DECISION_MAKING'] [data-breakdown-value='number']").fill("901");
  await page.click(selectors.addExamBtn);
  await expect(page.locator(".toast.error")).toHaveCount(1);
  await expect(page.locator("#examList .profile-exam-item")).toHaveCount(3);
  for (const exam of ["UCAT_VERBAL_REASONING", "UCAT_DECISION_MAKING", "UCAT_QUANTITATIVE_REASONING"]) {
    await page.locator(`[data-breakdown-fixed-row='${exam}'] [data-breakdown-value='number']`).fill("650");
  }
  await page.fill("#examTakenOnInput", "2026-08-01");
  const ucat = await submit();
  expect(ucat.score).toBe(1950);
  expect(ucat.taken_on).toBe("2026-08-01");

  await setNativeSelect(page, "examNameSelect", "LSAT");
  await page.fill("#examScoreInput", "170");
  expect((await submit()).score).toBe(170);

  await setNativeSelect(page, "examNameSelect", "MCAT");
  for (const exam of ["MCAT_BIOLOGICAL_BIOCHEMICAL", "MCAT_CHEMICAL_PHYSICAL", "MCAT_PSYCHOLOGICAL_SOCIAL", "MCAT_CRITICAL_ANALYSIS"]) {
    await page.locator(`[data-breakdown-fixed-row='${exam}'] [data-breakdown-value='number']`).fill("125");
  }
  expect((await submit()).score).toBe(500);
  await expect(page.locator("#examList .profile-exam-item")).toHaveCount(6);
  await page.click(selectors.saveProfileBtn);
  await expect(page.locator(selectors.saveProfileBtn)).toBeDisabled();
  await page.reload();
  await page.waitForFunction(() => !!window.__unisearchProfileDraft);
  await openProfileTab(page, "scores");
  await expect(page.locator("#examList .profile-exam-item")).toHaveCount(6);
});
