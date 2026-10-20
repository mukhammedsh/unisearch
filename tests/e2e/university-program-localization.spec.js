const { test, expect } = require("./helpers/coverage-test.cjs");
const { setNativeSelect } = require("./helpers/selectors");

const programs = [
  { university: "mit-usa-cambridge", option: "mit-course-6-3-bachelor", level: "undergraduate", official: "Computer Science and Engineering (Course 6-3)", titles: { eng: "Computer Science and Engineering", rus: "Компьютерные науки и инженерия", kaz: "Информатика және инженерия" } },
  { university: "imperial-college-london-uk", option: "imperial-option-computing-meng", level: "undergraduate", official: "Computing", titles: { eng: "Computing", rus: "Вычислительные системы", kaz: "Компьютерлік жүйелер" } },
  { university: "stanford-university-usa-ca", option: "stanford-option-cs-bs", level: "undergraduate", official: "Computer Science (BS)", titles: { eng: "Computer Science (BS)", rus: "Компьютерные науки (BS)", kaz: "Информатика (BS)" } },
];

for (const program of programs) for (const language of ["eng", "rus", "kaz"]) {
  test(`program names and search stay consistent for ${program.university} in ${language}`, async ({ page }) => {
    const width = language === "kaz" ? 390 : 1280;
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript(language => {
      localStorage.setItem("unisearch_ui_language_v1", language);
      localStorage.setItem("unisearch_theme", language === "eng" ? "light" : "dark");
    }, language);
    await page.goto(`/university.html?id=${program.university}`);
    await expect(page.locator("body")).toHaveAttribute("data-page", "university");
    await expect(page.locator("#detailCard")).toHaveClass(/is-mounted/);
    await expect(page.locator("#admissionsContext")).toHaveAttribute("data-state", "ready");
    await page.locator('[data-tab="tab-programs"]').click();
    await expect(page.locator("#tab-programs")).toHaveClass(/active/);
    await setNativeSelect(page, "admissionsStudyLevel", program.level);
    const title = program.titles[language];
    await page.locator("#admissionsSearch").fill(title);
    await page.locator("#admissionsSearchSubmit").click();
    const option = page.locator(`[data-study-option="${program.option}"]`);
    await expect(option).toBeVisible();
    await expect(option.locator(".program-card__title")).toHaveText(title);
    if (language !== "eng") await expect(option.locator(".admissions-programs__original")).toHaveText(program.official.replace(/(\d)-(?=\d)/g, "$1\u2011"));
    await option.click();
    await expect(page.locator("#admissionsContext")).toHaveAttribute("data-state", "ready");
    await expect(page.locator("#admissionsStudyTitle")).toHaveText(title);
    await expect(page.locator("#admissionsReferenceSummary strong")).toHaveText(title);
    await page.locator("#admissionsSearch").fill("no such published program");
    await page.locator("#admissionsSearchSubmit").click();
    await expect(page.locator("#admissionsProgramList [data-study-option]")).toHaveCount(0);
    await expect(page.locator("#admissionsSelectedProgram")).toBeVisible();
    await expect(page.locator("#admissionsSelectedProgram .program-card__title")).toHaveText(title);
    await expect(page.locator("#admissionsStudyDetails")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  });
}
