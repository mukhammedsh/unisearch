const { test, expect } = require("./helpers/coverage-test.cjs");
const { openDisclosureParents, openAdmissionSelectionEditor, selectAdmissionRoute, setNativeSelect } = require("./helpers/selectors");

const NU = "nazarbayev-university-kaz-astana";
const FOUNDATION = "nu-a-study-nu-foundation-year-program";
const CS = "nu-a-study-bachelor-of-science-in-computer-science";
const REGULAR = "nu-a-route-regular-foundation-undergraduate";
const SUPPORT = "nu-a-route-financial-support";
const english = { code: "en", kind: "exam", exam: "IELTS", score: 6.5, taken_on: "2026-03-01", details: { components: [
  { exam: "IELTS_WRITING", score: 6.5 }, { exam: "IELTS_READING", score: 6.5 },
  { exam: "IELTS_LISTENING", score: 6.5 }, { exam: "IELTS_SPEAKING", score: 6.5 },
] } };

test("NU guest discovers Foundation, reads its own price and searches without an expanded stale program", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("unisearch_ui_language_v1", "eng"));
  await page.goto("/index.html");
  await expect(page.locator("body")).toHaveAttribute("data-page", "universities");
  await expect(page.locator(".uni-card").first()).toBeVisible();
  const skip = page.getByRole("button", { name: /Skip.*tour|Skip.*intro|Skip.*tutorial/i });
  await skip.click();
  await page.locator("#qInput").fill("Nazarbayev");
  await page.getByRole("link", { name: "Nazarbayev University", exact: true }).click();
  await expect(page.locator("#admissionsContext")).toHaveAttribute("data-state", "ready");
  await showTab(page, "programs");
  await page.locator("#admissionsSearch").fill("Foundation");
  await page.locator("#admissionsSearchSubmit").click();
  const foundation = page.locator(`[data-study-option='${FOUNDATION}']`).locator("xpath=..");
  await foundation.locator(`[data-study-option='${FOUNDATION}']`).click();
  await expect(foundation.locator("[data-study-overview]")).toContainText("one academic year");
  await foundation.locator("[data-study-sources] summary").first().click();
  await expect(foundation.locator('[data-program-overview-sources] a[href="https://cps.nu.edu.kz/foundation"]')).toBeVisible();
  await foundation.locator(`[data-select-study-option='${FOUNDATION}']`).click();
  await expect(page.locator("#admissionsContext")).toHaveAttribute("data-state", "ready");
  await showTab(page, "admission");
  await page.locator(`[data-read-route='${REGULAR}']`).click();
  await expect(page.locator("#admissionsContext")).toHaveAttribute("data-state", "ready");
  await expect(page.locator("#detailRequirements summary").filter({ hasText: "Language requirements" }).first()).toBeVisible();
  await showTab(page, "finance");
  const tuition = page.locator("#detailFinance [data-course-tuition]");
  await expect(tuition).toContainText("12,000");
  await expect(tuition).not.toContainText("15,000");
  await showTab(page, "programs");
  await page.locator("#admissionsSearch").fill("Nursing");
  await page.locator("#admissionsSearchSubmit").click();
  await expect(page.locator("#admissionsProgramList")).toContainText("Bachelor in Nursing");
  await expect(page.locator("#admissionsSelectedProgram [data-study-option]")).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("#admissionsStudyDetails")).toBeHidden();
  const nursing = page.locator("[data-study-option='nu-a-study-bachelor-in-nursing']").locator("xpath=..");
  await nursing.locator("[data-study-option]").click();
  await expect(nursing.locator("[data-study-overview]")).toContainText("Professional completion program");
  await nursing.locator("[data-study-sources] .admissions-programs__references > summary").click();
  await nursing.locator("[data-study-info] summary").first().click();
  await expect(nursing.locator("[data-study-info]")).toContainText("240");
});

for (const { theme, mobile } of [{ theme: "light", mobile: false }, { theme: "dark", mobile: true }]) test(`Russian Foundation overview and published NUET conditions are readable (${theme}, ${mobile ? "phone" : "desktop"})`, async ({ page }) => {
  await seed(page, {}, { language: "rus", theme, mobile });
  await openContext(page, FOUNDATION, REGULAR, "preparation");
  await expect(page.locator("#admissionsStudyOverview")).toContainText("Годичная очная подготовительная программа");
  await showTab(page, "admission");
  const fact = page.locator("#detailRequirements [data-admissions-fact='nu-a-fact-fyp-academic']").first();
  await reveal(fact);
  await expect(fact).toContainText("общий балл не ниже 120 из 240");
  await expect(fact).toContainText("не порог для приёма на бакалавриат");
});

for (const { theme, mobile } of [{ theme: "light", mobile: false }, { theme: "dark", mobile: true }]) test(`Russian NUZYP unknowns explain the missing current intake (${theme}, ${mobile ? "phone" : "desktop"})`, async ({ page }) => {
  await seed(page, {}, { language: "rus", theme, mobile });
  await page.goto(`/university.html?id=${NU}&admission_option=nu-a-study-nuzyp&admission_level=preparation`);
  await expect(page.locator("#admissionsContext")).toHaveAttribute("data-state", "ready");
  await page.locator("#admissionsStudySources .admissions-programs__references > summary").click();
  const unknowns = page.locator("#admissionsStudyInfo .admissions-catalog__unknowns");
  await unknowns.locator(":scope > summary").click();
  await expect(unknowns).toContainText("Текущий набор, требования, длительность, стоимость и финансирование эти источники не подтверждают");
  await expect(unknowns).toContainText("Найдите объявление о текущем наборе NUZYP");
  await expect(unknowns).toContainText("Уточнение области применения");
  await expect(unknowns).toContainText("Подготовительная программа NU Zero Year Program");
  await expect(unknowns.locator("a[href*='nuzyp_instructions']")).toBeVisible();
});

for (const { theme, mobile } of [{ theme: "light", mobile: false }, { theme: "dark", mobile: true }]) test(`Russian Nursing requirements retain the prior experience condition (${theme}, ${mobile ? "phone" : "desktop"})`, async ({ page }) => {
  await seed(page, {}, { language: "rus", theme, mobile });
  await openContext(page, "nu-a-study-bachelor-in-nursing", "nu-a-route-nursing", "undergraduate", { cycle: "", applicant: "first_year" });
  await showTab(page, "admission");
  const fact = page.locator("#detailRequirements [data-admissions-fact='nu-a-fact-nursing-entry']").first();
  await reveal(fact);
  await expect(fact).toContainText("не менее двух лет профессионального и/или волонтёрского опыта");
  await expect(fact).toContainText("за последние пять лет");
  await expect(fact).toContainText("Минимальный процент раздела клинических навыков");
  await expect(fact.locator("a[href='https://nusom.nu.edu.kz/bn']")).toBeVisible();
});

test("Russian joint BBA separates the historic scores from unconfirmed application dates", async ({ page }) => {
  await seed(page, {}, { language: "rus", theme: "light" });
  await openContext(page, "nu-a-study-bachelor-of-business-administration-in-eurasian-business-joint-degree-with-hkust", "nu-a-route-joint-bba", "undergraduate", { cycle: "", applicant: "first_year" });
  await showTab(page, "admission");
  const fact = page.locator("#detailRequirements [data-admissions-fact='nu-a-fact-joint-bba-admissions']").first();
  await reveal(fact);
  await expect(fact).toContainText("даты 2027/28 года будут объявлены");
  await expect(fact).toContainText("сведения 2025/26 года для поступления в 2026/27 году");
  await expect(fact).toContainText("AAB по трём предметам");
});

test("Russian conditional residency keeps first-year test requirements separate", async ({ page }) => {
  await seed(page, {}, { language: "rus", theme: "dark", mobile: true });
  await openContext(page, "nu-c-study-residency-in-neurology", "nu-residency-conditional-umc", "residency", { cycle: "", applicant: "graduate" });
  await showTab(page, "admission");
  const fact = page.locator("#detailRequirements [data-admissions-fact='nu-c-residency-conditional']").first();
  await reveal(fact);
  await expect(fact).toContainText("Тест по английскому, если не предоставлено освобождение");
  await expect(fact).toContainText("IFOM BSE или USMLE Step 1");
  await expect(fact).toContainText("Условия первого года");
});

test("Russian funding calendar keeps SAT and ACT test deadlines distinct", async ({ page }) => {
  await seed(page, {}, { language: "rus", theme: "dark", mobile: true });
  await openContext(page, CS, SUPPORT, "undergraduate");
  await showTab(page, "deadlines");
  await expect(page.locator("#detailDeadlines")).toContainText("Последняя дата сдачи SAT для отбора на финансирование");
  await expect(page.locator("#detailDeadlines")).toContainText("Последняя дата сдачи ACT для отбора на финансирование");
  await expect(page.locator("#detailDeadlines")).not.toContainText("Last SAT test date");
});

test("NUZYP exposes its source uncertainty without an invented application route or current award", async ({ page }) => {
  await seed(page);
  await page.goto(`/university.html?id=${NU}&admission_option=nu-a-study-nuzyp&admission_level=preparation`);
  await expect(page.locator("#admissionsContext")).toHaveAttribute("data-state", "ready");
  await expect(page.locator("#admissionsStudyOverview")).toContainText("published study details below");
  await expect(page.locator("#admissionsStudyOverview")).not.toContainText("has not been collected");
  await page.locator("#admissionsStudySources .admissions-programs__references > summary").click();
  await page.locator("#admissionsStudyInfo .admissions-catalog__unknowns > summary").click();
  await expect(page.locator("#admissionsStudyInfo")).toContainText("None establishes a current intake");
  await expect(page.locator("#admissionsStudyInfo .admissions-catalog__unknowns a[href*='nuzyp_instructions']")).toBeVisible();
  await showTab(page, "general");
  await page.locator("[data-admissions-fact='nu-a-fact-nuzyp-funding-history'] > summary").click();
  await expect(page.locator("[data-admissions-fact='nu-a-fact-nuzyp-funding-history']")).toContainText("Historical source record");
  await expect(page.locator("[data-admissions-fact='nu-a-fact-nuzyp-funding-history']")).toContainText("Do not display as current scholarship");
  await showTab(page, "admission");
  await expect(page.locator("#admissionsContext")).toContainText("does not mean that admission is closed");
});

test("NU program readers can discover the separate institution-wide mid-year path", async ({ page }) => {
  await seed(page);
  await openContext(page, CS, REGULAR, "undergraduate", { cycle: "" });
  await openAdmissionSelectionEditor(page);
  await expect(page.locator("[data-shared-admission]")).toContainText("clear the program selection");
  await page.locator("[data-shared-route='nu-a-route-midyear-2026-27']").click();
  await expect(page.locator("#admissionsContext")).toHaveAttribute("data-state", "ready");
  await expect(page.locator("#admissionsReferenceSummary")).toContainText("mid-year");
  expect(new URL(page.url()).searchParams.get("admission_option")).toBe("");
  await expect(page.locator("#admissionsStudyDetails")).toBeHidden();
  await expect(page.locator("#detailRequirements")).toContainText("130");
  await openAdmissionSelectionEditor(page);
  await page.locator("#admissionsAdvanced > summary").click();
  await page.locator("#admissionsCycle").fill("2027/28");
  await expect(page.locator("#admissionsCycleNotice")).toBeHidden();
  await page.locator("#admissionsContextApply").click();
  await expect(page.locator("#admissionsContext")).toHaveAttribute("data-state", "ready");
  await showTab(page, "deadlines");
  await expect(page.locator("#detailDeadlines")).not.toContainText(/2026[-‑]11[-‑]28/);
});

test("comparison language changes keep its stage and the two independent saved contexts", async ({ page }) => {
  const choices = {
    [NU]: { studyOptionId: "nu-b-study-master-of-science-in-finance", applicationRouteId: "nu-b-route-master-of-science-in-finance", studyLevel: "masters", intendedEntryCycle: "2027/28" },
    "mit-usa-cambridge": { studyOptionId: "mit-course-6-3-bachelor", applicationRouteId: "mit-first-year", studyLevel: "undergraduate" },
  };
  await seed(page, { selectedAdmissionChoices: choices }, { mobile: true });
  await page.goto(`/compare.html?ids=${NU},mit-usa-cambridge`);
  const comparison = page.locator("[data-reviewed-comparison]");
  await expect(comparison).toContainText("for the whole program");
  await expect(page.locator("#siteInitialLoader")).toBeHidden();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("unisearch_profile")).selectedAdmissionChoices);
  await setNativeSelect(page, "languageSelect", "rus");
  await expect(comparison).toContainText("за всю программу");
  await expect(comparison).toContainText("Опубликованная стоимость обучения");
  await setNativeSelect(page, "languageSelect", "kaz");
  await expect(comparison).toContainText("толық бағдарлама үшін");
  await expect(page.locator("[data-action='build-compare-results']")).toHaveCount(0);
  await page.locator("[data-action='back-to-tracks']").click();
  await expect(page.locator("[data-action='build-compare-results']")).toBeVisible();
  await setNativeSelect(page, "languageSelect", "eng");
  await expect(page.locator(`#compare-options-${NU} .compare-context-current__value`)).toHaveText("Master of Science in Finance · Master's · 2027/28");
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("unisearch_profile")).selectedAdmissionChoices)).toEqual(saved);
});

async function seed(page, profile = {}, { language = "eng", theme = "light", mobile = false } = {}) {
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 });
  await page.addInitScript(({ savedProfile, language, theme }) => {
    if (sessionStorage.getItem("nu-admissions-seeded")) return;
    sessionStorage.setItem("nu-admissions-seeded", "1");
    localStorage.setItem("unisearch_ui_language_v1", language);
    localStorage.setItem("unisearch_theme", theme);
    localStorage.setItem("unisearch_universities_tour_seen_v1", "1");
    localStorage.setItem("unisearch_profile", JSON.stringify({ _v: 2, ...savedProfile }));
  }, { savedProfile: profile, language, theme });
}

async function openContext(page, option, route, level, { cycle = "2027/28", applicant = "first_year" } = {}) {
  const params = new URLSearchParams({ id: NU, admission_option: option || "", admission_application_route: route,
    admission_level: level, admission_route: applicant, admission_cycle: cycle, admission_fee: "unknown" });
  const response = page.waitForResponse(item => item.url().includes(`/universities/${NU}/admissions-context`) && item.request().method() === "POST");
  await page.goto(`/university.html?${params}`);
  await expect(page.locator("body")).toHaveAttribute("data-page", "university");
  await expect(page.locator("#detailName")).toHaveText(/^(Nazarbayev University|Назарбаев [Уу]ниверситет(?:і)?)$/);
  await expect(page.locator("#admissionsContext")).toHaveAttribute("data-state", "ready");
  await expect(page.locator("#admissionsRoute")).toHaveValue(route);
  const evaluated = await response;
  expect(evaluated.status()).toBe(200);
  const result = await evaluated.json();
  if (option) expect(result.selected_option.id).toBe(option);
  else expect(result.selected_option).toBeNull();
  expect(result.selected_route.id).toBe(route);
  expect(result.context_applicability).toEqual(expect.objectContaining({ option: option ? "matched" : "not_required", route: "matched", level: "matched" }));
  return { result, request: evaluated.request().postDataJSON() };
}

async function showTab(page, name) {
  await page.locator(`.d-tab-btn[data-tab="tab-${name}"]`).click();
  await expect(page.locator(`#tab-${name}`)).toHaveClass(/active/);
}

async function reveal(locator) {
  await openDisclosureParents(locator);
  if (await locator.evaluate(node => node.tagName === "DETAILS" && !node.open)) await locator.locator(":scope > summary").click();
  await expect(locator).toBeVisible();
}

async function expectReadableCheck(locator) {
  const check = locator.locator("xpath=ancestor::details[contains(@class,'admissions-catalog__check')][1]");
  const bounds = await check.evaluate(element => {
    const summary = element.querySelector(":scope > summary");
    const title = summary.firstElementChild;
    const body = element.querySelector(":scope > .admissions-catalog__body");
    return { titleWidth: title.getBoundingClientRect().width, titleHeight: title.getBoundingClientRect().height,
      lineHeight: parseFloat(getComputedStyle(title).lineHeight), summaryBottom: summary.getBoundingClientRect().bottom, bodyTop: body.getBoundingClientRect().top };
  });
  expect(bounds.titleWidth).toBeGreaterThanOrEqual(160);
  expect(bounds.titleHeight).toBeLessThanOrEqual(bounds.lineHeight * 3);
  expect(bounds.bodyTop).toBeGreaterThanOrEqual(bounds.summaryBottom);
}

test("NU Foundation exposes a failed NUET section while regular UG does not borrow that route", async ({ page }, testInfo) => {
  await seed(page, { languages: [english], exams: [{ id: "NUET", exam: "NUET", score: 120, details: { components: [
    { exam: "NUET_MATH", score: 40 }, { exam: "NUET_CRITICAL_THINKING", score: 80 },
  ] } }] });
  const foundation = await openContext(page, FOUNDATION, REGULAR, "preparation");
  expect(foundation.request.profile.gpa).toBeUndefined();
  expect(foundation.result.selected_option.awards).toEqual([]);
  const failed = page.locator("#detailRequirements [data-minimum-exam='NUET_MATH'][data-minimum-status='unmet']");
  await reveal(failed);
  await expectReadableCheck(failed);
  await expect(failed).toContainText("50");
  await expect(failed).toContainText("40");
  await page.screenshot({ path: testInfo.outputPath("nu-foundation-section-failure.png") });

  const undergraduate = await openContext(page, CS, REGULAR, "undergraduate");
  expect(undergraduate.result.facts.some(row => row.id === "nu-a-fact-fyp-academic")).toBe(false);
  await expect(page.locator("#detailRequirements [data-minimum-exam='NUET_MATH']")).toHaveCount(0);
  expect(undergraduate.result.assessment.chancePercent).toBeNull();
});

test("NU total-only reports keep missing sections unassessed on a Russian phone", async ({ page }, testInfo) => {
  await seed(page, { languages: [english], exams: [{ id: "NUET", exam: "NUET", score: 120 }] }, { language: "rus", theme: "dark", mobile: true });
  const { result } = await openContext(page, FOUNDATION, REGULAR, "preparation");
  await expect(page.locator("#admissionsReferenceSummary")).toContainText("Обычное поступление");
  expect(result.assessment.chancePercent).toBeNull();
  const missing = page.locator("#detailRequirements [data-minimum-exam='NUET_MATH'][data-minimum-status='missing']");
  await reveal(missing);
  await expectReadableCheck(missing);
  await expect(missing).toContainText("Не указано");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
  await missing.locator("xpath=ancestor::details[contains(@class,'admissions-catalog__check')][1]").locator(":scope > summary").scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("nu-missing-section-phone.png") });
});

test("NU regular UG uses a valid SAT alternative without converting missing GPA into a failure", async ({ page }) => {
  await seed(page, { languages: [english], exams: [{ id: "SAT", exam: "SAT", score: 1240, taken_on: "2026-03-01" }] });
  const { result, request } = await openContext(page, CS, REGULAR, "undergraduate");
  expect(request.profile.gpa).toBeUndefined();
  const academic = result.assessment.activeChoice.details.checks.find(row => row.kind === "academic_requirement");
  expect(academic.status).toBe("met");
  const sat = page.locator("#detailRequirements [data-minimum-exam='SAT'][data-minimum-status='met']");
  await reveal(sat);
  await expect(sat).toContainText("1240");
});

test("NU support context has no admission percentage and retains separate SAT and ACT test dates", async ({ page }, testInfo) => {
  await seed(page, { languages: [english], exams: [{ id: "SAT", exam: "SAT", score: 1300, taken_on: "2026-03-01" }] });
  const { result } = await openContext(page, CS, SUPPORT, "undergraduate");
  expect(result.assessment.reason).toBe("funding_selection_separate");
  expect(result.assessment.chancePercent).toBeNull();
  await expect(page.locator("#detailRequirements")).toContainText("Funding selection is separate from admission");
  await showTab(page, "deadlines");
  await expect(page.locator("#detailDeadlines")).toContainText("Last SAT test date for funding consideration");
  await expect(page.locator("#detailDeadlines")).toContainText("Last ACT test date for funding consideration");
  await expect(page.locator("#detailDeadlines")).toContainText("December 5, 2026");
  await expect(page.locator("#detailDeadlines")).toContainText("November 28, 2026");
  await page.screenshot({ path: testInfo.outputPath("nu-support-test-dates.png") });
});

test("NU Finance keeps ALEKS presence separate from the whole-program fee and missing price year", async ({ page }, testInfo) => {
  await seed(page, { gpa: 3.2, gpaScale: 4, languages: [english], exams: [{ id: "ALEKS", exam: "ALEKS", score: 70 }] }, { language: "kaz", theme: "dark" });
  const { result } = await openContext(page, "nu-b-study-master-of-science-in-finance", "nu-b-route-master-of-science-in-finance", "masters", { cycle: "2027-2028", applicant: "graduate" });
  await expect(page.locator("#admissionsReferenceSummary")).toContainText("Магистратураға түсу");
  const checks = result.assessment.activeChoice.details.checks;
  expect(checks.find(row => row.checkId === "quantitative-report").status).toBe("met");
  expect(checks.find(row => row.checkId === "quantitative-report").provided.score).toBe(70);
  expect(checks.find(row => row.kind === "manual_minimum").status).toBe("unassessed");
  await showTab(page, "finance");
  const tuition = page.locator("#detailFinance [data-course-tuition]");
  await expect(tuition).toContainText(/35[\s,.]*000/);
  await expect(tuition).toContainText(/14[\s,.]*000/);
  await expect(tuition).toContainText("толық бағдарлама үшін");
  await expect(tuition).toContainText("USD");
  await expect(tuition).not.toContainText("2027");
  await expect(tuition).not.toContainText("Imperial");
  await tuition.scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("nu-finance-whole-program-kaz.png") });
});

test("NU residency keeps unconditional reports distinct from UMC conditional admission and persists its context", async ({ page }, testInfo) => {
  await seed(page, { gpa: 4.85, gpaScale: 5, exams: [{ id: "IFOM_BSE", exam: "IFOM_BSE", score: 1, taken_on: "2026-03-01" }] }, { mobile: true });
  const option = "nu-c-study-residency-in-neurology";
  const unconditional = "nu-residency-unconditional";
  const conditional = "nu-residency-conditional-umc";
  const { result } = await openContext(page, option, unconditional, "residency", { cycle: "", applicant: "graduate" });
  expect(result.selected_option.awards).toEqual([]);
  expect(result.selected_option.format.duration).toBe("4 years");
  const report = result.assessment.activeChoice.details.checks.find(row => row.checkId === "medical-report");
  expect(report.status).toBe("met");
  expect(report.provided.score).toBe(1);
  expect(report.minimum).toBeNull();
  await showTab(page, "programs");
  const overview = page.locator("#admissionsStudyOverview");
  await reveal(overview);
  await expect(overview).toContainText("4 years");
  await expect(overview).toContainText("Astana");
  await showTab(page, "admission");

  const response = page.waitForResponse(item => item.url().includes(`/universities/${NU}/admissions-context`) && item.request().method() === "POST"
    && item.request().postDataJSON().context.application_route_id === conditional);
  await selectAdmissionRoute(page, conditional);
  const updated = await (await response).json();
  await expect(page.locator("#admissionsContext")).toHaveAttribute("data-state", "ready");
  expect(updated.assessment.activeChoice.details.checks.some(row => row.checkId === "medical-report")).toBe(false);
  expect(updated.assessment.activeChoice.details.checks.some(row => row.checkId === "umc-recommendation" && row.status === "unassessed")).toBe(true);
  await expect(page.locator("#detailRequirements")).toContainText(/first.*year|first enrollment year/i);
  await openAdmissionSelectionEditor(page);
  await page.locator("#admissionsSaveChoice").click();
  await expect(page.locator("#admissionsSaveStatus")).toContainText("saved");
  await page.reload();
  await expect(page.locator("#admissionsContext")).toHaveAttribute("data-state", "ready");
  await expect(page.locator("#admissionsRoute")).toHaveValue(conditional);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("unisearch_profile")));
  expect(saved.gpa).toBe(4.85);
  expect(saved.gpaScale).toBe(5);
  expect(saved.selectedAdmissionChoices[NU]).toEqual(expect.objectContaining({ studyOptionId: option, applicationRouteId: conditional, studyLevel: "residency" }));
  await page.goBack();
  await expect(page.locator("#admissionsRoute")).toHaveValue(unconditional);
  await page.goForward();
  await expect(page.locator("#admissionsRoute")).toHaveValue(conditional);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("nu-residency-context-phone.png") });
});

test("NU Nursing retains independent failed NAT sections and manual prior-qualification review", async ({ page }) => {
  await seed(page, { gpa: 3.6, gpaScale: 4, exams: [{ id: "NURSING_NAT", exam: "NURSING_NAT", details: { components: [
    { exam: "NAT_KNOWLEDGE", score: 70 }, { exam: "NAT_CLINICAL_SKILLS", score: 69 },
  ] } }] });
  const { result } = await openContext(page, "nu-a-study-bachelor-in-nursing", "nu-a-route-nursing", "undergraduate", { cycle: "", applicant: "first_year" });
  const checks = result.assessment.activeChoice.details.checks;
  expect(checks.find(row => row.kind === "academic_requirement").status).toBe("unmet");
  expect(checks.find(row => row.kind === "manual_minimum").status).toBe("unassessed");
  const failed = page.locator("#detailRequirements [data-minimum-exam='NAT_CLINICAL_SKILLS'][data-minimum-status='unmet']");
  await reveal(failed);
  await expect(failed).toContainText("70");
  await expect(failed).toContainText("69");
});

test("NU distinguishes six-year undergraduate medicine, graduate MD and a professional doctorate", async ({ page }) => {
  await seed(page);
  for (const [option, route, level, applicant, expected] of [
    ["nu-a-study-6-year-undergraduate-medical-program", "nu-a-route-ump", "undergraduate", "first_year", /6.year|six.year/i],
    ["nu-b-study-doctor-of-medicine", "nu-b-route-doctor-of-medicine", "professional", "graduate", /Doctor of Medicine/],
    ["nu-b-study-doctor-of-business-administration", "nu-b-route-doctor-of-business-administration", "professional", "graduate", /Doctor of Business Administration/],
  ]) {
    const { result } = await openContext(page, option, route, level, { cycle: "", applicant });
    expect(result.selected_option.levels).toContain(level);
    await expect(page.locator("#admissionsReferenceSummary")).toContainText(expected);
    if (option.includes("doctor-of-medicine")) expect(result.selected_option.levels).not.toContain("doctoral");
  }
});

test("NU joint BBA tuition keeps the NU and HKUST campuses and full-program reference distinct", async ({ page }, testInfo) => {
  await seed(page, {}, { language: "rus", theme: "dark", mobile: true });
  const { result } = await openContext(page, "nu-a-study-bachelor-of-business-administration-in-eurasian-business-joint-degree-with-hkust", "nu-a-route-joint-bba", "undergraduate", { cycle: "", applicant: "first_year" });
  expect(result.selected_option.title).toContain("HKUST");
  await expect(page.locator("#admissionsReferenceSummary")).toContainText("совместную программу BBA");
  await showTab(page, "finance");
  const tuition = page.locator("#detailFinance [data-course-tuition]");
  await expect(tuition).toContainText("HKUST");
  await expect(tuition).toContainText(/15[\s,.]*000/);
  await expect(tuition).toContainText(/31[\s,.]*900/);
  await expect(tuition).toContainText("за всю программу");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
  await tuition.scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("nu-joint-campus-costs-phone.png") });
});

test("NU refreshes a legacy cache, resets only its old choice, retries an outage and browses every native level", async ({ page }) => {
  const other = "university-of-oxford-uk-oxford";
  await seed(page, { gpa: 4.85, gpaScale: 5, budget: 24000, selectedAdmissionChoices: {
    [NU]: { programId: "old-nu-cs", choiceKey: "old-nu-choice" },
    [other]: { programId: "preserve-oxford-choice", choiceKey: "preserve-oxford-choice" },
  } });
  await page.addInitScript(id => {
    if (sessionStorage.getItem("nu-cache-seeded")) return;
    sessionStorage.setItem("nu-cache-seeded", "1");
    localStorage.setItem("unisearch_detail_cache_v4", JSON.stringify({ [`${id}::eng`]: { data: { id, name: "STALE NU LEGACY DETAIL" }, etag: "legacy", ts: Date.now() } }));
  }, NU);
  await page.route(`**/universities/${NU}/admissions-context`, route => route.fulfill({ status: 503, contentType: "application/json", body: '{"detail":"Temporarily unavailable"}' }), { times: 1 });
  await page.goto(`/university.html?id=${NU}`);
  await expect(page.locator("#detailName")).toHaveText("Nazarbayev University");
  await showTab(page, "admission");
  await expect(page.locator("#admissionsContext")).toHaveAttribute("data-state", "error");
  await page.locator("#detailRequirements").getByRole("button", { name: "Retry", exact: true }).click();
  await expect(page.locator("#admissionsContext")).toHaveAttribute("data-state", "ready");
  await expect(page.locator("[data-admission-reset-notice]")).toBeVisible();
  const profile = await page.evaluate(() => JSON.parse(localStorage.getItem("unisearch_profile")));
  expect(profile.gpa).toBe(4.85);
  expect(profile.gpaScale).toBe(5);
  expect(profile.budget).toBe(24000);
  expect(profile.selectedAdmissionChoices[NU]).toBeUndefined();
  expect(profile.selectedAdmissionChoices[other].programId).toBe("preserve-oxford-choice");
  await page.locator("#admissionsChooseProgram").click();
  await expect(page.locator("#tab-programs")).toHaveClass(/active/);
  for (const level of ["preparation", "undergraduate", "masters", "doctoral", "professional", "residency", "non_degree"]) {
    const selected = page.locator(".custom-select-wrapper:has(#admissionsStudyLevel)");
    await selected.locator(".custom-select-trigger").click();
    await selected.locator(`.custom-option[data-value='${level}']`).click();
    const ready = page.waitForResponse(item => item.url().includes(`/universities/${NU}/study-options?`) && new URL(item.url()).searchParams.get("study_level") === level);
    await page.locator("#admissionsSearchSubmit").click();
    const result = await (await ready).json();
    expect(result.total).toBeGreaterThan(0);
    expect(result.items.every(option => option.levels.includes(level))).toBe(true);
    await expect(page.locator("#admissionsProgramList [data-study-option]").first()).toBeVisible();
  }
  await page.locator("#admissionsProgramList [data-select-study-option='nu-a-study-non-degree-study']").click();
  await expect(page.locator("#admissionsContext")).toHaveAttribute("data-state", "ready");
  await showTab(page, "admission");
  await selectAdmissionRoute(page, "nu-a-route-non-degree-study");
  await expect(page.locator("#admissionsRoute")).toHaveValue("nu-a-route-non-degree-study");
  await expect(page.locator("#detailRequirements")).toContainText(/degree.*(conversion|transition)|internal university conditions/i);
  await showTab(page, "deadlines");
  await expect(page.locator("#detailDeadlines [data-calendar-export]")).toHaveCount(0);
});

test("NU Finance and MIT comparison retain independent saved program, route and billing periods", async ({ page }, testInfo) => {
  const mit = "mit-usa-cambridge";
  const finance = { studyOptionId: "nu-b-study-master-of-science-in-finance", applicationRouteId: "nu-b-route-master-of-science-in-finance", studyLevel: "masters", applicantRoute: "graduate", intendedEntryCycle: "2027-2028", feeStatusContext: "unknown" };
  await seed(page, { selectedAdmissionChoices: {
    [NU]: finance,
    [mit]: { studyOptionId: "mit-course-6-3-bachelor", applicationRouteId: "mit-first-year", studyLevel: "undergraduate", applicantRoute: "first_year", intendedEntryCycle: "Fall 2027 entry", feeStatusContext: "unknown" },
  } }, { mobile: true });
  await page.goto(`/compare.html?stage=configure&ids=${NU},${mit}`);
  await expect(page.locator("body")).toHaveAttribute("data-page", "compare");
  await expect(page.locator("#siteInitialLoader")).toBeHidden();
  await expect(page.locator(`#compare-options-${NU} .compare-context-current__value`)).toContainText("Finance");
  await expect(page.locator(`#compare-options-${mit} .compare-context-current__value`)).toContainText("Computer Science");
  await page.locator('[data-action="build-compare-results"]').click();
  const comparison = page.locator("[data-reviewed-comparison]");
  await expect(comparison).toBeVisible();
  await expect(comparison).toContainText("for the whole program");
  await expect(comparison).toContainText("14,000");
  await expect(comparison).toContainText("66,720");
  const current = await page.evaluate(id => JSON.parse(localStorage.getItem("unisearch_profile")).selectedAdmissionChoices[id], NU);
  expect(current).toEqual(expect.objectContaining(finance));
  const financeLink = comparison.locator(`a[href*='id=${NU}'][href$='#tab-finance']`).first();
  const target = new URL(await financeLink.getAttribute("href"), page.url());
  expect(target.searchParams.get("admission_option")).toBe(finance.studyOptionId);
  expect(target.searchParams.get("admission_application_route")).toBe(finance.applicationRouteId);
  await financeLink.click();
  await expect(page.locator("#admissionsContext")).toHaveAttribute("data-state", "ready");
  await expect(page.locator("#admissionsRoute")).toHaveValue(finance.applicationRouteId);
  await expect(page.locator("#tab-finance")).toHaveClass(/active/);
  await page.goBack();
  await expect(page.locator("[data-reviewed-comparison]")).toBeVisible();
  await page.reload();
  await expect(page.locator("[data-reviewed-comparison]")).toContainText("for the whole program");
  await expect(page.locator("#siteInitialLoader")).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
  await page.locator("[data-reviewed-comparison]").scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("nu-mit-independent-comparison-phone.png") });
});

test("NU mid-year keeps its 2026/27 thresholds and conflicted dates out of the 2027/28 context", async ({ page }) => {
  await seed(page);
  const route = "nu-a-route-midyear-2026-27";
  const current = await openContext(page, "", route, "undergraduate", { cycle: "Spring 2027" });
  expect(current.result.reading_scope).toBe("institution_route");
  const minima = current.result.facts.find(row => row.id === "nu-a-fact-midyear-nuet");
  expect(minima.value).toEqual(expect.objectContaining({ NUET_total: 130, mathematics_minimum: 60, critical_thinking_problem_solving_minimum: 60 }));
  await expect(page.locator("#detailRequirements")).toContainText("130");
  await showTab(page, "deadlines");
  await expect(page.locator("#detailDeadlines [data-calendar-day='2026-11-28']")).toHaveCount(0);
  const future = await openContext(page, "", route, "undergraduate", { cycle: "Fall 2027" });
  expect(future.result.facts.some(row => row.id === "nu-a-fact-midyear-nuet")).toBe(false);
  expect(future.result.history.facts.some(row => row.id === "nu-a-fact-midyear-nuet")).toBe(true);
});

test("NU transfer waiver and NUFYP progression preserve their own conditions and manual evidence", async ({ page }) => {
  await seed(page, { gpa: 3.8, gpaScale: 4 });
  const transfer = await openContext(page, CS, "nu-a-route-transfer", "undergraduate", { cycle: "", applicant: "transfer" });
  const policy = transfer.result.facts.find(row => row.id === "nu-a-fact-transfer-route-details");
  const unrelated = new Set(["nu-a-gap-nuzyp-activity", "nu-a-gap-engineering-masters", "nu-a-gap-nursing", "nu-b-gap-emba-price", "nu-b-gap-som-phd-regular-gpa"]);
  expect(transfer.result.unknowns.filter(row => unrelated.has(row.id))).toEqual([]);
  expect(policy.value.minimum_CGPA).toBe(2);
  expect(policy.value.English_waiver).toContain("at least one semester");
  await expect(page.locator("#detailRequirements")).toContainText("English waiver");
  expect(transfer.result.assessment.activeChoice.details.checks.some(row => row.kind === "manual_minimum" && row.status === "unassessed")).toBe(true);
  const progression = await openContext(page, CS, "nu-a-route-nufyp-progression", "undergraduate", { cycle: "" });
  const minimums = progression.result.facts.find(row => row.id === "nu-a-fact-nufyp-progression").value;
  expect(Object.values(minimums.fee_paying_minima)).toEqual([50, 60, 50]);
  expect(Object.values(minimums.grant_certifying_minima)).toEqual([70, 70, 70]);
  await expect(page.locator("#detailRequirements")).toContainText("FMAT");
  await expect(page.locator("#detailRequirements")).toContainText("grant");
});

test("NU Chemistry retains the Industry PhD limits without leaking them into another doctorate", async ({ page }) => {
  await seed(page, {}, { theme: "dark" });
  const chemistry = await openContext(page, "nu-c-study-ph-d-in-chemistry", "nu-c-phd-route", "doctoral", { cycle: "2027/2028", applicant: "graduate" });
  expect(chemistry.result.selected_option.awards).toEqual(["PhD"]);
  expect(chemistry.result.unknowns.some(row => row.id === "nu-c-gap-industry-phd-terms")).toBe(true);
  await expect(page.locator("#detailRequirements")).toContainText("sponsor");
  const computerScience = await openContext(page, "nu-c-study-ph-d-in-computer-science", "nu-c-phd-route", "doctoral", { cycle: "2027/2028", applicant: "graduate" });
  expect(computerScience.result.unknowns.some(row => row.id === "nu-c-gap-industry-phd-terms")).toBe(false);
  expect(computerScience.result.selected_option.awards).toEqual(["PhD"]);
});

test("NU regular qualification alternatives preserve GPA scales, UNT sections, IB HL and individual A-level grades", async ({ page }) => {
  await seed(page);
  await page.goto(`/university.html?id=${NU}`);
  await expect(page.locator("#detailName")).toHaveText("Nazarbayev University");
  const aLevel = grades => ({ id: "A_LEVEL_CERT", exam: "A_LEVEL_CERT", taken_on: "2026-06-01", details: { components:
    ["A_LEVEL_MATHEMATICS", "A_LEVEL_PHYSICS", "A_LEVEL_CHEMISTRY"].map((exam, index) => ({ exam, raw_value: grades[index] })),
  } });
  const cases = [
    { name: "reported 4/5 GPA", profile: { gpa: 4, gpaScale: 5 }, status: "met" },
    { name: "4/4 GPA is not converted to the source's 5-point scale", profile: { gpa: 4, gpaScale: 4 }, status: "unassessed" },
    { name: "ACT26", profile: { exams: [{ id: "ACT", exam: "ACT", score: 26, taken_on: "2026-03-01" }] }, status: "met" },
    { name: "UNT85 with five qualifying sections", profile: { exams: [{ id: "UNT", exam: "UNT", score: 85, taken_on: "2026-06-01", details: { components: [
      { exam: "UNT_HISTORY_OF_KAZAKHSTAN", score: 20 }, { exam: "UNT_READING_LITERACY", score: 10 },
      { exam: "UNT_MATHEMATICAL_LITERACY", score: 10 }, { exam: "UNT_PROFILE_MATHEMATICS", score: 25 }, { exam: "UNT_PROFILE_INFORMATICS", score: 20 },
    ] } }] }, status: "met" },
    { name: "IB27 with three HL4", profile: { exams: [{ id: "IB_Diploma", exam: "IB_Diploma", score: 27, taken_on: "2026-06-01", details: { components: [
      { exam: "IB_MATHEMATICS_HL", score: 4 }, { exam: "IB_PHYSICS_HL", score: 4 }, { exam: "IB_CHEMISTRY_HL", score: 4 },
    ] } }] }, status: "met" },
    { name: "old IB total with missing HL evidence", profile: { exams: [{ id: "IB_Diploma", exam: "IB_Diploma", score: 27, taken_on: "2026-06-01" }] }, status: "missing" },
    { name: "A-level BBB", profile: { exams: [aLevel(["B", "B", "B"])] }, status: "met", grade: true },
    { name: "A-level A-star CC cannot substitute a summed total for three B grades", profile: { exams: [aLevel(["A*", "C", "C"])] }, status: "unmet", grade: true },
  ];
  for (const item of cases) await test.step(item.name, async () => {
    await page.evaluate(profile => localStorage.setItem("unisearch_profile", JSON.stringify(profile)), { _v: 2, languages: [english], ...item.profile });
    const { result, request } = await openContext(page, CS, REGULAR, "undergraduate");
    const academic = result.assessment.activeChoice.details.checks.find(row => row.kind === "academic_requirement");
    expect(academic.status, item.name).toBe(item.status);
    if (item.profile.gpaScale) expect(request.profile.gpa_scale).toBe(item.profile.gpaScale);
    if (item.grade) {
      const counted = page.locator("#detailRequirements [data-minimum-exam='A_LEVEL_CERT']");
      await reveal(counted);
      await expect(counted).toContainText("each B or higher");
      await expect(counted).toHaveAttribute("data-minimum-status", item.status);
      const check = counted.locator("xpath=ancestor::details[contains(@class,'admissions-catalog__check')][1]");
      const nativeScores = await check.locator(".admissions-catalog__entry").filter({ has: page.locator(":scope > dt", { hasText: /^Reported score$/ }) }).locator(":scope > dd").allTextContents();
      expect(nativeScores.length).toBeGreaterThanOrEqual(3);
      expect(nativeScores.every(value => !/^\d+$/.test(value))).toBe(true);
      await expectReadableCheck(counted);
    }
  });
});
