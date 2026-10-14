const { test, expect } = require("@playwright/test");
const { personas, seedProfile } = require("./helpers/personas");
const { setNativeSelect } = require("./helpers/selectors");

const MIT = "mit-usa-cambridge";
const STANFORD = "stanford-university-usa-ca";
const IMPERIAL = "imperial-college-london-uk";

async function openCatalog(page, university = MIT, { width = 1280, language = "eng", theme = "light", url } = {}) {
  await page.setViewportSize({ width, height: 900 });
  await page.addInitScript(({ language, theme }) => {
    localStorage.setItem("unisearch_ui_language_v1", language);
    localStorage.setItem("unisearch_theme", theme);
    localStorage.setItem("unisearch_universities_tour_seen_v1", "1");
  }, { language, theme });
  await page.goto(url || `/university.html?id=${university}`);
  await expect(page.locator("body")).toHaveAttribute("data-page", "university");
  await expect(page.locator("#detailName")).not.toBeEmpty();
  if (!url) await expect(page.locator("#tab-general")).toHaveClass(/active/);
  if (url && new URL(url, "http://localhost").searchParams.has("admission_application_route")) await openAdmission(page);
  await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
}

async function openAdmission(page) {
  const route = new URL(page.url()).searchParams.get("admission_application_route");
  if (route !== null) await expect(page.locator("#admissionsRoute")).toHaveValue(route);
  await expect(page.locator("#admissionsContext")).toHaveAttribute("data-state", "ready");
  await openTab(page, "admission");
}

async function openAdvanced(page) {
  const advanced = page.locator("#admissionsAdvanced");
  if (await advanced.count() && !(await advanced.evaluate((node) => node.open))) await advanced.locator(":scope > summary").click();
}

async function openAssessment(page) {
  const details = page.locator("#detailRequirements details.admissions-catalog__assessment-detail");
  if (await details.count() && !(await details.evaluate((node) => node.open))) await details.locator(":scope > summary").click();
  return page.locator("#detailRequirements .admissions-catalog__assessment");
}

async function openTab(page, name) {
  await page.locator(`.d-tab-btn[data-tab="tab-${name}"]`).click();
  await expect(page.locator(`#tab-${name}`)).toHaveClass(/active/);
}

async function searchOptions(page, query, level = "") {
  await openTab(page, "programs");
  await setNativeSelect(page, "admissionsStudyLevel", level);
  await page.locator("#admissionsSearch").fill(query);
  const response = page.waitForResponse((response) => response.url().includes("/study-options?") && response.request().method() === "GET");
  await page.locator("#admissionsSearchSubmit").click();
  expect((await response).ok()).toBe(true);
  await expect(page.locator("#admissionsSearchSubmit")).toBeEnabled();
}

async function chooseOption(page, id, query, level) {
  await searchOptions(page, query, level);
  const option = page.locator(`#admissionsProgramList [data-study-option="${id}"]`);
  await expect(option).toBeVisible();
  const title = await option.locator(".admissions-programs__option-title").innerText();
  const response = page.waitForResponse((response) => response.url().endsWith("/admissions-context") && response.request().method() === "POST");
  await option.click();
  expect((await response).ok()).toBe(true);
  await expect(page.locator("#tab-programs")).toHaveClass(/active/);
  await expect(page.locator("#admissionsStudyDetails")).toBeVisible();
  await expect(page.locator("#admissionsStudyDetails > .admissions-context__heading > h3")).toHaveText(title);
  await expect(page.locator("#admissionsViewRequirements")).toBeEnabled();
  expect(new URL(page.url()).searchParams.get("admission_option")).toBe(id);
}

async function applyContext(page, route, applicant = "", cycle = "", fee = "unknown") {
  await openAdmission(page);
  await openAdvanced(page);
  await setNativeSelect(page, "admissionsRoute", route);
  await setNativeSelect(page, "admissionsApplicant", applicant);
  await setNativeSelect(page, "admissionsFee", fee);
  await page.locator("#admissionsCycle").fill(cycle);
  const response = page.waitForResponse((response) => response.url().endsWith("/admissions-context") && response.request().method() === "POST");
  await page.locator("#admissionsContextApply").click();
  expect((await response).ok()).toBe(true);
  await openAdmission(page);
  await expect(page.locator("#admissionsRoute")).toHaveValue(route);
  await expect(page.locator("#admissionsApplicant")).toHaveValue(applicant);
  await expect(page.locator("#admissionsCycle")).toHaveValue(cycle);
  expect(new URL(page.url()).searchParams.get("admission_application_route")).toBe(route);
}

async function openFact(page, tab, id) {
  if (tab === "admission") await openAdmission(page);
  else await openTab(page, tab);
  const fact = page.locator(`#tab-${tab} [data-admissions-fact="${id}"]`).first();
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

async function noFitPercentage(page) {
  await openAdmission(page);
  const assessment = await openAssessment(page);
  await expect(assessment).toBeVisible();
  await expect(assessment.locator(":scope > p").first()).not.toContainText(/\d+(?:[.,]\d+)?\s*%/);
  await expect(assessment).toContainText(/not.*probability|не вероятность поступления/i);
}

async function fitsViewport(page, width) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
}

for (const [id, width, query, description] of [
  ["mit-bs-6-5", 1280, "Electrical Engineering with Computing", "programming"],
  ["mit-bs-21e", 390, "Humanities and Engineering", "humanities"],
]) {
  test(`MIT ${id} retains sourced study content and Russian interface with shared admission`, async ({ page }) => {
    await openCatalog(page, MIT, { width, language: "rus" });
    await openAdmission(page);
    await expect(page.locator("#admissionsContext h2")).toHaveText("Условия поступления");
    await chooseOption(page, id, query, "undergraduate");
    await openAdmission(page);
    await expect(page.locator('#admissionsRoute option[value="mit-first-year"]')).toHaveCount(1);
    await expect(page.locator('#admissionsRoute option[value="mit-transfer"]')).toHaveCount(1);
    await applyContext(page, "mit-first-year", "first_year", "Fall 2027");
    const fact = await openFact(page, "programs", `${id}-description`);
    await expect(fact).toContainText(description);
    await expect(fact.locator('a[href*="catalog.mit.edu/degree-charts/"]')).toBeVisible();
    await expect(page.locator("#admissionsStudyDetails")).toContainText("на языке оригинала");
    await fitsViewport(page, width);
  });
}

for (const [id, width, language, query] of [
  ["mit-course-6-7p-meng", 1280, "eng", "Computer Science and Molecular Biology"],
  ["mit-course-6-14p-meng", 390, "rus", "Computer Science, Economics, and Data Science"],
]) {
  test(`MIT ${id} opens the internal EECS MEng route`, async ({ page }) => {
    await openCatalog(page, MIT, { width, language });
    await chooseOption(page, id, query, "masters");
    await openAdmission(page);
    await expect(page.locator("#admissionsRoute option[value='mit-first-year']")).toHaveCount(0);
    await applyContext(page, "mit_eecs_meng_admissions");
    const description = await openFact(page, "programs", `${id}-description`);
    await expect(description).toContainText("related MIT Course");
    await expect(description.locator('a[href*="catalog.mit.edu/degree-charts/"]')).toBeVisible();
    const preparation = await openFact(page, "admission", "eecs-meng-preparation");
    await expect(preparation).toContainText("apply before graduation");
    await expect(page.locator("#detailRequirements [data-admissions-fact='ug-sat-act-presence']")).toHaveCount(0);
    await noFitPercentage(page);
    await fitsViewport(page, width);
  });
}

for (const [width, language, theme] of [[1280, "eng", "light"], [390, "rus", "dark"]]) {
  test(`MIT Course 6-9P retains distinct internal GPA minimums at ${width}px in ${language} ${theme}`, async ({ page }) => {
    await openCatalog(page, MIT, { width, language, theme });
    await chooseOption(page, "mit-course-6-9p-meng", "Computation and Cognition", "masters");
    await applyContext(page, "mit_bcs_meng_admissions");
    const fact = await openFact(page, "admission", "bcs-meng-entry-conditions");
    await expect(fact).toContainText("4.25");
    await expect(fact).toContainText(/Overall|общий/i);
    await expect(fact).toContainText("102");
    await expect(page.locator("#admissionsRoute option[value='mit_eecs_meng_admissions']")).toHaveCount(0);
    await noFitPercentage(page);
    await expect(page.locator("#detailRequirements .admissions-catalog__assessment")).toContainText(/Evidence missing|Сведений нет|Не хватает необходимых/i);
    await fitsViewport(page, width);
  });
}

test("MIT Sloan MSMS keeps partner-school eligibility and its own deadline", async ({ page }) => {
  await openCatalog(page, MIT, { width: 390, language: "rus" });
  await chooseOption(page, "mit-sloan-msms", "Management Studies", "masters");
  await applyContext(page, "mit_sloan_msms_admissions", "graduate", "Fall 2027 entry");
  const eligibility = await openFact(page, "admission", "mit_sloan_msms_admissions-extra-requirements");
  await expect(eligibility).toContainText("partner or affiliate");
  await expect(eligibility).toContainText("Only current students or graduates");
  await expect(page.locator("#admissionsRoute option[value='mit_sloan_mban_admissions']")).toHaveCount(0);
  const dates = await openFact(page, "deadlines", "mit_sloan_msms_admissions-deadlines");
  await expect(dates).toContainText(/2027[-\u2011]02[-\u2011]18/);
  await expect(dates).toContainText("America/New_York");
  const price = await openFact(page, "finance", "mit-sloan-msms-price-1");
  await expect(price).toContainText(/Unknown|Неизвестно/);
  await expect(page.locator("#detailFinance")).toContainText("не установлена");
  await expect(page.locator("#detailFinance")).not.toContainText(/\$0\b/);
  await fitsViewport(page, 390);
});

test("MITILI Linguistics SM keeps its shared PhD procedure and separate scholarship scope", async ({ page }) => {
  await openCatalog(page, MIT, { width: 390, language: "rus" });
  await chooseOption(page, "mit-linguistics-sm-mit-grad-linguistics", "Linguistics", "masters");
  await applyContext(page, "mit_mitili_sm_admissions");
  const procedure = await openFact(page, "admission", "mit_mitili_sm_admissions-extra-requirements");
  await expect(procedure).toContainText("Linguistics PhD application procedure");
  await expect(procedure).toContainText("Statement of Objectives");
  const funding = await openFact(page, "finance", "mit_mitili_sm_admissions-funding-0-0");
  await expect(funding).toContainText("health insurance");
  await expect(funding).toContainText("MITILI Full Scholarship");
  await expect(page.locator("#detailFinance")).toContainText("не считается предоставленной помощью");
  await expect(page.locator("#admissionsRoute option[value='mit_linguistics_doctoral_admissions']")).toHaveCount(0);
  await fitsViewport(page, 390);
});

test("MIT Mathematics of Data SM keeps its internal route and unassessed GPA", async ({ page }) => {
  await openCatalog(page, MIT, { width: 390, language: "rus" });
  await chooseOption(page, "mit-mathematics-of-data-sm-mit-grad-mathematics", "Mathematics of Data", "masters");
  await applyContext(page, "mit_mathematics_of_data_sm_admissions");
  const eligibility = await openFact(page, "admission", "mathematics-of-data-eligibility");
  await expect(eligibility).toContainText("4,8");
  await expect(eligibility).toContainText("MIT 5.0");
  const procedure = await openFact(page, "admission", "mit_mathematics_of_data_sm_admissions-description");
  await expect(procedure).toContainText("current MIT Mathematics undergraduates");
  await noFitPercentage(page);
  const deadline = await openFact(page, "deadlines", "mit_mathematics_of_data_sm_admissions-deadlines");
  await expect(deadline).toContainText(/2026[-\u2011]12[-\u2011]01/);
  await fitsViewport(page, 390);
});

test("MIT Business Analytics profile interest keeps source title readable without selecting a route", async ({ page }) => {
  await seedProfile(page, { major: "Business Analytics (Course 15-2)", studyLevel: "Bachelor" });
  await openCatalog(page, MIT, { language: "rus", theme: "dark" });
  await searchOptions(page, "Business Analytics", "undergraduate");
  const option = page.locator('[data-study-option="mit-bs-15-2"]');
  await expect(option).toContainText(/Business Analytics \(Course 15[-\u2011]2\)/);
  await expect(option).toContainText("Бакалавриат");
  await expect(page.locator("#admissionsRoute")).toHaveValue("");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(option).toBeVisible();
  await fitsViewport(page, 390);
});

for (const width of [1280, 390]) {
  for (const theme of ["light", "dark"]) {
    test(`MIT Business Analytics curriculum and admission journey at ${width}px in ${theme}`, async ({ page }) => {
      await openCatalog(page, MIT, { width, language: "rus", theme });
      await chooseOption(page, "mit-bs-15-2", "Business Analytics", "undergraduate");
      await applyContext(page, "mit-first-year", "first_year", "Fall 2027");
      const curriculum = await openFact(page, "programs", "mit-bs-15-2-description");
      await expect(curriculum).toContainText("data modeling");
      await expect(curriculum).toContainText("degree requirements, not admission prerequisites");
      await expect(curriculum.locator('a[href*="business-analytics-course-15-2"]')).toBeVisible();
      const exam = await openFact(page, "admission", "ug-sat-act-presence");
      await expect(exam).toContainText("SAT");
      await expect(exam).toContainText("ACT");
      await expect(exam.locator('a[href^="https://mitadmissions.org/"]').first()).toBeVisible();
      await expect(page.locator("#detailRequirements [data-admissions-fact='mit-transfer-description']")).toHaveCount(0);
      await noFitPercentage(page);
      await page.locator("#admissionsSaveChoice").click();
      await expect(page.locator("#admissionsSaveStatus")).toContainText("сохранён");
      const saved = await page.evaluate((uid) => JSON.parse(localStorage.getItem("unisearch_profile")).selectedAdmissionChoices[uid], MIT);
      expect(saved.studyOptionId).toBe("mit-bs-15-2");
      expect(saved.applicationRouteId).toBe("mit-first-year");
      expect(saved.intendedEntryCycle).toBe("Fall 2027");
      await page.reload();
      await openAdmission(page);
      await expect(page.locator("#admissionsRoute")).toHaveValue("mit-first-year");
      await expect(page.locator("#admissionsApplicant")).toHaveValue("first_year");
      await expect(page.locator("#admissionsCycle")).toHaveValue("Fall 2027");
      await fitsViewport(page, width);
    });
  }
}

test("reviewed MIT program levels use Russian labels while source names remain disclosed", async ({ page }) => {
  await openCatalog(page, MIT, { language: "rus" });
  await searchOptions(page, "Computer Science and Engineering", "undergraduate");
  const program = page.locator('[data-study-option="mit-course-6-3-bachelor"]');
  await expect(program).toContainText("Бакалавриат");
  await expect(program).toContainText("Computer Science and Engineering");
  await expect(page.locator("#tab-programs")).toContainText("Программа или предмет");
});

test("MIT program requires an explicit admission route and keeps funding separate", async ({ page }) => {
  await openCatalog(page);
  await openAdmission(page);
  await expect(page.locator("#admissionsContext")).toContainText("Choose a program in the Programs tab to see its published application paths.");
  await chooseOption(page, "mit-course-6-3-bachelor", "Computer Science and Engineering", "undergraduate");
  await openAdmission(page);
  await expect(page.locator("#admissionsContext")).toContainText("Choose one of the published paths above to read its requirements and application details.");
  await expect(page.locator("#admissionsRoute option[value='mit-first-year']")).toHaveCount(1);
  await expect(page.locator("#admissionsRoute option[value='mit-transfer']")).toHaveCount(1);
  await expect(page.locator("#admissionsRoute option")).toHaveCount(3);
  await applyContext(page, "mit-first-year", "first_year", "Fall 2027");
  await noFitPercentage(page);
  const tests = await openFact(page, "deadlines", "first-year-test-windows");
  await expect(tests).toContainText("December 31");
  await expect(tests).not.toContainText("Application fee");
  await openTab(page, "finance");
  await expect(page.locator("#detailFinance")).toContainText("not awarded aid");
  await chooseOption(page, "mit-physics-phd-course-8", "Physics", "doctoral");
  await applyContext(page, "mit_physics_phd_admissions", "graduate");
  await expect(page.locator("#detailRequirements [data-admissions-fact='ug-sat-act-presence']")).toHaveCount(0);
  await expect(page.locator("#admissionsRoute option[value='mit-first-year']")).toHaveCount(0);
});

test("MIT transfer deadlines preserve Spring-cycle applicant restrictions after reload", async ({ page }) => {
  await openCatalog(page);
  await chooseOption(page, "mit-course-6-3-bachelor", "Computer Science and Engineering", "undergraduate");
  await applyContext(page, "mit-transfer", "transfer", "Spring 2027 entry");
  await page.reload();
  await openAdmission(page);
  await expect(page.locator("#admissionsApplicant")).toHaveValue("transfer");
  await expect(page.locator("#admissionsCycle")).toHaveValue("Spring 2027 entry");
  const deadlines = await openFact(page, "deadlines", "transfer-2027-windows");
  await expect(deadlines).toContainText(/2026[-\u2011]10[-\u2011]15/);
  await expect(deadlines).toContainText("US citizen");
  await expect(deadlines).toContainText("US permanent resident");
  const route = await openFact(page, "admission", "mit-transfer-extra-requirements");
  await expect(route).toContainText("Spring transfer entry is only open to U.S. citizens and U.S. permanent residents");
});

test("MIT Course 6-3 first-year publishes no invented minimum or fit percentage and separates history", async ({ page }) => {
  await seedProfile(page, {
    studyLevel: "Bachelor", applicantRoute: "first_year", intendedEntryCycle: "Fall 2027",
    exams: [{ exam: "SAT", score: 1500 }],
  });
  await openCatalog(page, MIT, { width: 390, language: "rus", theme: "dark" });
  await chooseOption(page, "mit-course-6-3-bachelor", "Computer Science and Engineering", "undergraduate");
  await applyContext(page, "mit-first-year", "first_year", "Fall 2027");
  await noFitPercentage(page);
  const exam = await openFact(page, "admission", "ug-sat-act-presence");
  await expect(exam).toContainText(/Cutoff|порог/i);
  await expect(exam).not.toContainText("1500");
  await expect(page.locator("#detailRequirements .admissions-catalog__check").filter({ hasText: "Допустимые варианты обязательного теста" })).toContainText("Выполнено");
  await openTab(page, "general");
  const history = page.locator("#admissionsUniversityInfo .admissions-catalog > details");
  await expect(history).toBeVisible();
  await expect(history).not.toHaveAttribute("open", "");
  await history.locator(":scope > summary").click();
  await expect(history).toContainText("Исторические");
  await expect(history.locator('[data-admissions-fact="mit-first-year-profile-0"]')).toHaveCount(1);
  await expect(page.locator("#detailRequirements [data-admissions-fact='mit-first-year-profile-0']")).toHaveCount(0);
  await fitsViewport(page, 390);
});

test("MIT graduate override is request-local and ignores the delayed prior program response", async ({ page }) => {
  await seedProfile(page, { studyLevel: "Bachelor", applicantRoute: "first_year", intendedEntryCycle: "Fall 2027", gpa: 3.82, gpaScale: 4 });
  let releaseDelayed;
  let signalFetched;
  const gate = new Promise((resolve) => { releaseDelayed = resolve; });
  const fetched = new Promise((resolve) => { signalFetched = resolve; });
  const requests = [];
  await page.route("**/admissions-context", async (route) => {
    const body = route.request().postDataJSON();
    requests.push(body);
    if (body.context.study_option_id === "mit-course-6-3-bachelor" && body.context.application_route_id === "mit-first-year") {
      const response = await route.fetch();
      signalFetched();
      await gate;
      await route.fulfill({ response });
      return;
    }
    await route.continue();
  });
  await openCatalog(page);
  await chooseOption(page, "mit-course-6-3-bachelor", "Computer Science and Engineering", "undergraduate");
  await openAdmission(page);
  await openAdvanced(page);
  await setNativeSelect(page, "admissionsRoute", "mit-first-year");
  await page.locator("#admissionsContextApply").click();
  await fetched;
  try {
    await chooseOption(page, "mit-physics-phd-course-8", "Physics", "doctoral");
    await applyContext(page, "mit_physics_phd_admissions", "graduate", "Fall 2027");
    const current = requests.find((request) => request.context.application_route_id === "mit_physics_phd_admissions");
    expect(current.context.study_level).toBe("doctoral");
    expect(current.context.applicant_route).toBe("graduate");
    expect(current.context.intended_entry_cycle).toBe("Fall 2027");
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("unisearch_profile")));
    expect(saved.studyLevel).toBe("Bachelor");
    expect(saved.applicantRoute).toBe("first_year");
    expect(saved.intendedEntryCycle).toBe("Fall 2027");
    releaseDelayed();
    await expect(page.locator("#admissionsRoute")).toHaveValue("mit_physics_phd_admissions");
    await expect(page.locator("#detailRequirements [data-admissions-fact='ug-sat-act-presence']")).toHaveCount(0);
    await page.goBack();
    await openAdmission(page);
    await expect(page.locator("#admissionsRoute")).toHaveValue("");
    await page.goBack();
    await openAdmission(page);
    await expect(page.locator("#admissionsRoute")).toHaveValue("mit-first-year");
    expect(new URL(page.url()).searchParams.get("admission_option")).toBe("mit-course-6-3-bachelor");
  } finally {
    releaseDelayed();
  }
});

test("Stanford Computer Science opens its institutional first-year context without JD facts", async ({ page }) => {
  await seedProfile(page, { studyLevel: "Bachelor", applicantRoute: "first_year", intendedEntryCycle: "Fall 2027", gpa: 3.78, exams: [{ exam: "SAT", score: 1510 }] });
  await openCatalog(page, STANFORD);
  await chooseOption(page, "stanford-option-cs-bs", "Computer Science", "undergraduate");
  await applyContext(page, "undergraduate-shared-evidence:stanford-first-year", "first_year", "Fall 2027");
  const exam = await openFact(page, "admission", "undergraduate-shared-evidence:stanford-firstyear-standardized-tests");
  await expect(exam).toContainText(/SAT|ACT/);
  await expect(page.locator("#detailRequirements [data-admissions-fact='undergraduate-shared-evidence:stanford-transfer-standardized-tests']")).toHaveCount(0);
  await noFitPercentage(page);
  await openTab(page, "finance");
  await expect(page.locator("#detailFinance")).not.toContainText(/Stanford Law School|Juris Doctor|JD Admission/);
  await expect(page.locator("#detailFinance")).toContainText("not awarded aid");
});

for (const [id, award] of [["imperial-option-computing-beng", "BEng"], ["imperial-option-computing-meng", "MEng"]]) {
  test(`Imperial Computing ${award} keeps its 2027 undergraduate course rules and source fee scope`, async ({ page }) => {
    await seedProfile(page, { studyLevel: "Bachelor", applicantRoute: "first_year", intendedEntryCycle: "2027 entry", gpa: 3.8, gpaScale: 4 });
    await openCatalog(page, IMPERIAL);
    await chooseOption(page, id, "Computing", "undergraduate");
    await applyContext(page, `procedure-computing-${award.toLowerCase()}`, "first_year", "2027 entry");
    const rule = await openFact(page, "admission", `imperial-computing-${award.toLowerCase()}-admission`);
    await expect(rule).toContainText("TMUA");
    await expect(rule).toContainText(/A\*A\*A|A\*AAA/);
    await expect(rule).toContainText("41 points");
    const deadline = await openFact(page, "deadlines", "imperial-ucas-2027-window");
    await expect(deadline).toContainText(/2027[-\u2011]01[-\u2011]13/);
    await expect(deadline).toContainText("18:00");
    await expect(deadline).toContainText("Europe/London");
    const profile = await openFact(page, "finance", `imperial-computing-${award.toLowerCase()}-course-profile`);
    await expect(profile).toContainText(award);
    await expect(profile).toContainText("Home fee");
    await expect(profile).toContainText("Overseas fee");
    await expect(profile).toContainText("£10,050 per year");
    await expect(page.locator("#detailFinance")).toContainText("comparable annual total is not established");
    await expect(page.locator("#detailFinance")).not.toContainText(/\$0\b/);
    await noFitPercentage(page);
  });
}

test("Stanford CS transfer keeps its Common Application route separate from first-year and JD", async ({ page }) => {
  await seedProfile(page, { studyLevel: "Bachelor", applicantRoute: "transfer", intendedEntryCycle: "Fall 2027", major: "Computer Science" });
  await openCatalog(page, STANFORD);
  await chooseOption(page, "stanford-option-cs-bs", "Computer Science", "undergraduate");
  await applyContext(page, "undergraduate-shared-evidence:stanford-transfer", "transfer", "Fall 2027");
  const route = await openFact(page, "admission", "undergraduate-shared-evidence:stanford-transfer-eligibility-route");
  await expect(route).toContainText("transfer route");
  const testRule = await openFact(page, "admission", "undergraduate-shared-evidence:stanford-transfer-standardized-tests");
  await expect(testRule).toContainText("ACT or SAT");
  const dates = await openFact(page, "deadlines", "undergraduate-shared-evidence:stanford-transfer-deadline");
  await expect(dates).toContainText("Common Application");
  await expect(dates).toContainText("autumn/fall");
  await expect(page.locator("#detailRequirements [data-admissions-fact='undergraduate-shared-evidence:stanford-firstyear-standardized-tests']")).toHaveCount(0);
  await expect(page.locator("#detailRequirements")).not.toContainText(/Juris Doctor|JD Admission|Stanford Law School/);
});

test("MIT catalog Architecture shares institutional first-year and transfer routes", async ({ page }) => {
  await openCatalog(page);
  await chooseOption(page, "mit-bs-4", "Architecture", "undergraduate");
  await expect(page.locator("#tab-programs")).toHaveClass(/active/);
  await expect(page.locator("#admissionsStudyInfo")).toContainText("Architecture (Course 4)");
  await openAdmission(page);
  await expect(page.locator("#admissionsRoute option[value='mit-first-year']")).toHaveCount(1);
  await expect(page.locator("#admissionsRoute option[value='mit-transfer']")).toHaveCount(1);
  await applyContext(page, "mit-transfer", "transfer", "Fall 2027");
  const description = await openFact(page, "admission", "mit-transfer-description");
  await expect(description).toContainText("apply to MIT as a whole");
});

test("MIT Architecture retains official course number with localized study level", async ({ page }) => {
  await openCatalog(page, MIT, { language: "rus" });
  await searchOptions(page, "Architecture", "undergraduate");
  const architecture = page.locator('[data-study-option="mit-bs-4"]');
  await expect(architecture).toContainText("Architecture (Course 4)");
  await expect(architecture).toContainText("Бакалавриат");
  await expect(page.locator("#tab-programs")).toContainText("Программа или предмет");
});

test("MIT transfer context localizes interface and preserves the scoped original source rule", async ({ page }) => {
  await openCatalog(page, MIT, { language: "rus" });
  await chooseOption(page, "mit-course-6-3-bachelor", "Computer Science and Engineering", "undergraduate");
  await applyContext(page, "mit-transfer", "transfer", "Fall 2027");
  await expect(page.locator("#admissionsApplicant option:checked")).toHaveText("Перевод из другого вуза");
  const fact = await openFact(page, "admission", "transfer-eligibility");
  await expect(fact).toContainText("At least two full-time terms");
  await expect(fact).toContainText("committee review required");
  await openTab(page, "programs");
  await expect(page.locator("#admissionsStudyDetails")).toContainText("на языке оригинала");
});

test("MIT MFin hides raw identifiers and first-year statistics while retaining its own study rules", async ({ page }) => {
  await openCatalog(page, MIT, { language: "rus" });
  await chooseOption(page, "mit-sloan-mfin", "Master of Finance", "masters");
  await applyContext(page, "mit_sloan_mfin_admissions", "graduate", "2027 entry");
  const description = await openFact(page, "programs", "mit-sloan-mfin-description");
  await expect(description).toContainText("12- or 18-month");
  await expect(description).not.toContainText("[object Object]");
  const admission = await openFact(page, "admission", "mit_sloan_mfin_admissions-extra-requirements");
  await expect(admission).toContainText("Python proficiency is preferred");
  await expect(admission).not.toContainText(/source-[a-f0-9]+|ADMISSION ROUTE ID|PRICE FACTS|Class of 2029/);
  await expect(page.locator("#detailRequirements [data-admissions-fact='ug-sat-act-presence']")).toHaveCount(0);
});

test("MIT admission context and source finance fit a narrow dark-theme screen", async ({ page }) => {
  await openCatalog(page, MIT, { width: 390, theme: "dark" });
  await chooseOption(page, "mit-course-6-3-bachelor", "Computer Science and Engineering", "undergraduate");
  await applyContext(page, "mit-first-year", "first_year", "Fall 2027");
  await expect(page.locator("#admissionsContextApply")).toBeVisible();
  const bounds = await page.locator("#admissionsContext").boundingBox();
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(390);
  await openTab(page, "deadlines");
  await expect(page.locator("#detailDeadlines [data-admissions-fact]").first()).toBeVisible();
  await openTab(page, "finance");
  await expect(page.locator("#detailFinance [data-admissions-domain='costs']")).toBeVisible();
  await expect(page.locator("#detailFinance [data-admissions-domain='funding']")).toBeVisible();
  await expect(page.locator("#detailFinance")).toContainText("not awarded aid");
  await fitsViewport(page, 390);
});

test("reviewed programs search filters the full inventory and shows localized empty state", async ({ page }) => {
  await openCatalog(page, MIT, { language: "rus" });
  await searchOptions(page, "Physics", "undergraduate");
  await expect(page.locator("#admissionsProgramList [data-study-option]")).toHaveCount(1);
  await expect(page.locator("#admissionsProgramList [data-study-option]")).toContainText("Physics");
  await searchOptions(page, "", "undergraduate");
  await expect(page.locator("#admissionsProgramList [data-study-option]")).toHaveCount(24);
  await expect(page.locator("#admissionsNext")).toBeEnabled();
  await searchOptions(page, "zzz-no-such-program", "undergraduate");
  await expect(page.locator("#admissionsProgramList .admissions-state")).toHaveText("По этим фильтрам программы не найдены.");
  await expect(page.locator("#admissionsProgramList [data-study-option]")).toHaveCount(0);
});

test("profile major remains available through explicit catalogue search without choosing eligibility", async ({ page }) => {
  await seedProfile(page, personas.ruStemGrant.profile);
  await openCatalog(page);
  await openAdmission(page);
  await searchOptions(page, "Computer Science and Engineering", "undergraduate");
  await expect(page.locator('[data-study-option="mit-course-6-3-bachelor"]')).toBeVisible();
  await expect(page.locator("#admissionsRoute")).toHaveValue("");
  await expect(page.locator("#admissionsContext")).toContainText("No study option selected");
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("unisearch_profile")));
  expect(saved.major).toBe(personas.ruStemGrant.profile.major);
});

test("admission categories show applicable programs", async ({ page }) => {
  await page.goto("/university.html?id=astana-it-university-kaz-astana");

  await expect(page.locator("#detailCard")).toBeVisible();
  await expect(page.locator("body")).toHaveAttribute("data-page", "university");
  await expect(page.locator("#detailName")).not.toBeEmpty();
  await page.click(".d-tab-btn[data-tab='tab-admission']");

  const programs = page.locator(".admission-program-selector .admission-program-option");
  await expect(programs.first()).toBeVisible();
  await expect(programs).toContainText(["General requirements", "Computer Science"]);
});

test("admission category major tags are localized in russian", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("unisearch_ui_language_v1", "rus");
  });
  await page.goto("/university.html?id=astana-it-university-kaz-astana");

  await expect(page.locator("#detailCard")).toBeVisible();
  await expect(page.locator("body")).toHaveAttribute("data-page", "university");
  await expect(page.locator("#detailName")).not.toBeEmpty();
  await page.click(".d-tab-btn[data-tab='tab-admission']");

  const programs = page.locator(".admission-program-selector .admission-program-option");
  await expect(programs.first()).toBeVisible();
  await expect(programs).toContainText(["Общие требования", "Компьютерные науки"]);
});

test("nazarbayev university shows one admission category with requirement profiles", async ({ page }) => {
  await page.goto("/university.html?id=nazarbayev-university-kaz-astana");

  await expect(page.locator("#detailCard")).toBeVisible();
  await expect(page.locator("body")).toHaveAttribute("data-page", "university");
  await expect(page.locator("#detailName")).not.toBeEmpty();
  await expect(page.locator("#detailName")).not.toHaveText("University Name");
  const admissionTab = page.locator(".d-tab-btn[data-tab='tab-admission']");
  await expect(admissionTab).toBeVisible();
  await admissionTab.click();
  await expect(page.locator("#tab-admission")).toHaveClass(/active/);

  await expect(page.locator(".admission-category-card")).toHaveCount(1);
  await expect(page.locator(".requirement-profile-tab")).toHaveCount(3);
  await expect(page.locator(".requirement-profile-tab")).toContainText(["SAT", "ACT", "NUET"]);
  await expect(page.locator(".admission-funding-option")).toHaveCount(2);
  await expect(page.locator("#tab-admission .admission-requirement-grid")).toHaveCount(1);
  await expect(page.locator(".admission-funding-option .admission-requirement-grid")).toHaveCount(0);
  const satProfile = page.locator(".requirement-profile-tab[data-requirement-profile='nu_sat_applicants']");
  await satProfile.click();
  await expect(satProfile).toHaveAttribute("aria-selected", "true");
  const fundingNotes = page.locator(".admission-funding-diff-note");
  await expect(fundingNotes).toHaveCount(2);
  await expect(fundingNotes.nth(0)).toContainText("Fee-paying undergraduate offer in NU's SAT/ACT applicants category for applicants submitting SAT.");
  await expect(fundingNotes.nth(1)).toContainText("Abay Kunanbayev scholarship consideration for recommended international applicants submitting SAT.");
  await expect(fundingNotes.nth(1)).not.toContainText(/guaranteed|will receive|awarded/i);

  const nuetProfile = page.locator(".requirement-profile-tab[data-requirement-profile='nu_nuet_undergraduate']");
  await nuetProfile.click();
  await expect(nuetProfile).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".requirement-profile-title")).toContainText("NUET");
  await expect(page.locator(".admission-category-card")).toHaveCount(1);
  await expect(page.locator(".admission-funding-option")).toHaveCount(2);
  await expect(page.locator("#tab-admission .admission-requirement-grid")).toHaveCount(1);
  await expect(page.locator(".admission-funding-option .admission-requirement-grid")).toHaveCount(0);
  await expect(fundingNotes.nth(0)).toContainText("Fee-paying undergraduate outcome within NU's NUET-based regular admissions flow.");
  await expect(fundingNotes.nth(1)).toContainText("Grant-funded undergraduate outcome within NU's NUET-based regular admissions flow.");
  await expect(fundingNotes.nth(1)).not.toContainText(/guaranteed|will receive|awarded/i);
});

test("tsinghua admission tab keeps paid and grant options visible when profile prefers grant", async ({ page }) => {
  await seedProfile(page, personas.ruStemGrant.profile);
  await page.goto("/university.html?id=tsinghua-university-cn-beijing");

  await expect(page.locator("#detailCard")).toBeVisible();
  await expect(page.locator("body")).toHaveAttribute("data-page", "university");
  await expect(page.locator("#detailName")).not.toBeEmpty();
  await page.click(".d-tab-btn[data-tab='tab-admission']");

  const optionCards = page.locator(".admission-funding-option");
  await expect(optionCards).toHaveCount(2);
  await expect(optionCards).toContainText(["Paid", "Grant"]);
});

test("oxford admission selector narrows program-specific categories without duplicate profile cards", async ({ page }) => {
  await page.goto("/university.html?id=university-of-oxford-uk-oxford");

  await expect(page.locator("#detailCard")).toBeVisible();
  await expect(page.locator("body")).toHaveAttribute("data-page", "university");
  await expect(page.locator("#detailName")).not.toBeEmpty();
  await expect(page.locator("#detailName")).not.toBeEmpty();
  await page.click(".d-tab-btn[data-tab='tab-admission']");

  const categories = page.locator(".admission-category-card");
  await expect(categories.first()).toBeVisible();
  const initialCategoryIds = await categories.evaluateAll((nodes) => nodes.map((node) => node.dataset.admissionCategory));
  expect(initialCategoryIds.length).toBeGreaterThan(3);
  expect(new Set(initialCategoryIds).size).toBe(initialCategoryIds.length);

  await page.locator(".admission-program-option[data-admission-program='computer_science']").click();
  await expect(categories).toHaveCount(1);
  const selectedCategoryIds = await categories.evaluateAll((nodes) => nodes.map((node) => node.dataset.admissionCategory).sort());
  expect(selectedCategoryIds).toEqual([
    "university_of_oxford_uk_oxford_computer_science_undergraduate",
  ]);
  const selectedProfiles = page.locator(".requirement-profile-tab");
  await expect(selectedProfiles).toHaveCount(3);
  const profileIds = await selectedProfiles.evaluateAll((nodes) => nodes.map((node) => node.dataset.requirementProfile));
  expect(new Set(profileIds).size).toBe(profileIds.length);
  await expect(page.locator(".requirement-profile-tab")).toContainText(["A-Level", "IB", "SAT"]);
});

test("abai university admission card layout invariants", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("unisearch_ui_language_v1", "rus");
    localStorage.setItem("unisearch_theme", "dark");
  });
  await page.goto("/university.html?id=abai-kazakh-national-pedagogical-university-kaz-almaty");
  await expect(page.locator("#detailCard")).toBeVisible();
  await expect(page.locator("body")).toHaveAttribute("data-page", "university");
  await expect(page.locator("#detailName")).not.toBeEmpty();
  await page.click(".d-tab-btn[data-tab='tab-admission']");

  const programSelector = page.locator(".admission-program-selector").first();
  await expect(programSelector).toBeVisible();

  const fundingOption = page.locator(".admission-funding-option").first();
  await expect(fundingOption).toBeVisible();

  const header = fundingOption.locator(".admission-funding-option-header");
  await expect(header).toBeVisible();

  const side = header.locator(".admission-funding-option-side");
  await expect(side).toBeVisible();

  await expect(fundingOption.locator(".admission-funding-option-main")).toHaveCount(0);
  const fundingMain = page.locator(".admission-funding-option").nth(1).locator(".admission-funding-option-main");
  await expect(fundingMain).toBeVisible();
  const mainHeight = await fundingMain.evaluate((el) => el.getBoundingClientRect().height);
  expect(mainHeight).toBeLessThan(150);

});

test("abai university general tab layout invariants and spacing", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("unisearch_ui_language_v1", "rus");
    localStorage.setItem("unisearch_theme", "dark");
  });
  await page.goto("/university.html?id=abai-kazakh-national-pedagogical-university-kaz-almaty");
  await expect(page.locator("#detailCard")).toBeVisible();
  await expect(page.locator("body")).toHaveAttribute("data-page", "university");
  await expect(page.locator("#detailName")).not.toBeEmpty();

  const generalTab = page.locator("#tab-general");
  await expect(generalTab).toBeVisible();

  const boxes = generalTab.locator(".d-box");
  await expect(boxes).toHaveCount(2);

  const secondBoxBorderTop = await boxes.nth(1).evaluate((el) => window.getComputedStyle(el).borderTopWidth);
  expect(secondBoxBorderTop).toBe("0px");

  const firstBoxPaddingBottom = await boxes.nth(0).evaluate((el) => window.getComputedStyle(el).paddingBottom);
  expect(firstBoxPaddingBottom).toBe("8px");

  const secondBoxPaddingTop = await boxes.nth(1).evaluate((el) => window.getComputedStyle(el).paddingTop);
  expect(secondBoxPaddingTop).toBe("20px");

});
