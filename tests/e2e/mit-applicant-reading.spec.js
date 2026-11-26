const { test, expect } = require("./helpers/coverage-test.cjs");
const { openAdmissionSelectionEditor, revealRestrictedProgram, setNativeSelect } = require("./helpers/selectors");
const { expectNoStackedGapMargins } = require("./helpers/design");
const fs = require("node:fs");
const path = require("node:path");

const evidenceDir = path.resolve(__dirname, "../../output/playwright/mit-applicant-reading");
const cases = [
  { language: "eng", lang: "en", width: 1280, theme: "light", search: "Computer Science", cycle: "Fall 2027" },
  { language: "eng", lang: "en", width: 390, theme: "dark", search: "Computer Science", cycle: "Fall 2027" },
  { language: "rus", lang: "ru", width: 1280, theme: "dark", search: "компьютерные науки", cycle: "осенний набор 2027 года" },
  { language: "rus", lang: "ru", width: 390, theme: "light", search: "компьютерные науки", cycle: "осенний набор 2027 года" },
  { language: "kaz", lang: "kk", width: 1280, theme: "light", search: "компьютерлік ғылым", cycle: "2027 жылғы күзгі қабылдау" },
  { language: "kaz", lang: "kk", width: 390, theme: "dark", search: "компьютерлік ғылым", cycle: "2027 жылғы күзгі қабылдау" },
];

async function tab(page, name) {
  await page.locator(`[data-tab="tab-${name}"]`).click();
  await expect(page.locator(`#tab-${name}`)).toHaveClass(/active/);
}

for (const item of cases) {
  test(`MIT answers applicant questions in ${item.language}, ${item.width}px, ${item.theme}`, async ({ page }) => {
    await page.setViewportSize({ width: item.width, height: 900 });
    await page.addInitScript(({ language, theme }) => {
      localStorage.setItem("unisearch_ui_language_v1", language);
      localStorage.setItem("unisearch_theme", theme);
    }, item);
    await page.goto("/university.html?id=mit-usa-cambridge");
    await expect(page.locator("body")).toHaveAttribute("data-page", "university");
    await expect(page.locator("#detailCard")).toHaveClass(/is-mounted/);
    await expect(page.locator("html")).toHaveAttribute("lang", item.lang);
    await expect(page.locator("#admissionsContext")).toHaveAttribute("data-state", "ready");
    if (item.width < 768) {
      const before = await page.locator(".d-tabs").evaluate(node => node.scrollLeft);
      await page.locator("[data-tabs-next]").click();
      await expect.poll(() => page.locator(".d-tabs").evaluate(node => node.scrollLeft)).toBeGreaterThan(before);
    }
    await tab(page, "admission");
    // The Admission tab opens on MIT's shared first-year path by default, so requirements are readable at once.
    await expect(page.locator("#admissionsContextForm")).toBeHidden();
    await expect(page.locator("#admissionsRoute")).toHaveValue("mit-first-year");
    await expect(page.locator("#detailRequirements [data-admissions-key-facts]")).toBeVisible();
    await expect(page.locator("#detailRequirements .admissions-reading__section").first()).toBeVisible();
    await openAdmissionSelectionEditor(page);
    await page.locator("#admissionsChooseProgram").click();
    await expect(page.locator("#tab-programs")).toHaveClass(/active/);
    await setNativeSelect(page, "admissionsStudyLevel", "undergraduate");
    await page.locator("#admissionsSearch").fill(item.search);
    const programSearchResponse = page.waitForResponse(response => {
      const url = new URL(response.url());
      return url.pathname.endsWith("/study-options") && response.request().method() === "GET"
        && url.searchParams.get("search") === item.search && url.searchParams.get("study_level") === "undergraduate";
    });
    await page.locator("#admissionsSearchSubmit").click();
    expect((await programSearchResponse).ok()).toBe(true);
    await expect(page.locator("#admissionsSearchSubmit")).toBeEnabled();
    const cs = page.locator('[data-study-option="mit-course-6-3-bachelor"]');
    await revealRestrictedProgram(cs);
    await expect(cs).toBeVisible();
    const title = { eng: "Computer Science and Engineering", rus: "Компьютерные науки и инженерия", kaz: "Информатика және инженерия" }[item.language];
    await expect(cs.locator(".program-card__title")).toHaveText(title);
    await expect(cs.locator(".program-card__summary")).toContainText(/6[‑-]3/);
    if (item.language !== "eng") await expect(cs.locator(".admissions-programs__original")).toHaveText("Computer Science and Engineering (Course 6‑3)");
    await expect(page.locator("#admissionsProgramList")).not.toContainText("Political Science");
    await expect(page.locator("#admissionsProgramList")).not.toContainText("Materials Science");
    await cs.click();
    await cs.locator("xpath=..").locator("[data-select-study-option]").click();
    await expect(page.locator("#admissionsContext")).toHaveAttribute("data-state", "ready");
    await expect(page.locator("#tab-admission")).toHaveClass(/active/);
    await tab(page, "programs");
    await expect(page.locator("#admissionsStudySources .admissions-programs__references")).toBeVisible();
    await expect(page.locator("#admissionsReferenceSummary strong")).toHaveText(title);
    const essentials = { eng: ["4 years", "On-campus", "English"], rus: ["4 года", "Очно (кампус)", "Английский"], kaz: ["4 жыл", "Кампуста", "Ағылшын"] }[item.language];
    for (const value of essentials) await expect(page.locator("#admissionsStudyOverview .program-card-rows")).toContainText(value);
    const description = page.locator("#admissionsStudyOverview > .program-card__description");
    await expect(description).toContainText({ eng: "The degree chart", rus: "Учебный план", kaz: "Оқу бағдарламасы" }[item.language]);
    const programSources = page.locator("#admissionsStudySources .admissions-programs__references");
    await programSources.locator(":scope > summary").click();
    await expect(programSources.locator("a")).not.toHaveCount(0);
    await expect(programSources.locator("[data-program-overview-sources] p")).toHaveCount(0);
    await programSources.locator(":scope > summary").click();
    fs.mkdirSync(evidenceDir, { recursive: true });
    await cs.evaluate(node => node.scrollIntoView({ block: "start" }));
    await page.screenshot({ path: path.join(evidenceDir, `${item.language}-${item.width}-program.png`) });
    await page.locator('.d-tab-btn[data-tab="tab-admission"]').click();
    await expect(page.locator("#tab-admission")).toHaveClass(/active/);
    await setNativeSelect(page, "admissionsRoute", "mit-first-year");
    await expect(page.locator("#admissionsContext")).toHaveAttribute("data-state", "ready");
    const keyFacts = page.locator("#detailRequirements [data-admissions-key-facts]");
    await expect(keyFacts).toContainText(/SAT.*ACT/);
    await expect(page.locator("#detailRequirements .admissions-reading__section > h3").filter({ hasText: /Academic tests|Академические экзамены|Академиялық/ })).toHaveCount(0);
    await expect(page.locator("#detailRequirements .admissions-reading__table")).toContainText("IELTS Academic");
    await expect(page.locator("#detailRequirements .admissions-reading__table")).toContainText(/7[.,]5/);
    await expect(page.locator('#detailRequirements [data-source-summary="requirements"]')).toContainText({ eng: "recommended preparation", rus: "рекомендуемую подготовку", kaz: "ұсынылатын даярлықты" }[item.language]);
    await expect(page.locator('#detailRequirements [data-source-summary="application"]')).toContainText({ eng: "MIT as a whole", rus: "MIT целиком", kaz: "MIT-ке тұтас" }[item.language]);
    const special = page.locator('#detailRequirements [data-admissions-fact="simultaneous-sb-master-status"]');
    await expect(special).toBeHidden();
    await expect(special.locator('xpath=ancestor::*[@data-general-references]')).toHaveCount(1);
    await expect(page.locator(".admissions-application-link")).toHaveAttribute("href", "https://apply.mitadmissions.org/");
    expect(await page.locator("#detailRequirements").innerText()).not.toMatch(/Scope varies|Область применения зависит от условий|Қолданылу аясы шарттарға байланысты|Current published policy/);
    await expectNoStackedGapMargins(page, "#tab-admission");

    // First-year publishes one set of yearless dates and no fee classes, so the page asks for neither.
    await openAdmissionSelectionEditor(page);
    await expect(page.locator("#admissionsAdvanced")).toBeHidden();
    await expect(page.locator("#admissionsContextApply")).toBeHidden();
    await expect(page.locator("#admissionsContext")).toHaveAttribute("data-state", "ready");
    await page.locator("#admissionsSaveChoice").click();
    await expect(page.locator("#admissionsSaveStatus")).not.toBeEmpty();
    fs.mkdirSync(evidenceDir, { recursive: true });
    await keyFacts.evaluate(node => node.scrollIntoView({ block: "start" }));
    await page.screenshot({ path: path.join(evidenceDir, `${item.language}-${item.width}-requirements.png`) });

    await tab(page, "deadlines");
    const dates = page.locator("#detailDeadlines .admissions-reading__table").first();
    await expect(dates).toContainText("Early Action");
    await expect(dates).toContainText("Regular Action");
    if (item.language === "kaz") {
      await expect(dates).toContainText("1 қараша");
      await expect(dates).not.toContainText(/\bM(?:0[1-9]|1[0-2])\b/);
    }
    await expect(dates).not.toContainText("2027");
    await expectNoStackedGapMargins(page, "#tab-deadlines");
    await dates.evaluate(node => node.scrollIntoView({ block: "start" }));
    await page.screenshot({ path: path.join(evidenceDir, `${item.language}-${item.width}-dates.png`) });
    await tab(page, "finance");
    await expect(page.locator(".admissions-reading__total")).toContainText(/\$92[,\u00a0 ]760/);
    await expect(page.locator("#detailFinance > .admissions-reading > .admissions-reading__section").first()).toContainText(/2026[-‑–]2027/);
    const aid = page.locator("[data-aid-summary]");
    await expect(aid).toHaveCount(1);
    await expect(aid.locator("h3")).toHaveText({ eng: "Need-based financial aid", rus: "Помощь по финансовой потребности", kaz: "Қаржылық қажеттілікке негізделген көмек" }[item.language]);
    await expect(aid.locator("ol")).toContainText("CSS Profile");
    await expect(aid.locator("ol")).toContainText("IDOC");
    await expect(aid.locator("[data-aid-fafsa]")).toBeVisible();
    await expect(aid).toContainText("3514");
    await expect(aid).toContainText({ eng: "not awarded aid", rus: "не считается предоставленной помощью", kaz: "тағайындалған көмек емес" }[item.language]);
    await aid.locator("h3").evaluate(node => node.scrollIntoView({ block: "start" }));
    await page.screenshot({ path: path.join(evidenceDir, `${item.language}-${item.width}-aid.png`) });
    await expectNoStackedGapMargins(page, "#tab-finance");
    await page.locator(".admissions-reading__total").evaluate(node => node.scrollIntoView({ block: "center" }));
    await page.screenshot({ path: path.join(evidenceDir, `${item.language}-${item.width}-costs.png`) });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(item.width);
    if (item.width < 768) {
      await expect(page.locator("[data-tabs-previous]")).toBeVisible();
      await expect(page.locator("[data-tabs-next]")).toBeVisible();
    }
  });
}

test("changing language preserves program search, browsing level and admission selection", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("unisearch_ui_language_v1", "rus"));
  await page.goto("/university.html?id=mit-usa-cambridge");
  await expect(page.locator("body")).toHaveAttribute("data-page", "university");
  await expect(page.locator("#admissionsContext")).toHaveAttribute("data-state", "ready");
  await tab(page, "programs");
  await setNativeSelect(page, "admissionsStudyLevel", "undergraduate");
  await page.locator("#admissionsSearch").fill("компьютерные науки");
  await page.locator("#admissionsSearchSubmit").click();
  const cs = page.locator('[data-study-option="mit-course-6-3-bachelor"]');
  await expect(cs).toBeVisible();
  await cs.click();
  await cs.locator("xpath=..").locator("[data-select-study-option]").click();
  await expect(page.locator("#admissionsContext")).toHaveAttribute("data-state", "ready");
  await expect(page.locator("#tab-admission")).toHaveClass(/active/);
  await tab(page, "programs");
  const url = page.url();
  for (const [language, code] of [["kaz", "kk"], ["eng", "en"], ["rus", "ru"]]) {
    const select = page.locator("#languageSelect");
    const wrapper = select.locator("xpath=..");
    await wrapper.locator(".custom-select-trigger").click();
    await wrapper.locator(`.custom-option[data-value="${language}"]`).click();
    await expect(page.locator("html")).toHaveAttribute("lang", code);
    await expect(select).toBeEnabled();
    await expect(page.locator("#detailCard")).not.toHaveClass(/is-language-refreshing/);
    await expect(page.locator("#admissionsSearch")).toHaveValue("компьютерные науки");
    await expect(page.locator("#admissionsStudyLevel")).toHaveValue("undergraduate");
    await expect(cs).toBeVisible();
    await expect(cs).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator("#admissionsProgramList")).not.toContainText("Political Science");
    expect(page.url()).toBe(url);
  }
});

test("MIT's English-test recommendation links to the profile when unscored and marks met or below when scored", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("unisearch_ui_language_v1", "eng");
    // Seeded once, so later steps can change the stored profile across reloads.
    if (!localStorage.getItem("unisearch_profile")) localStorage.setItem("unisearch_profile", JSON.stringify({ _v: 2,
      exams: [{ id: "SAT", exam: "SAT", score: 1300 }], languages: [] }));
  });
  await page.goto("/university.html?id=mit-usa-cambridge&admission_application_route=mit-first-year&admission_level=undergraduate#tab-admission");
  await expect(page.locator("#admissionsContext")).toHaveAttribute("data-state", "ready");
  const recommendation = page.locator("[data-key-fact='requirements'] li[data-recommendation]");
  await expect(recommendation).toHaveAttribute("data-mark", "recommended");
  await expect(recommendation).toContainText("English test (optional): IELTS Academic — minimum 7.0, recommended 7.5");
  await expect(recommendation).toContainText("Strongly recommended");
  // The check records stay behind the closed Sources disclosure.
  await expect(page.locator("[data-admissions-key-facts] .admissions-catalog__assessment-detail")).toHaveCount(0);
  await expect(page.locator("#detailRequirements details[data-all-records]")).not.toHaveAttribute("open", "");
  await recommendation.getByRole("link", { name: "Add language details in profile" }).click();
  await expect(page.locator("body")).toHaveAttribute("data-page", "profile");
  // A new "native" entry opens without choosing the language for the applicant.
  await expect(page.locator("#langKind")).toHaveValue("native");
  await expect(page.locator("#languagesBlock")).toBeInViewport();

  // Adding IELTS >= 7.0 marks the recommendation as met without showing a profile hint; IELTS < 7.0 marks it below.
  await page.goto("/university.html?id=mit-usa-cambridge&admission_application_route=mit-first-year&admission_level=undergraduate#tab-admission");
  await expect(page.locator("#admissionsContext")).toHaveAttribute("data-state", "ready");
  await page.evaluate(() => {
    const profile = JSON.parse(localStorage.getItem("unisearch_profile"));
    profile.languages.push({ code: "en", kind: "exam", exam: "IELTS", score: 7.5 });
    localStorage.setItem("unisearch_profile", JSON.stringify(profile));
  });
  await page.reload();
  await expect(page.locator("#admissionsContext")).toHaveAttribute("data-state", "ready");
  await expect(recommendation).toHaveAttribute("data-mark", "met");
  await expect(recommendation).toContainText("You have: IELTS Academic 7.5");
  await expect(recommendation.getByRole("link")).toHaveCount(0);

  await page.evaluate(() => {
    const profile = JSON.parse(localStorage.getItem("unisearch_profile"));
    profile.languages = [{ code: "en", kind: "exam", exam: "IELTS", score: 6.5 }];
    localStorage.setItem("unisearch_profile", JSON.stringify(profile));
  });
  await page.reload();
  await expect(page.locator("#admissionsContext")).toHaveAttribute("data-state", "ready");
  await expect(recommendation).toHaveAttribute("data-mark", "below");
  await expect(recommendation).toContainText("You have: IELTS Academic 6.5, below the minimum");
  await expect(recommendation.getByRole("link")).toHaveCount(0);

  await page.evaluate(() => {
    const profile = JSON.parse(localStorage.getItem("unisearch_profile"));
    profile.languages.push({ code: "en", kind: "native" });
    localStorage.setItem("unisearch_profile", JSON.stringify(profile));
  });
  await page.reload();
  await expect(page.locator("#admissionsContext")).toHaveAttribute("data-state", "ready");
  await expect(page.locator("[data-key-fact='requirements'] li[data-mark]").first()).toBeVisible();
  await expect(recommendation).toHaveCount(0);
});

test("a profile link to an English test opens it with the section scores right below the overall score", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("unisearch_ui_language_v1", "eng");
    localStorage.setItem("unisearch_profile", JSON.stringify({ _v: 2, languages: [{ code: "en", kind: "exam", exam: "IELTS", score: 6.5 }] }));
  });
  await page.goto("/profile.html?language_exam=IELTS");
  await expect(page.locator("#langExam")).toHaveValue("IELTS");
  await expect(page.locator("#langExamScore")).toHaveValue("6.5");
  const listening = page.locator('[data-lang-breakdown-input="IELTS_LISTENING"]');
  await expect(listening).toBeFocused();
  await expect(page.locator(".profile-lang-sections legend")).toHaveText("Section scores (if your report shows them)");
  const score = await page.locator("#langExamScore").boundingBox();
  const sections = await page.locator("#langExamSpecialContainer").boundingBox();
  const date = await page.locator("#langExamTakenOn").boundingBox();
  expect(sections.y).toBeGreaterThan(score.y);
  expect(date.y).toBeGreaterThan(sections.y);
});
