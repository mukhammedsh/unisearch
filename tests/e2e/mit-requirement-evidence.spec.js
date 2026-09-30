const { test, expect } = require("@playwright/test");
const { markTourAsSeen, seedProfile } = require("./helpers/personas");
const { openProfileTab, selectors, setNativeSelect } = require("./helpers/selectors");

const MBA_CATEGORY = "mit_sloan_mba_admissions";
const MBA_PROGRAM = "mit-sloan-mba-full-time";

function isUniChanceResponse(response) {
  return response.url().includes(`/universities/mit-usa-cambridge/uni-chance`)
    && response.request().method() === "POST";
}

function mbaChoice(data) {
  return data.choices.find((choice) => choice.categoryId === MBA_CATEGORY);
}

async function openMbaAdmissions(page, language, theme, profile) {
  await page.setViewportSize({ width: language === "eng" ? 1280 : 390, height: 900 });
  await markTourAsSeen(page);
  await seedProfile(page, profile);
  await page.addInitScript(({ language: selectedLanguage, theme: selectedTheme }) => {
    localStorage.setItem("unisearch_ui_language_v1", selectedLanguage);
    localStorage.setItem("unisearch_theme", selectedTheme);
  }, { language, theme });

  const chanceResponsePromise = page.waitForResponse(isUniChanceResponse);
  await page.goto(`/university.html?id=mit-usa-cambridge&admission_program=${MBA_PROGRAM}&admission_route=graduate&admission_cycle=2027%20entry`);
  await expect(page.locator("#detailCard")).toBeVisible();
  await expect(page.locator("#detailName")).not.toBeEmpty();
  await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
  await page.locator(".d-tab-btn[data-tab='tab-admission']").click();
  await expect(page.locator("#tab-admission [data-admission-category='mit_sloan_mba_admissions']")).toBeVisible();

  const response = await chanceResponsePromise;
  expect(response.ok()).toBeTruthy();
  return response.json();
}

function expectNoNumericFit(route) {
  return expect(route.locator(".chance-track-chip").first()).not.toContainText(/\d+\s*%/);
}

test("MIT doctoral English evidence keeps its exemption, test age, and unknown cycle visible", async ({ page }) => {
  await markTourAsSeen(page);
  await seedProfile(page, {
    studyLevel: "Doctorate", applicantRoute: "graduate", intendedEntryCycle: "2027 entry",
    languages: [{ code: "en", kind: "exam", exam: "IELTS", score: 7.5 }],
  });
  await page.addInitScript(() => localStorage.setItem("unisearch_ui_language_v1", "eng"));
  const responsePromise = page.waitForResponse(isUniChanceResponse);
  await page.goto("/university.html?id=mit-usa-cambridge&admission_program=mit-aeroastro-phd&admission_route=graduate&admission_cycle=2027%20entry");
  await expect(page.locator("#detailName")).not.toBeEmpty();
  await page.locator(".d-tab-btn[data-tab='tab-admission']").click();
  const route = page.locator("#tab-admission [data-admission-category='mit_aeroastro_doctoral_admissions']");
  await expect(route).toBeVisible();
  const response = await responsePromise;
  expect(response.ok()).toBeTruthy();
  const choice = (await response.json()).choices.find((row) => row.categoryId === "mit_aeroastro_doctoral_admissions");
  expect(choice.applicability).toEqual({ route: "matched", cycle: "unknown", program: "matched" });
  expect(choice.chancePercent).toBeNull();
  expect(choice.details.checks.find((row) => row.examId === "IELTS")).toMatchObject({ minimum: 7, provided: 7.5, status: "unassessed" });
  const checks = route.locator(".admission-check-assessments");
  await expect(checks).toContainText("7.5");
  await expect(checks).toContainText("automatic exemption");
  await expect(checks).toContainText("under 2 years old");
  await expect(checks).toContainText("Cannot assess");
  await expect(route).toContainText("GRE is not accepted");
  await expectNoNumericFit(route);
});

test("MIT Sloan MBA shows missing exam evidence in the selected 2027 graduate context", async ({ page }) => {
  const data = await openMbaAdmissions(page, "eng", "light", {
    studyLevel: "Master",
    applicantRoute: "graduate",
  });
  const choice = mbaChoice(data);
  expect(choice).toBeTruthy();
  expect(choice.applicability).toEqual({ route: "matched", cycle: "matched", program: "matched" });
  expect(choice.reason).toBe("missing_evidence");
  expect(choice.chancePercent).toBeNull();
  expect(choice.details.checks).toEqual([
    { exam: "GMAT_FOCUS or GMAT or GRE", minimum: null, provided: null, status: "missing" },
  ]);
  expect(choice.missingEvidence).toEqual([
    { type: "required_exam_alternative", ids: ["GMAT_FOCUS", "GMAT", "GRE"] },
  ]);

  const route = page.locator(`#tab-admission [data-admission-category='${MBA_CATEGORY}']`);
  const checks = route.locator(".admission-check-assessments");
  await expect(checks).toBeVisible();
  await expect(checks.locator(".admission-check-assessments__row")).toContainText("GMAT (Focus Edition");
  await expect(checks.locator(".admission-check-assessments__row")).toContainText("GRE General Test");
  await expect(checks.locator(".admission-check-assessments__row")).toContainText("Required exam evidence");
  await expect(checks.locator(".admission-check-assessments__row")).toContainText("Not provided");
  await expect(checks.locator(".admission-check-assessments__row")).toContainText("Add evidence");
  await expect(checks).not.toContainText(/Minimum\s*:\s*(No data|—|-)/i);
  await expectNoNumericFit(route);

  const categories = page.locator("#tab-admission .admission-category-card");
  await expect(categories).toHaveCount(1);
  await expect(categories.first()).toHaveAttribute("data-admission-category", MBA_CATEGORY);
  await expect(route).not.toContainText(/first-year|undergraduate scholarship|doctoral funding|PhD stipend/i);
  await expect(route.locator(".admission-funding-option")).toHaveCount(2);
  expect((await route.locator(".admission-funding-option").allTextContents()).join(" ")).not.toMatch(/MIT Need-Based Scholarship|PhD/i);
  await expect(page.locator("#tab-admission [data-admission-context='route']")).toHaveValue("graduate");
  await expect(page.locator("#tab-admission [data-admission-context='cycle']")).toHaveValue("2027 entry");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1280);
  await page.screenshot({ path: ".tmp_test/evidence/mit-mba-evidence-en-desktop-light.png", fullPage: true });
});

test("saved section-only GRE is visible for Sloan MBA and clearing the cycle leaves it unknown", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await markTourAsSeen(page);
  await page.addInitScript(() => {
    if (!localStorage.getItem("unisearch_profile")) {
      localStorage.setItem("unisearch_profile", JSON.stringify({ studyLevel: "Master", applicantRoute: "graduate" }));
    }
  });
  await page.addInitScript(() => {
    localStorage.setItem("unisearch_ui_language_v1", "rus");
    localStorage.setItem("unisearch_theme", "dark");
  });

  await page.goto("/profile.html");
  await expect(page.locator("#detailContent, main").first()).toBeVisible();
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

  const chanceResponsePromise = page.waitForResponse(isUniChanceResponse);
  await page.goto(`/university.html?id=mit-usa-cambridge&admission_program=${MBA_PROGRAM}&admission_route=graduate&admission_cycle=2027%20entry`);
  await expect(page.locator("#detailCard")).toBeVisible();
  await expect(page.locator("#detailName")).not.toBeEmpty();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.locator(".d-tab-btn[data-tab='tab-admission']").click();
  const route = page.locator(`#tab-admission [data-admission-category='${MBA_CATEGORY}']`);
  await expect(route).toBeVisible();

  const initialResponse = await chanceResponsePromise;
  expect(initialResponse.ok()).toBeTruthy();
  const initialData = await initialResponse.json();
  const initialChoice = mbaChoice(initialData);
  expect(initialChoice).toBeTruthy();
  expect(initialChoice.applicability).toEqual({ route: "matched", cycle: "matched", program: "matched" });
  expect(initialChoice.reason).toBe("no_published_requirements");
  expect(initialChoice.chancePercent).toBeNull();
  expect(initialChoice.details.checks).toEqual([
    { exam: "GMAT_FOCUS or GMAT or GRE", minimum: null, provided: "GRE", status: "met" },
  ]);
  expect(initialChoice.missingEvidence).toEqual([]);

  const checks = route.locator(".admission-check-assessments");
  await expect(checks).toBeVisible();
  await expect(checks.locator(".admission-check-assessments__row")).toContainText("GRE General Test");
  await expect(checks.locator(".admission-check-assessments__row")).toContainText("Подтверждение указано");
  await expect(checks).not.toContainText(/Минимум\s*:\s*(Нет данных|—|-)/i);
  await expectNoNumericFit(route);
  const categories = page.locator("#tab-admission .admission-category-card");
  await expect(categories).toHaveCount(1);
  await expect(categories.first()).toHaveAttribute("data-admission-category", MBA_CATEGORY);
  await expect(route.locator(".admission-funding-option")).toHaveCount(2);
  expect((await route.locator(".admission-funding-option").allTextContents()).join(" ")).not.toMatch(/Стипендия MIT для студентов бакалавриата|докторант|PhD/i);
  await page.screenshot({ path: ".tmp_test/evidence/mit-mba-evidence-ru-mobile-dark.png", fullPage: true });

  const cycle = page.locator("#tab-admission [data-admission-context='cycle']");
  await expect(cycle).toHaveValue("2027 entry");
  const changedCycleResponsePromise = page.waitForResponse(isUniChanceResponse);
  await cycle.selectOption("");
  await expect(cycle).toHaveValue("");
  await expect(cycle.locator("option:checked")).toHaveText("Неизвестно");
  const changedCycleResponse = await changedCycleResponsePromise;
  expect(changedCycleResponse.ok()).toBeTruthy();
  const postedProfile = changedCycleResponse.request().postDataJSON().profile;
  expect(postedProfile.intended_entry_cycle || postedProfile.intendedEntryCycle || "").toBe("");
  const changedCycleData = await changedCycleResponse.json();
  const changedCycleChoice = mbaChoice(changedCycleData);
  expect(changedCycleChoice.applicability.cycle).toBe("not_selected");
  expect(changedCycleChoice.chancePercent).toBeNull();
  await expectNoNumericFit(page.locator(`#tab-admission [data-admission-category='${MBA_CATEGORY}']`));
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
