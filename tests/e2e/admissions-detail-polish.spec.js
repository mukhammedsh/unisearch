const { test, expect } = require("./helpers/coverage-test.cjs");
const fs = require("node:fs/promises");

async function openUniversity(page, id, { language = "rus", theme = "dark", width = 390, query = "" } = {}) {
  await page.setViewportSize({ width, height: 900 });
  await page.addInitScript(({ language, theme }) => {
    localStorage.setItem("unisearch_ui_language_v1", language);
    localStorage.setItem("unisearch_theme", theme);
    localStorage.setItem("unisearch_universities_tour_seen_v1", "1");
  }, { language, theme });
  await page.goto(`/university.html?id=${id}${query}`);
  await expect(page.locator("body")).toHaveAttribute("data-page", "university");
  await expect(page.locator("#detailCard")).toHaveClass(/is-mounted/);
  await expect(page.locator("#admissionsContext")).toHaveAttribute("data-state", "ready");
  await expect(page.locator("#admissionsSearchSubmit")).toBeEnabled();
}

async function tab(page, name) {
  await page.locator(`[data-tab="tab-${name}"]`).click();
  await expect(page.locator(`#tab-${name}`)).toHaveClass(/active/);
}

async function noOverflow(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

test("shared MIT route is compact, editable by keyboard, saved and exports its own calendar", async ({ page }, testInfo) => {
  await openUniversity(page, "mit-usa-cambridge");
  await tab(page, "admission");
  await page.locator('[data-shared-route="mit-first-year"]').click();
  await expect(page.locator("#admissionsContext")).toHaveAttribute("data-state", "ready");
  await expect(page.locator("#admissionsReferenceSummary")).toContainText("Первый курс после школы");
  await expect(page.locator("#admissionsReferenceSummary")).not.toContainText("Сменить программу");
  await expect(page.locator("#admissionsSelectionEditor")).toBeHidden();
  await expect(page.locator("[data-shared-admission]")).toBeHidden();
  await expect(page.locator("#admissionsAdvanced")).not.toHaveAttribute("open");
  await expect(page.locator("#detailRequirements [data-admissions-fact]").first()).toBeVisible();
  await page.locator("#admissionsReferenceSummary").scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("mit-compact-mobile-dark-ru.png") });
  const edit = page.locator("#admissionsReferenceSummary button");
  await edit.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#admissionsSelectionEditor")).toBeVisible();
  await page.locator("#admissionsAdvanced > summary").click();
  await page.locator("#admissionsCycle").fill("not a cycle");
  await expect(page.locator("#admissionsCycleNotice")).toBeVisible();
  await expect(page.locator("#admissionsSaveChoice")).toBeDisabled();
  await page.locator("#admissionsCycle").fill("осенний набор 2027");
  await expect(page.locator("#admissionsCycleNotice")).toBeHidden();
  await page.locator("#admissionsContextApply").click();
  await expect(page.locator("#admissionsContext")).toHaveAttribute("data-state", "ready");
  await expect(page.locator("#admissionsCycle")).toHaveValue("Fall 2027");
  await expect(page.locator("#admissionsSelectionEditor")).toBeHidden();
  await page.locator("#admissionsReferenceSummary button").click();
  await page.locator('[data-shared-route="mit-transfer"]').click();
  await expect(page.locator("#admissionsContext")).toHaveAttribute("data-state", "ready");
  await expect(page.locator("#admissionsRoute")).toHaveValue("mit-transfer");
  await page.locator("#admissionsSaveChoice").click();
  await page.reload();
  await expect(page.locator("#admissionsRoute")).toHaveValue("mit-transfer");
  await tab(page, "deadlines");
  const exportButton = page.locator("[data-calendar-export]").first();
  await expect(exportButton).toBeEnabled();
  const download = page.waitForEvent("download");
  await exportButton.click();
  const file = await download;
  const ics = await fs.readFile(await file.path(), "utf8");
  expect(ics).toContain("BEGIN:VCALENDAR");
  expect(ics).toMatch(/DTSTART;VALUE=DATE:20270301/);
  const contrast = await page.locator(".deadline-calendar__details a").first().evaluate(link => {
    const rgb = value => value.match(/[\d.]+/g).slice(0, 3).map(Number);
    const luminance = color => rgb(color).map(value => value / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
    const a = luminance(getComputedStyle(link).color);
    const b = luminance(getComputedStyle(link.closest(".deadline-calendar__details")).backgroundColor);
    return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
  });
  expect(contrast).toBeGreaterThanOrEqual(4.5);
  await page.locator(".deadline-calendar").scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("mit-calendar-mobile-dark-ru.png") });
  await noOverflow(page);
});

for (const appearance of [{ language: "kaz", theme: "light", width: 390 }, { language: "rus", theme: "dark", width: 1440 }]) {
test(`Imperial course titles distinguish BEng and MEng and retain duration and fee sources (${appearance.language}, ${appearance.width})`, async ({ page }, testInfo) => {
  await page.addInitScript(() => localStorage.setItem("unisearch_profile", JSON.stringify({ _v: 2, studyLevel: "Bachelor", major: "Computer Science" })));
  await openUniversity(page, "imperial-college-london-uk", appearance);
  await tab(page, "programs");
  await page.locator("#admissionsSearch").fill("Computing");
  await page.locator("#admissionsSearchSubmit").click();
  const beng = page.locator('[data-study-option="imperial-option-computing-beng"]');
  const meng = page.locator('[data-study-option="imperial-option-computing-meng"]');
  await expect(beng.locator(".program-card__title")).toContainText("(BEng)");
  await expect(meng.locator(".program-card__title")).toContainText("(MEng)");
  await page.locator("#admissionsSearchForm").scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath(`imperial-programs-${appearance.width}-${appearance.theme}-${appearance.language}.png`) });
  await meng.click();
  await page.locator('[data-select-study-option="imperial-option-computing-meng"]').click();
  await expect(page.locator("#admissionsContext")).toHaveAttribute("data-state", "ready");
  await expect(page.locator("#admissionsStudyOverview")).toContainText(appearance.language === "kaz" ? "біріктірілген бакалавриат бағдарламасы" : "интегрированная программа бакалавриата");
  await expect(page.locator("#admissionsStudyOverview")).toContainText("4");
  await tab(page, "admission");
  await page.locator(".custom-select-wrapper:has(#admissionsRoute) .custom-select-trigger").click();
  await page.locator('.custom-select-wrapper:has(#admissionsRoute) .custom-option[data-value="procedure-computing-meng"]').click();
  await expect(page.locator("#admissionsContext")).toHaveAttribute("data-state", "ready");
  await expect(page.locator("#admissionsRoute")).toHaveValue("procedure-computing-meng");
  await expect(page.locator("#admissionsSelectionEditor")).toBeHidden();
  await tab(page, "finance");
  await expect(page.locator("[data-course-tuition]")).toContainText("Home");
  await expect(page.locator("[data-course-tuition]")).toContainText("Overseas");
  await expect(page.locator("[data-course-tuition] a").first()).toHaveAttribute("href", /^https:\/\/www\.imperial\.ac\.uk\//);
  await page.locator("#detailFinance").scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath(`imperial-finance-${appearance.width}-${appearance.theme}-${appearance.language}.png`) });
  await noOverflow(page);
});
}

for (const appearance of [{ theme: "light", width: 390 }, { theme: "dark", width: 1440 }]) {
test(`Stanford groups four special situations and preserves internal selection through save, reload and back (${appearance.theme}, ${appearance.width})`, async ({ page }, testInfo) => {
  await openUniversity(page, "stanford-university-usa-ca", { ...appearance, query: "&admission_option=stanford-option-cs-ms&admission_level=masters&admission_application_route=" });
  await tab(page, "admission");
  await expect(page.locator("[data-read-route]")).toHaveCount(5);
  await expect(page.locator("[data-read-route]:visible")).toHaveCount(1);
  const group = page.locator(".admissions-special-routes");
  await expect(group.locator("summary")).toContainText("(4)");
  await page.locator("#admissionsContext").scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath(`stanford-routes-${appearance.width}-${appearance.theme}-ru.png`) });
  await group.locator("summary").focus();
  await page.keyboard.press("Enter");
  await expect(group).toHaveAttribute("open", "");
  const internal = page.locator('[data-read-route="engineering-doerr-evidence:cs-corresponding-phd-added-ms"]');
  await expect(internal.locator("xpath=../..")).toContainText("не внешняя заявка");
  await internal.click();
  await expect(page.locator("#admissionsContext")).toHaveAttribute("data-state", "ready");
  await expect(page.locator("[data-route-audience]")).toContainText("не внешняя заявка");
  await expect(page.locator("#admissionsSaveChoice")).toBeEnabled();
  await page.locator("#admissionsSaveChoice").click();
  const savedUrl = page.url();
  await page.reload();
  await expect(page.locator("#admissionsRoute")).toHaveValue("engineering-doerr-evidence:cs-corresponding-phd-added-ms");
  await tab(page, "admission");
  await page.locator("#admissionsReferenceSummary button").click();
  await expect(page.locator("#admissionsSelectionEditor")).toBeVisible();
  await page.goto(savedUrl.replace("engineering-doerr-evidence%3Acs-corresponding-phd-added-ms", "directory-evidence%3Astanford-graduate-cs-ms"));
  await expect(page.locator("#admissionsRoute")).toHaveValue("directory-evidence:stanford-graduate-cs-ms");
  await page.goBack();
  await expect(page.locator("#admissionsRoute")).toHaveValue("engineering-doerr-evidence:cs-corresponding-phd-added-ms");
  await noOverflow(page);
});
}

test("English desktop MIT finance retains breakdown, dated period, exclusions, aid and complete source records", async ({ page }, testInfo) => {
  await openUniversity(page, "mit-usa-cambridge", { language: "eng", theme: "light", width: 1440, query: "&admission_application_route=mit-first-year&admission_level=undergraduate&admission_cycle=2027%20entry" });
  await tab(page, "finance");
  const finance = page.locator("#detailFinance");
  await expect(finance).toContainText("Tuition is one part of the budget");
  await expect(finance).toContainText("not a confirmed price for another entry cycle");
  await expect(finance.locator(".admissions-reading__costs")).toContainText("Housing");
  await expect(finance).toContainText("not awarded aid");
  const records = finance.locator(".admissions-reading__references").first();
  await records.locator(":scope > summary").click();
  await expect(records.locator("[data-admissions-fact]").first()).toBeVisible();
  await expect(records.locator("a").first()).toHaveAttribute("href", /^https:\/\//);
  await finance.locator("[data-finance-scope]").scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("mit-finance-desktop-light-en.png") });
  await noOverflow(page);
});

test("MIT internal programs preserve access restrictions without leaking unknown format tokens", async ({ page }, testInfo) => {
  await page.addInitScript(() => localStorage.setItem("unisearch_profile", JSON.stringify({ _v: 2, studyLevel: "Master", major: "Computer Science" })));
  await openUniversity(page, "mit-usa-cambridge", { width: 1440, theme: "light" });
  await tab(page, "programs");
  const restricted = page.locator(".admissions-programs__restricted");
  await expect(restricted).toBeVisible();
  await restricted.locator(":scope > summary").click();
  await expect(page.locator("#admissionsProgramList")).not.toContainText("not_stated");
  await expect(page.locator('[data-study-option="mit-course-6-7p-meng"]')).toContainText("внутреннее продолжение");
  await restricted.scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("mit-internal-programs-desktop-light-ru.png") });
  await page.locator('[data-study-option="mit-course-6-7p-meng"]').click();
  await page.locator('[data-select-study-option="mit-course-6-7p-meng"]').click();
  await expect(page.locator("#admissionsContext")).toHaveAttribute("data-state", "ready");
  await expect(page.locator("#admissionsStudyOverview")).toContainText("Магистр инженерии");
  await expect(page.locator("#admissionsStudyOverview")).not.toContainText("интегрированная программа бакалавриата");
  await expect(page.locator("#admissionsStudyOverview")).not.toContainText("not_stated");
  await noOverflow(page);
});
