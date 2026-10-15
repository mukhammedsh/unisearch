const { test, expect } = require("./helpers/coverage-test.cjs");
const { setNativeSelect } = require("./helpers/selectors");

const MIT = "mit-usa-cambridge";
const IMPERIAL = "imperial-college-london-uk";
const STANFORD = "stanford-university-usa-ca";
const ASTANA = "astana-it-university-kaz-astana";
const OXFORD = "university-of-oxford-uk-oxford";
const COMPARE_CHOICES_KEY = "unisearch_compare_admission_choices_v1";

function legacyProfile() {
  return {
    _v: 2,
    budget: 31000,
    budgetCurrency: "USD",
    gpa: 3.84,
    gpaScale: 4,
    major: "Physics",
    interests: "Keep these profile preferences.",
    studyMode: "On-campus",
    fundingType: "grant",
    studyLevel: "masters",
    applicantRoute: "graduate",
    intendedEntryCycle: "2029 entry",
    feeStatusContext: "self_reported_home_domestic",
    exams: [{ id: "ACT", exam: "ACT", score: 34, taken_on: "2026-09-10" }],
    languages: [{ code: "en", kind: "exam", exam: "IELTS", score: 7.5, taken_on: "2026-03-01" }],
    languageEvidence: [{ kind: "education", language: "en", country: "Canada", status: "completed" }],
    selectedAdmissionChoices: {
      [MIT]: { programId: "mit-bs-6-3", programName: "Computer Science", choiceKey: "mit_regular" },
      [IMPERIAL]: { programId: "imperial-computing-meng", programName: "Computing", choiceKey: "imperial_computing_2027" },
      [STANFORD]: { programId: "stanford-bs-computer-science", programName: "Computer Science", choiceKey: "stanford_standard" },
      [ASTANA]: { programId: "astana-cs", programName: "Computer Science", choiceKey: "astana_standard" },
      [OXFORD]: { programId: "oxford-cs", programName: "Computer Science", choiceKey: "oxford_standard" },
    },
  };
}

async function seedApp(page, { language = "eng", theme = "light", profile = legacyProfile(), compareChoices } = {}) {
  await page.addInitScript(({ selectedLanguage, selectedTheme, savedProfile, savedCompareChoices }) => {
    if (sessionStorage.getItem("unisearch_admissions_cutover_seeded_v1") === "1") return;
    sessionStorage.setItem("unisearch_admissions_cutover_seeded_v1", "1");
    localStorage.setItem("unisearch_ui_language_v1", selectedLanguage);
    localStorage.setItem("unisearch_theme", selectedTheme);
    localStorage.setItem("unisearch_universities_tour_seen_v1", "1");
    localStorage.setItem("unisearch_profile", JSON.stringify(savedProfile));
    if (savedCompareChoices) localStorage.setItem("unisearch_compare_admission_choices_v1", JSON.stringify(savedCompareChoices));
    localStorage.setItem("unisearch_detail_cache_v3", JSON.stringify({
      [`${MIT}::${selectedLanguage}`]: { data: { id: MIT, name: "STALE V3 DETAIL CACHE" }, etag: "stale-v3", ts: 1 },
    }));
  }, { selectedLanguage: language, selectedTheme: theme, savedProfile: profile, savedCompareChoices: compareChoices });
}

async function expectUniversityReady(page) {
  await expect(page.locator("body")).toHaveAttribute("data-page", "university");
  await expect(page.locator("#detailCard")).toBeVisible();
  await expect(page.locator("#detailName")).not.toBeEmpty();
}

async function openAdvanced(page) {
  const advanced = page.locator("#admissionsAdvanced");
  if (await advanced.count() && !(await advanced.evaluate((node) => node.open))) await advanced.locator(":scope > summary").click();
}

async function selectCustomOption(page, select, value) {
  const control = page.locator(select);
  const wrapper = control.locator("xpath=..");
  await wrapper.locator(".custom-select-trigger").click();
  await wrapper.locator(`.custom-option[data-value="${value}"]`).click();
  await expect(control).toHaveValue(value);
}

async function searchAndChooseMitCourse(page) {
  await page.locator('.d-tab-btn[data-tab="tab-programs"]').click();
  await expect(page.locator("#tab-programs")).toHaveClass(/active/);
  await setNativeSelect(page, "admissionsStudyLevel", "undergraduate");
  await page.locator("#admissionsSearch").fill("Computer Science and Engineering");
  await page.locator("#admissionsSearchSubmit").click();
  const option = page.locator('#admissionsProgramList [data-study-option="mit-course-6-3-bachelor"]');
  await expect(option).toBeVisible();
  await option.click();
  await expect(page.locator("#tab-programs")).toHaveClass(/active/);
  await expect(page.locator("#admissionsStudyDetails")).toBeVisible();
}

test("profile v2 migration resets only reviewed legacy choices and an explicit MIT save preserves global defaults", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const savedProfile = legacyProfile();
  await seedApp(page, { profile: savedProfile });
  await page.goto(`/university.html?id=${MIT}&admission_program=mit-bs-6-3`);
  await expectUniversityReady(page);
  await expect(page.locator("#tab-general")).toHaveClass(/active/);
  await page.locator('.d-tab-btn[data-tab="tab-admission"]').click();
  await expect(page.locator("#admissionsContext")).toHaveAttribute("data-state", "ready");

  await expect(page.locator("#admissionsContext [data-admission-reset-notice]")).toBeVisible();
  await expect(page.locator("#admissionsContext")).toContainText("has not been mapped to this reviewed catalog");
  await expect(page.locator("#admissionsContext")).toContainText("Choose a study option and route again");
  await expect(page.locator("#admissionsRoute")).toHaveValue("");
  await expect(page.locator("#admissionsSaveChoice")).toBeDisabled();

  let migrated = await page.evaluate(() => JSON.parse(localStorage.getItem("unisearch_profile")));
  expect(Object.keys(migrated.selectedAdmissionChoices).sort()).toEqual([ASTANA, OXFORD]);
  expect(migrated.admissionChoiceResetNotices.sort()).toEqual([MIT, IMPERIAL, STANFORD].sort());
  expect(migrated.exams[0]).toMatchObject({ id: "ACT", score: 34, taken_on: "2026-09-10" });
  expect(migrated.languages[0]).toMatchObject({ code: "en", exam: "IELTS", taken_on: "2026-03-01" });
  expect(migrated.languageEvidence[0]).toMatchObject({ language: "en", country: "Canada" });
  expect(migrated.studyLevel).toBe("masters");
  expect(migrated.applicantRoute).toBe("graduate");
  expect(migrated.intendedEntryCycle).toBe("2029 entry");
  expect(await page.evaluate(() => localStorage.getItem("unisearch_detail_cache_v3"))).toBeNull();
  await expect(page.locator("#detailCard")).not.toContainText("STALE V3 DETAIL CACHE");

  await searchAndChooseMitCourse(page);
  await page.locator("#admissionsViewRequirements").click();
  await expect(page.locator("#tab-admission")).toHaveClass(/active/);
  await selectCustomOption(page, "#admissionsRoute", "mit-first-year");
  await openAdvanced(page);
  await setNativeSelect(page, "admissionsApplicant", "first_year");
  await page.locator("#admissionsCycle").fill("Fall 2027 entry");
  await setNativeSelect(page, "admissionsFee", "unknown");
  await page.locator("#admissionsContextApply").click();
  await expect(page.locator("#admissionsContext")).toHaveAttribute("data-state", "ready");
  await expect(page.locator("#admissionsSaveChoice")).toBeEnabled();
  await page.locator("#admissionsSaveChoice").click();
  await expect(page.locator("#admissionsSaveStatus")).toHaveText("Application context saved for this university.");
  const immediateSave = await page.evaluate(() => JSON.parse(localStorage.getItem("unisearch_profile") || "{}"));
  expect(immediateSave.selectedAdmissionChoices[MIT]).toMatchObject({
    studyOptionId: "mit-course-6-3-bachelor",
    applicationRouteId: "mit-first-year",
    studyLevel: "undergraduate",
    applicantRoute: "first_year",
    intendedEntryCycle: "Fall 2027 entry",
    feeStatusContext: "unknown",
  });

  await page.reload();
  await expectUniversityReady(page);
  await expect(page.locator("#tab-admission")).toHaveClass(/active/);
  await expect(page.locator("#admissionsRoute")).toHaveValue("mit-first-year");
  await expect(page.locator("#admissionsApplicant")).toHaveValue("first_year");
  await expect(page.locator("#admissionsCycle")).toHaveValue("Fall 2027 entry");
  await expect(page.locator("#admissionsFee")).toHaveValue("unknown");
  migrated = await page.evaluate(() => JSON.parse(localStorage.getItem("unisearch_profile")));
  expect(migrated.selectedAdmissionChoices[MIT]).toMatchObject({
    studyOptionId: "mit-course-6-3-bachelor",
    applicationRouteId: "mit-first-year",
    studyLevel: "undergraduate",
    applicantRoute: "first_year",
    intendedEntryCycle: "Fall 2027 entry",
    feeStatusContext: "unknown",
  });
  expect(migrated.admissionChoiceResetNotices).not.toContain(MIT);
  expect(migrated.studyLevel).toBe("masters");
  expect(migrated.applicantRoute).toBe("graduate");
  expect(migrated.intendedEntryCycle).toBe("2029 entry");
  expect(migrated.feeStatusContext).toBe("self_reported_home_domestic");
  expect(migrated.budget).toBe(savedProfile.budget);
  expect(migrated.exams[0]).toMatchObject({ id: "ACT", score: 34, taken_on: "2026-09-10" });
  expect(migrated.selectedAdmissionChoices[ASTANA].choiceKey).toBe("astana_standard");
  expect(migrated.selectedAdmissionChoices[OXFORD].choiceKey).toBe("oxford_standard");

  const reviewedCache = await page.evaluate(() => {
    const cache = JSON.parse(localStorage.getItem("unisearch_detail_cache_v4") || "{}");
    const entry = cache["mit-usa-cambridge::eng"];
    if (!entry?.data) return false;
    entry.data.name = "STALE REVIEWED V4 CACHE MUST NOT RENDER";
    entry.ts = 0;
    localStorage.setItem("unisearch_detail_cache_v4", JSON.stringify(cache));
    return entry.data.admissions_catalog?.availability === "reviewed";
  });
  expect(reviewedCache).toBe(true);
  let rejectedDetailRequests = 0;
  await page.route((url) => new URL(url).pathname === `/universities/${MIT}`, async (route) => {
    rejectedDetailRequests += 1;
    await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ detail: "Unavailable" }) });
  });
  await page.goto(`/university.html?id=${MIT}`);
  await expect(page.locator("#detailState")).toContainText("Something Went Wrong");
  await expect(page.locator("#detailState").getByRole("button", { name: "Retry" })).toBeVisible();
  expect(rejectedDetailRequests).toBe(2);
  await expect(page.locator("#detailState")).not.toContainText("STALE REVIEWED V4 CACHE MUST NOT RENDER");
});

test("comparison purges only old reviewed pointers, keeps an unreviewed choice, and saves a selected Stanford context", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const savedProfile = legacyProfile();
  const oldCompareChoices = {
    [MIT]: { choiceKey: "mit_regular", programId: "mit-bs-6-3" },
    [IMPERIAL]: { choiceKey: "imperial_computing_2027", programId: "imperial-computing-meng" },
    [STANFORD]: { choiceKey: "stanford_standard", programId: "stanford-bs-computer-science" },
    [ASTANA]: { choiceKey: "aitu_paid::aitu_paid::aitu_paid", programId: "aitu_paid" },
  };
  await seedApp(page, { language: "rus", theme: "dark", profile: savedProfile, compareChoices: oldCompareChoices });
  await page.goto(`/compare.html?ids=${STANFORD},${ASTANA}&stage=configure`);
  await expect(page.locator("body")).toHaveAttribute("data-page", "compare");
  await expect(page.locator(".compare-config-panel")).toBeVisible();
  await expect(page.locator(".compare-config-column")).toHaveCount(2);

  const stanfordColumn = page.locator(`.compare-config-column[data-uni-id="${STANFORD}"]`);
  const astanaColumn = page.locator(`.compare-config-column[data-uni-id="${ASTANA}"]`);
  await expect(stanfordColumn.locator(`[data-admission-reset-notice="${STANFORD}"]`)).toBeVisible();
  await expect(astanaColumn.locator("[data-admission-reset-notice]")).toHaveCount(0);
  let profile = await page.evaluate(() => JSON.parse(localStorage.getItem("unisearch_profile")));
  expect(Object.keys(profile.selectedAdmissionChoices).sort()).toEqual([ASTANA, OXFORD]);
  const retainedCompareChoices = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || "{}"), COMPARE_CHOICES_KEY);
  expect(Object.keys(retainedCompareChoices)).toEqual([ASTANA]);
  expect(retainedCompareChoices[ASTANA].choiceKey).toBe("aitu_paid::aitu_paid::aitu_paid");

  const chooser = page.locator(`#compare-options-${STANFORD}`);
  await expect(chooser.locator("[data-compare-context-form]")).toBeVisible();
  await chooser.locator("[data-compare-search-form] input[type=search]").fill("Computer Science");
  await setNativeSelect(page, `compare-filter_level-${STANFORD}`, "masters");
  await chooser.locator("[data-compare-search-form]").locator("button[type=submit]").click();
  const csOption = chooser.locator('[data-compare-programs] [data-study-option="stanford-option-cs-ms"]');
  await expect(csOption).toBeVisible();
  await csOption.click();
  await expect(chooser.locator(".admissions-context__summary")).toContainText("Computer Science (MS)");
  const route = chooser.locator('select[data-context-field="application_route_id"]');
  await expect(route).toHaveValue("");
  const routeWrapper = route.locator("xpath=..");
  await routeWrapper.locator(".custom-select-trigger").click();
  await routeWrapper.locator('.custom-option[data-value="engineering-doerr-evidence:external-graduate"]').click();
  await expect(route).toHaveValue("engineering-doerr-evidence:external-graduate");
  await setNativeSelect(page, `compare-study_level-${STANFORD}`, "masters");
  await setNativeSelect(page, `compare-applicant_route-${STANFORD}`, "graduate");
  await chooser.locator(`#compare-cycle-${STANFORD}`).fill("2027-28 entry");
  await setNativeSelect(page, `compare-fee_status_context-${STANFORD}`, "unknown");
  await chooser.locator("[data-compare-context-form]").locator("button[type=submit]").click();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("unisearch_profile") || "{}").selectedAdmissionChoices?.["stanford-university-usa-ca"])).toMatchObject({
    studyOptionId: "stanford-option-cs-ms",
    applicationRouteId: "engineering-doerr-evidence:external-graduate",
    studyLevel: "masters",
    applicantRoute: "graduate",
    intendedEntryCycle: "2027-28 entry",
    feeStatusContext: "unknown",
  });
  profile = await page.evaluate(() => JSON.parse(localStorage.getItem("unisearch_profile")));
  expect(profile.studyLevel).toBe("masters");
  expect(profile.applicantRoute).toBe("graduate");
  expect(profile.intendedEntryCycle).toBe("2029 entry");
  expect(profile.feeStatusContext).toBe("self_reported_home_domestic");
  expect(profile.selectedAdmissionChoices[ASTANA].choiceKey).toBe("astana_standard");
  await page.screenshot({ path: testInfo.outputPath("admissions-cutover-compare-mobile.png"), fullPage: false });

  await page.locator('[data-action="build-compare-results"]').click();
  const reviewed = page.locator(`.compare-analysis-block[data-reviewed-context="${STANFORD}"]`);
  await expect(reviewed).toBeVisible();
  await expect(reviewed).toContainText("Computer Science (MS)");
  await expect(reviewed).not.toContainText(/stanford_standard|stanford-bs-computer-science/);
});

test("runtime availability covers 50 universities and Stanford routes stay explicit and scoped", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const profile = { ...legacyProfile(), selectedAdmissionChoices: {} };
  await seedApp(page, { profile });
  await page.goto(`/university.html?id=${STANFORD}&admission_option=stanford-option-cs-ms&admission_level=masters`);
  await expectUniversityReady(page);
  await expect(page.locator("#tab-programs")).toHaveClass(/active/);
  await page.locator("#admissionsViewRequirements").click();
  await expect(page.locator("#tab-admission")).toHaveClass(/active/);
  await expect(page.locator("#admissionsContext")).toHaveAttribute("data-state", "ready");
  await expect(page.locator("#admissionsRoute")).toHaveValue("");
  await expect(page.locator("#admissionsContext")).toContainText("Choose one of the published paths above to read its requirements and application details.");
  await expect(page.locator("#admissionsSaveChoice")).toBeDisabled();
  await expect(page.locator('#tab-admission [data-admissions-fact]')).toHaveCount(0);

  const catalog = await page.evaluate(async () => {
    const { API_BASE } = await import("/javascript/utils.js");
    const response = await fetch(`${API_BASE}/universities?page=1&limit=200&fields=card&lang=eng`);
    return { status: response.status, body: await response.json() };
  });
  expect(catalog.status).toBe(200);
  expect(catalog.body.total).toBe(50);
  expect(catalog.body.items).toHaveLength(50);
  const reviewedIds = catalog.body.items.filter((item) => item.admissions_catalog?.availability === "reviewed").map((item) => item.id).sort();
  expect(reviewedIds).toEqual([IMPERIAL, MIT, STANFORD].sort());
  expect(catalog.body.items.filter((item) => item.admissions_catalog?.availability === "legacy_unreviewed")).toHaveLength(47);

  await selectCustomOption(page, "#admissionsRoute", "engineering-doerr-evidence:external-graduate");
  await openAdvanced(page);
  await setNativeSelect(page, "admissionsApplicant", "graduate");
  await page.locator("#admissionsCycle").fill("2027-28 entry");
  await setNativeSelect(page, "admissionsFee", "unknown");
  await page.locator("#admissionsContextApply").click();
  await expectUniversityReady(page);
  await page.locator('.d-tab-btn[data-tab="tab-deadlines"]').click();
  await expect(page.locator("#tab-deadlines")).toHaveClass(/active/);
  await expect(page.locator('#tab-deadlines [data-admissions-fact="engineering-doerr-evidence:program-deadline-gre-2027"]')).toBeVisible();
  await page.locator('.d-tab-btn[data-tab="tab-admission"]').click();
  await expect(page.locator("#tab-admission")).toHaveClass(/active/);
  await expect(page.locator("#detailRequirements")).not.toContainText("0%");
  await page.locator('.d-tab-btn[data-tab="tab-finance"]').click();
  await expect(page.locator("#tab-finance")).toHaveClass(/active/);
  await expect(page.locator("#detailFinance")).toContainText("A comparable annual total is not established");
  await expect(page.locator(".finance-summary-container")).toBeHidden();
  await expect(page.locator("#admissionsSaveChoice")).toBeEnabled();
  let currentProfile = await page.evaluate(() => JSON.parse(localStorage.getItem("unisearch_profile")));
  expect(currentProfile.selectedAdmissionChoices[STANFORD]).toBeUndefined();

  await page.locator('.d-tab-btn[data-tab="tab-admission"]').click();
  await expect(page.locator("#tab-admission")).toHaveClass(/active/);
  await selectCustomOption(page, "#admissionsRoute", "engineering-doerr-evidence:cs-coterm");
  await openAdvanced(page);
  await setNativeSelect(page, "admissionsApplicant", "");
  await page.locator("#admissionsCycle").fill("2026-27 to 2027-28 entries");
  await page.locator("#admissionsContextApply").click();
  await expectUniversityReady(page);
  await page.locator('.d-tab-btn[data-tab="tab-admission"]').click();
  await expect(page.locator("#tab-admission")).toHaveClass(/active/);
  const eligibilityFact = page.locator('#tab-admission [data-admissions-fact="coterm-central-evidence:stanford-coterm-central-eligibility"]').first();
  const eligibilityGroup = eligibilityFact.locator("xpath=ancestor::details[@data-admissions-group][1]");
  if (await eligibilityGroup.count() && !(await eligibilityGroup.evaluate((node) => node.open))) await eligibilityGroup.locator(":scope > summary").click();
  await expect(eligibilityFact).toBeVisible();
  await page.locator('.d-tab-btn[data-tab="tab-deadlines"]').click();
  await expect(page.locator("#tab-deadlines")).toHaveClass(/active/);
  await expect(page.locator('#tab-deadlines [data-admissions-fact="engineering-doerr-evidence:program-deadline-gre-2027"]')).toHaveCount(0);
  currentProfile = await page.evaluate(() => JSON.parse(localStorage.getItem("unisearch_profile")));
  expect(currentProfile.selectedAdmissionChoices[STANFORD]).toBeUndefined();
  expect(currentProfile.intendedEntryCycle).toBe("2029 entry");
});
