const { test, expect } = require("./helpers/coverage-test.cjs");
const { setNativeSelect } = require("./helpers/selectors");
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
    await expect(page.locator("#admissionsContextForm")).toBeHidden();
    await expect(page.locator("#detailRequirements")).toBeEmpty();
    await page.locator("#admissionsChooseProgram").click();
    await expect(page.locator("#tab-programs")).toHaveClass(/active/);
    await setNativeSelect(page, "admissionsStudyLevel", "undergraduate");
    await page.locator("#admissionsSearch").fill(item.search);
    await page.locator("#admissionsSearchSubmit").click();
    const cs = page.locator('[data-study-option="mit-course-6-3-bachelor"]');
    await expect(cs).toBeVisible();
    const title = { eng: "Computer Science and Engineering", rus: "Компьютерные науки и инженерия", kaz: "Информатика және инженерия" }[item.language];
    await expect(cs.locator(".program-card__title")).toHaveText(title);
    await expect(cs.locator(".program-card__summary")).toContainText(/6[‑-]3/);
    if (item.language !== "eng") await expect(cs.locator(".admissions-programs__original")).toHaveText("Computer Science and Engineering (Course 6‑3)");
    await expect(page.locator("#admissionsProgramList")).not.toContainText("Political Science");
    await expect(page.locator("#admissionsProgramList")).not.toContainText("Materials Science");
    await cs.click();
    await expect(page.locator("#admissionsContext")).toHaveAttribute("data-state", "ready");
    await expect(page.locator("[data-course-code-help]")).toContainText(/Course 6[‑-]3/);
    await expect(page.locator("#admissionsReferenceSummary strong")).toHaveText(title);
    const essentials = { eng: ["4 years", "On-campus", "English"], rus: ["4 года", "Очно (кампус)", "Английский"], kaz: ["4 жыл", "Кампуста", "Ағылшын"] }[item.language];
    for (const value of essentials) await expect(page.locator("#admissionsStudyOverview .program-card-rows")).toContainText(value);
    const description = page.locator("#admissionsStudyOverview > .program-card__description");
    await expect(description).toContainText({ eng: "The degree chart", rus: "Учебный план", kaz: "Оқу бағдарламасы" }[item.language]);
    if (item.language !== "eng") {
      const original = page.locator("[data-program-original]");
      await expect(original.locator("p")).toBeHidden();
      await original.locator("summary").click();
      await expect(original.locator("p")).toContainText("The degree chart");
      await original.locator("summary").click();
    }
    fs.mkdirSync(evidenceDir, { recursive: true });
    await cs.evaluate(node => node.scrollIntoView({ block: "start" }));
    await page.screenshot({ path: path.join(evidenceDir, `${item.language}-${item.width}-program.png`) });
    await page.locator("#admissionsViewRequirements").click();
    await expect(page.locator("#tab-admission")).toHaveClass(/active/);
    await setNativeSelect(page, "admissionsRoute", "mit-first-year");
    await page.locator("#admissionsContextApply").click();
    await expect(page.locator("#admissionsContext")).toHaveAttribute("data-state", "ready");
    const academic = page.locator("#detailRequirements .admissions-reading__section").first();
    await expect(academic).toContainText(/SAT.*ACT/);
    await expect(page.locator("#detailRequirements .admissions-reading__table")).toContainText("IELTS Academic");
    await expect(page.locator("#detailRequirements .admissions-reading__table")).toContainText(/7[.,]5/);
    await expect(page.locator("#detailRequirements .admissions-reading__section")).toHaveCount(3);
    const special = page.locator('#detailRequirements [data-admissions-fact="simultaneous-sb-master-status"]');
    await expect(special).toBeHidden();
    await expect(special.locator('xpath=ancestor::*[@data-general-references]')).toHaveCount(1);
    await expect(page.locator(".admissions-application-link")).toHaveAttribute("href", "https://apply.mitadmissions.org/");
    expect(await page.locator("#detailRequirements").innerText()).not.toMatch(/Scope varies|Область применения зависит от условий|Қолданылу аясы шарттарға байланысты|Current published policy/);
    await expectNoStackedGapMargins(page, "#tab-admission");

    await page.locator("#admissionsAdvanced > summary").click();
    await setNativeSelect(page, "admissionsApplicant", "first_year");
    await page.locator("#admissionsCycle").fill("Not decided yet");
    await expect(page.locator("#admissionsCycleNotice")).toBeVisible();
    await page.locator("#admissionsCycle").fill("2027 entry");
    await expect(page.locator("#admissionsCycleNotice")).toBeHidden();
    await page.locator("#admissionsCycle").fill(item.cycle);
    await expect(page.locator("#admissionsCycleNotice")).toBeHidden();
    const response = page.waitForResponse(response => response.url().endsWith("/admissions-context") && response.request().method() === "POST");
    await page.locator("#admissionsContextApply").click();
    const resolved = await (await response).json();
    expect(resolved.context.intended_entry_cycle).toBe("Fall 2027");
    expect(resolved.facts.some(row => row.applicability.cycle === "matched")).toBe(true);
    await expect(page.locator("#admissionsContext")).toHaveAttribute("data-state", "ready");
    await page.locator("#admissionsSaveChoice").click();
    await expect(page.locator("#admissionsSaveStatus")).not.toBeEmpty();
    fs.mkdirSync(evidenceDir, { recursive: true });
    await academic.evaluate(node => node.scrollIntoView({ block: "start" }));
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
    await expect(page.locator(".admissions-reading__total")).toContainText(/92[\s,\u00a0]?760 USD/);
    await expect(page.locator("#detailFinance > .admissions-reading > .admissions-reading__section").first()).toContainText(/2026[‑-]2027/);
    const aid = page.locator("[data-aid-summary]");
    await expect(aid).toHaveCount(1);
    await expect(aid.locator("h3")).toHaveText({ eng: "Need-based financial aid", rus: "Помощь по финансовой потребности", kaz: "Қаржылық қажеттілікке негізделген көмек" }[item.language]);
    await expect(aid.locator("ol")).toContainText("CSS Profile");
    await expect(aid.locator("ol")).toContainText("IDOC");
    await expect(aid.locator("[data-aid-fafsa]")).toBeVisible();
    await expect(aid).toContainText("3514");
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
  await expect(page.locator("#admissionsContext")).toHaveAttribute("data-state", "ready");
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
