const { test, expect } = require("@playwright/test");
const { personas, seedProfile } = require("./helpers/personas");

for (const [programId, width, descriptionText] of [
  ["mit-bs-6-5", 1280, "программирование"],
  ["mit-bs-21e", 390, "гуманитар"],
]) {
  test(`MIT ${programId} shows a sourced Russian study summary and shared admission route`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript(() => localStorage.setItem("unisearch_ui_language_v1", "rus"));
    await page.goto("/university.html?id=mit-usa-cambridge");
    await expect(page.locator("#detailName")).not.toBeEmpty();
    await page.locator(".d-tab-btn[data-tab='tab-programs']").click();
    const program = page.locator(".program-card", { has: page.locator(`[data-program-admission='${programId}']`) });
    await program.locator("[data-program-toggle]").click();
    await expect(program.locator(".program-card__description")).toContainText(descriptionText);
    await expect(program.locator(".program-card__source[href*='catalog.mit.edu/degree-charts/']")).toBeVisible();
    await expect(program.locator(".program-card__route-note")).toContainText("в университет в целом");
    await program.locator("[data-program-admission]").click();
    await expect(page).toHaveURL(new RegExp(`admission_program=${programId}`));
    await expect(page.locator("#tab-admission [data-admission-category='mit_regular']")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  });
}

for (const [programId, width, language, descriptionText] of [
  ["mit-course-6-7p-meng", 1280, "eng", "related MIT Course"],
  ["mit-course-6-14p-meng", 390, "rus", "бакалаврскую степень MIT по Course"],
]) {
  test(`MIT ${programId} opens the internal EECS MEng route`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript((selectedLanguage) => localStorage.setItem("unisearch_ui_language_v1", selectedLanguage), language);
    await page.goto("/university.html?id=mit-usa-cambridge");
    await expect(page.locator("#detailCard")).toBeVisible();
    await expect(page.locator("#detailName")).toBeVisible();
    if (width === 390) {
      const titleWidth = await page.locator("#detailName").evaluate((node) => node.getBoundingClientRect().width);
      expect(titleWidth).toBeGreaterThan(width * 0.7);
    }
    await page.locator(".d-tab-btn[data-tab='tab-programs']").click();
    await page.locator("#tab-programs [data-program-level='master']").click();
    const program = page.locator(".program-card", { has: page.locator(`[data-program-admission='${programId}']`) });
    await program.locator("[data-program-toggle]").click();
    await expect(program.locator(".program-card__description")).toContainText(descriptionText);
    if (language === "rus") await expect(program).toContainText("Кафедра электротехники и компьютерных наук");
    await expect(program.locator(".program-card__source[href*='catalog.mit.edu/degree-charts/']")).toBeVisible();
    await program.locator("[data-program-admission]").click();
    await expect(page).toHaveURL(new RegExp(`admission_program=${programId}`));
    await expect(page.locator("#tab-admission [data-admission-category='mit_eecs_meng_admissions']")).toBeVisible();
    if (language === "rus") {
      await expect(page.locator("#tab-admission [data-admission-category='mit_eecs_meng_admissions']")).toContainText("Внутренняя программа MEng");
    }
    await expect(page.locator("#tab-admission [data-admission-category='mit_regular']")).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  });
}

for (const [width, language, theme] of [
  [1280, "eng", "light"],
  [390, "rus", "dark"],
]) {
  test(`MIT Course 6-9P shows unassessed GPA minimums at ${width}px in ${language} ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript(({ language, theme }) => {
      localStorage.setItem("unisearch_ui_language_v1", language);
      localStorage.setItem("unisearch_theme", theme);
    }, { language, theme });
    await page.goto("/university.html?id=mit-usa-cambridge");
    await expect(page.locator("#detailName")).not.toBeEmpty();
    await page.locator(".d-tab-btn[data-tab='tab-programs']").click();
    await page.locator("#tab-programs [data-program-level='master']").click();
    const program = page.locator(".program-card", { has: page.locator("[data-program-admission='mit-course-6-9p-meng']") });
    await program.locator("[data-program-toggle]").click();
    await expect(program.locator(".program-card__description")).toContainText(language === "rus" ? "только для действующих студентов Course 6" : "current MIT Course 6");
    await program.locator("[data-program-admission]").click();
    const route = page.locator("#tab-admission [data-admission-category='mit_bcs_meng_admissions']");
    await expect(route).toBeVisible();
    await expect(page.locator("#tab-admission [data-admission-category='mit_eecs_meng_admissions']")).toHaveCount(0);
    const minimumText = language === "rus" ? "4,25/5,0" : "4.25/5.0";
    await expect(route).toContainText(minimumText);
    await expect(route).toContainText(language === "rus" ? "4,0/5,0" : "4.0/5.0");
    await expect(route).toContainText(language === "rus" ? "UniSearch не может оценить" : "UniSearch cannot assess");
    await expect(route).not.toContainText(language === "rus" ? "нет опубликованных измеримых минимумов" : "no measurable published minimums");
    expect((await route.locator(".chance-track-chip").allTextContents()).join(" ")).not.toMatch(/\d+%/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  });
}

test("MIT Sloan MSMS keeps partner-school eligibility and its own deadline", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.addInitScript(() => localStorage.setItem("unisearch_ui_language_v1", "rus"));
  await page.goto("/university.html?id=mit-usa-cambridge");
  await expect(page.locator("#detailName")).not.toBeEmpty();
  await page.locator(".d-tab-btn[data-tab='tab-programs']").click();
  await page.locator("#tab-programs [data-program-level='master']").click();
  const program = page.locator(".program-card", { has: page.locator("[data-program-admission='mit-sloan-msms']") });
  await expect(program.locator(".program-card__title")).toContainText("управленческим исследованиям");
  await program.locator("[data-program-toggle]").click();
  await expect(program.locator(".program-card__description")).toContainText("партнёрских учебных заведений");
  await expect(program).toContainText("Подать заявку могут только");
  await program.locator("[data-program-admission]").click();
  await expect(page).toHaveURL(/admission_program=mit-sloan-msms/);
  await expect(page.locator("#tab-admission [data-admission-category='mit_sloan_msms_admissions']")).toBeVisible();
  await expect(page.locator("#tab-admission [data-admission-category='mit_sloan_msms_admissions']")).toContainText("партнёрских вузов");
  await expect(page.locator("#tab-admission [data-admission-category='mit_sloan_mban_admissions']")).toHaveCount(0);
  await page.locator(".d-tab-btn[data-tab='tab-deadlines']").click();
  await expect(page.locator("#tab-deadlines")).toContainText("18");
  await page.locator(".d-tab-btn[data-tab='tab-finance']").click();
  await expect(page.locator("#tab-finance")).not.toContainText("$0");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test("MITILI Linguistics SM opens its own master's application route", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.addInitScript(() => localStorage.setItem("unisearch_ui_language_v1", "rus"));
  await page.goto("/university.html?id=mit-usa-cambridge");
  await expect(page.locator("#detailName")).not.toBeEmpty();
  await page.locator(".d-tab-btn[data-tab='tab-programs']").click();
  await page.locator("#tab-programs [data-program-level='master']").click();
  const program = page.locator(".program-card", { has: page.locator("[data-program-admission='mit-linguistics-sm-mit-grad-linguistics']") });
  await program.locator("[data-program-toggle]").click();
  await expect(program).toContainText("MITILI");
  await program.locator("[data-program-admission]").click();
  await expect(page).toHaveURL(/admission_program=mit-linguistics-sm-mit-grad-linguistics/);
  const route = page.locator("#tab-admission [data-admission-category='mit_mitili_sm_admissions']");
  await expect(route).toBeVisible();
  await expect(route).toContainText("процедуру приёма на программу PhD по лингвистике");
  await expect(route).toContainText("Statement of Objectives");
  await expect(route).toContainText("Полная стипендия MITILI");
  await expect(route.locator(".admission-funding-option")).toContainText("медицинскую страховку");
  await expect(route.locator(".admission-funding-option")).not.toContainText("по конкурсу или рейтингу");
  await expect(page.locator("#tab-admission [data-admission-category='mit_linguistics_doctoral_admissions']")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test("MIT Mathematics of Data SM shows its internal route and unassessed GPA", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.addInitScript(() => localStorage.setItem("unisearch_ui_language_v1", "rus"));
  await page.goto("/university.html?id=mit-usa-cambridge");
  await expect(page.locator("#detailName")).not.toBeEmpty();
  await page.locator(".d-tab-btn[data-tab='tab-programs']").click();
  await page.locator("#tab-programs [data-program-level='master']").click();
  const program = page.locator(".program-card", { has: page.locator("[data-program-admission='mit-mathematics-of-data-sm-mit-grad-mathematics']") });
  await program.locator("[data-program-toggle]").click();
  await expect(program).toContainText("действующим студентам бакалавриата MIT");
  await program.locator("[data-program-admission]").click();
  const route = page.locator("#tab-admission [data-admission-category='mit_mathematics_of_data_sm_admissions']");
  await expect(route).toBeVisible();
  await expect(route).toContainText("4,8/5,0");
  await expect(route).toContainText("не показывает процент UniChance");
  expect((await route.locator(".chance-track-chip").allTextContents()).join(" ")).not.toMatch(/\d+%/);
  await page.locator(".d-tab-btn[data-tab='tab-deadlines']").click();
  await expect(page.locator("#tab-deadlines")).toContainText("1 декабря 2026");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test("MIT matching Business Analytics keeps its title and major badge on one header row", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await seedProfile(page, { major: "Business Analytics (Course 15-2)", studyLevel: "Bachelor" });
  await page.addInitScript(() => {
    localStorage.setItem("unisearch_ui_language_v1", "rus");
    localStorage.setItem("unisearch_theme", "dark");
  });
  await page.goto("/university.html?id=mit-usa-cambridge");
  await expect(page.locator("#detailName")).not.toBeEmpty();
  await page.locator(".d-tab-btn[data-tab='tab-programs']").click();
  const program = page.locator(".program-card", { has: page.locator("[data-program-admission='mit-bs-15-2']") });
  await expect(program).toHaveClass(/program-card--major/);
  await expect(program.locator(".program-card__major-badge")).toBeVisible();
  const centerDelta = await program.evaluate((card) => {
    // Sample both elements in one frame while the shared tab entrance animates.
    const title = card.querySelector(".program-card__title").getBoundingClientRect();
    const badge = card.querySelector(".program-card__major-badge").getBoundingClientRect();
    return Math.abs(title.y + title.height / 2 - badge.y - badge.height / 2);
  });
  expect(centerDelta).toBeLessThanOrEqual(2);
  await program.locator("[data-program-toggle]").click();
  await program.screenshot({ path: "output/playwright/mit-course15-2-matching-major-dark.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(program.locator(".program-card__major-badge")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

for (const width of [1280, 390]) {
  for (const theme of ["light", "dark"]) {
    test(`MIT Business Analytics curriculum and admission journey at ${width}px in ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.addInitScript((theme) => {
        localStorage.setItem("unisearch_ui_language_v1", "rus");
        localStorage.setItem("unisearch_theme", theme);
      }, theme);
      await page.goto("/university.html?id=mit-usa-cambridge");
      await expect(page.locator("#detailName")).not.toBeEmpty();
      await page.locator(".d-tab-btn[data-tab='tab-programs']").click();
      await expect(page.locator("#tab-programs")).toHaveClass(/active/);
      await page.locator("[data-program-search]").fill("15-2");
      const program = page.locator(".program-card", { has: page.locator("[data-program-admission='mit-bs-15-2']") });
      await program.locator("[data-program-toggle]").click();
      await expect(program.locator(".program-card__description")).toContainText("моделирован");
      await expect(program.locator(".program-card__description")).toContainText("а не условия поступления");
      await expect(program.locator(".program-card__route-note")).toContainText("специальность выбирают после первого курса");
      await expect(program.locator(".program-card__source")).toHaveCount(2);
      await expect(program.locator("a[href*='business-analytics-course-15-2']")).toBeVisible();
      await expect(program.locator("a[href*='updated-fall-2026']")).toBeVisible();
      const levelSpacing = await program.locator(".program-card-row").first().evaluate((row) => {
        const label = row.querySelector(".program-card-label").getBoundingClientRect();
        const value = row.querySelector(".program-card-tags").getBoundingClientRect();
        return value.x - label.right;
      });
      expect(levelSpacing).toBeLessThanOrEqual(16);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      await program.screenshot({ path: `output/playwright/mit-course15-2-${width}-${theme}.png` });

      await program.locator("[data-program-admission]").click();
      await expect(page).toHaveURL(/admission_program=mit-bs-15-2/);
      await expect(page.locator(".d-tab-btn[data-tab='tab-admission']")).toHaveClass(/active/);
      const admission = page.locator("#tab-admission");
      await expect(admission.locator(".mit-admission-context")).toContainText("Бизнес-аналитика");
      await expect(admission.locator(".mit-admission-context")).toContainText("в университет в целом");
      await admission.locator("[data-admission-context='route']").selectOption("first_year");
      await expect(admission.locator("[data-admission-context='route']")).toHaveValue("first_year");
      await admission.locator("[data-admission-context='cycle']").selectOption({ index: 1 });
      await expect(page).toHaveURL(/admission_cycle=/);
      await expect(admission.locator("[data-admission-category='mit_regular']")).toBeVisible();
      await expect(admission.locator("[data-admission-category='mit_undergrad_transfer']")).toHaveCount(0);
      await expect(admission.locator(".admission-decision-actions a")).toHaveAttribute("href", /^https:\/\/mitadmissions\.org\//);
      const route = admission.locator("[data-admission-category='mit_regular']");
      await expect(route.locator(".chance-track-chip")).toHaveCount(1);
      await expect(route.locator(".chance-track-chip")).toContainText("Добавьте обязательные экзамены");
      await expect(route.locator(".admission-check-assessments")).toContainText("SAT или ACT");
      await expect(route.locator(".admission-check-assessments")).toContainText("Не указано");
      await expect(route.locator(".chance-track-chip")).not.toContainText(/\d+\s*%/);
      const history = route.locator(".track-published-score-range");
      await expect(history).not.toHaveAttribute("open", "");
      await expect(history.locator("a")).toBeHidden();
      await history.locator("summary").click();
      await expect(history.locator("a")).toHaveAttribute("href", "https://ir.mit.edu/projects/2024-25-common-data-set/");
      await expect(history).toContainText("осенью 2024 года");
      await history.locator("summary").click();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: `output/playwright/mit-course15-2-admission-${width}-${theme}.png`, fullPage: true });

      await page.reload();
      await expect(page.locator("#detailName")).not.toBeEmpty();
      await page.locator(".d-tab-btn[data-tab='tab-admission']").click();
      await expect(page.locator("#tab-admission .mit-admission-context")).toContainText("Бизнес-аналитика");
      await expect(page.locator("#tab-admission [data-admission-context='route']")).toHaveValue("first_year");
      await expect(page.locator("#tab-admission [data-admission-context='cycle']")).not.toHaveValue("");
    });
  }
}

test("admission categories show applicable programs", async ({ page }) => {
  await page.goto("/university.html?id=astana-it-university-kaz-astana");

  await expect(page.locator("#detailCard")).toBeVisible();
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
  await page.click(".d-tab-btn[data-tab='tab-admission']");

  const programs = page.locator(".admission-program-selector .admission-program-option");
  await expect(programs.first()).toBeVisible();
  await expect(programs).toContainText(["Общие требования", "Компьютерные науки"]);
});

test("nazarbayev university shows one admission category with requirement profiles", async ({ page }) => {
  await page.goto("/university.html?id=nazarbayev-university-kaz-astana");

  await expect(page.locator("#detailCard")).toBeVisible();
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
  await page.click(".d-tab-btn[data-tab='tab-admission']");

  const optionCards = page.locator(".admission-funding-option");
  await expect(optionCards).toHaveCount(2);
  await expect(optionCards).toContainText(["Paid", "Grant"]);
});

test("oxford admission selector narrows program-specific categories without duplicate profile cards", async ({ page }) => {
  await page.goto("/university.html?id=university-of-oxford-uk-oxford");

  await expect(page.locator("#detailCard")).toBeVisible();
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

test("program card major tags are localized in russian", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("unisearch_ui_language_v1", "rus");
  });
  await page.goto("/university.html?id=mit-usa-cambridge");

  await expect(page.locator("#detailCard")).toBeVisible();
  await page.click(".d-tab-btn[data-tab='tab-programs']");

  const firstToggle = page.locator("#tab-programs [data-program-toggle]").first();
  await expect(firstToggle).toBeVisible();
  await firstToggle.click();
  await expect(firstToggle).toHaveAttribute("aria-expanded", "true");

  const programTags = page.locator("#tab-programs .program-card .program-tag");
  await expect(programTags.first()).toBeVisible();
  await expect(programTags).toContainText(["Компьютерные науки"]);
});

test("MIT program opens its applicable admission routes without treating aid as a route", async ({ page }) => {
  await page.goto("/university.html?id=mit-usa-cambridge");
  await expect(page.locator("#detailCard")).toBeVisible();
  await expect(page.locator("#detailName")).not.toBeEmpty();

  await page.locator(".d-tab-btn[data-tab='tab-admission']").click();
  await expect(page.locator("#tab-admission .mit-admission-context")).toContainText("Choose a MIT program first");
  await page.locator("#tab-admission [data-mit-open-programs]").click();

  const computerScience = page.locator("#tab-programs .program-card", { has: page.locator("[data-program-admission='mit-course-6-3-bachelor']") });
  await computerScience.locator("[data-program-toggle]").click();
  await computerScience.locator("[data-program-admission]").click();

  await expect(page.locator(".d-tab-btn[data-tab='tab-admission']")).toHaveClass(/active/);
  await expect(page.locator("#tab-admission .mit-admission-context")).toContainText("Computer Science and Engineering");
  await expect(page.locator("#tab-admission .mit-admission-context")).toContainText("apply to MIT as a whole");
  await expect(page.locator("#tab-admission .admission-category-card")).toHaveCount(3);
  await expect(page.locator("#tab-admission .admission-category-card[data-admission-category='mit_regular']")).toBeVisible();
  await expect(page.locator("#tab-admission .admission-category-card[open]")).toHaveCount(1);
  await expect(page.locator("#tab-admission .admission-funding-option")).toHaveCount(0);
  await expect(page.locator("#tab-admission .mit-admission-context")).toContainText("separate from admission");
  await expect(page.locator("#tab-admission .chance-panel")).not.toContainText("Self-Funded");
  await expect(page).toHaveURL(/admission_program=mit-course-6-3-bachelor/);

  await page.reload();
  await expect(page.locator("#detailName")).not.toBeEmpty();
  await page.locator(".d-tab-btn[data-tab='tab-admission']").click();
  await expect(page.locator("#tab-admission .mit-admission-context")).toContainText("Computer Science and Engineering");
  await expect(page.locator("#tab-admission [data-admission-category='mit_regular']")).toBeVisible();

  await page.locator(".d-tab-btn[data-tab='tab-deadlines']").click();
  const testScoresDeadline = page.locator("#tab-deadlines .admissions-deadline-item", { hasText: "Test scores" }).first();
  await expect(testScoresDeadline).toBeVisible();
  await expect(testScoresDeadline).not.toContainText("Application fee");
  await page.locator(".d-tab-btn[data-tab='tab-admission']").click();

  await page.locator("#tab-admission [data-mit-open-programs]").click();
  await page.locator("#tab-programs [data-program-level='doctorate']").click();
  const physicsPhd = page.locator("#tab-programs .program-card", { has: page.locator("[data-program-admission='mit-physics-phd-course-8']") });
  await physicsPhd.locator("[data-program-toggle]").click();
  await physicsPhd.locator("[data-program-admission]").click();
  await expect(page.locator("#tab-admission .admission-category-card")).toHaveCount(1);
  await expect(page.locator("#tab-admission .admission-category-card[data-admission-category='mit_physics_phd_admissions']")).toBeVisible();
  await expect(page.locator("#tab-admission .admission-category-card[data-admission-category='mit_regular']")).toHaveCount(0);
});

test("MIT transfer deadlines preserve Spring-cycle applicant restrictions", async ({ page }) => {
  await page.goto("/university.html?id=mit-usa-cambridge");
  await expect(page.locator("#detailName")).not.toBeEmpty();
  await page.locator(".d-tab-btn[data-tab='tab-programs']").click();
  const program = page.locator("#tab-programs .program-card", { has: page.locator("[data-program-admission='mit-course-6-3-bachelor']") });
  await program.locator("[data-program-toggle]").click();
  await program.locator("[data-program-admission]").click();

  const routeControl = page.locator("#tab-admission [data-admission-context='route']");
  await expect(routeControl).toBeVisible();
  await routeControl.selectOption("transfer");
  await expect(page).toHaveURL(/admission_route=transfer/);
  const cycleControl = page.locator("#tab-admission [data-admission-context='cycle']");
  await expect(cycleControl).toBeVisible();
  await cycleControl.selectOption("Spring 2027 entry");
  await expect(page).toHaveURL(/admission_cycle=Spring\+2027\+entry/);
  await page.reload();
  await expect(page.locator("#detailName")).not.toBeEmpty();
  await page.locator(".d-tab-btn[data-tab='tab-admission']").click();
  await expect(page.locator("#tab-admission [data-admission-context='route']")).toHaveValue("transfer");
  await expect(page.locator("#tab-admission [data-admission-context='cycle']")).toHaveValue("Spring 2027 entry");
  await page.locator(".d-tab-btn[data-tab='tab-deadlines']").click();
  const springDeadline = page.locator("#tab-deadlines .admissions-deadline-item", { hasText: "U.S. citizens and U.S. permanent residents only" }).first();
  await expect(springDeadline).toBeVisible();
  await expect(springDeadline.locator(".admissions-deadline-date")).toContainText("2026");
  await expect(springDeadline).toContainText("U.S. citizens and U.S. permanent residents only");
  await expect(springDeadline).toContainText("Spring entry only");
});

test("MIT Course 6-3 first-year shows no fit percentage and separates score ranges from minimums", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    localStorage.setItem("unisearch_ui_language_v1", "rus");
    localStorage.setItem("unisearch_theme", "dark");
  });
  await seedProfile(page, {
    studyLevel: "Bachelor",
    applicantRoute: "first_year",
    intendedEntryCycle: "Fall 2027",
    citizenship: "KZ",
    studyMode: "On-campus",
    exams: [{ exam: "SAT", score: 1500 }],
  });
  await page.goto("/university.html?id=mit-usa-cambridge");
  await expect(page.locator("#detailCard")).toBeVisible();
  await expect(page.locator("#detailName")).not.toBeEmpty();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.locator(".d-tab-btn[data-tab='tab-programs']").click();
  const program = page.locator("#tab-programs .program-card", { has: page.locator("[data-program-admission='mit-course-6-3-bachelor']") });
  await program.locator("[data-program-toggle]").click();
  await program.locator("[data-program-admission]").click();
  await expect(page).toHaveURL(/admission_program=mit-course-6-3-bachelor/);
  await expect(page.locator("#tab-admission .mit-admission-context")).toContainText(/Компьютерные науки и инженерия/);

  await page.locator("#tab-admission .mit-admission-analysis > summary").click();
  const chancePercent = page.locator("#tab-admission .chance-panel .chance-percent");
  await expect(chancePercent).toHaveCount(1);
  await expect(chancePercent).toHaveText("?");
  await expect(chancePercent).not.toContainText(/\\d+\\s*%/);
  await expect(page.locator("#tab-admission .chance-panel")).toContainText("нет опубликованных измеримых минимумов");

  const regularRoute = page.locator("#tab-admission .admission-category-card[data-admission-category='mit_regular']");
  await expect(regularRoute).toBeVisible();
  if (await regularRoute.getAttribute("open") === null) await regularRoute.locator(":scope > summary").click();
  const profileTabs = regularRoute.locator(".requirement-profile-tab");
  await expect(profileTabs).toHaveCount(2);
  const satProfile = regularRoute.locator("[data-requirement-profile='mit_regular']");
  await satProfile.click();
  let publishedRange = regularRoute.locator(".track-published-score-range");
  await publishedRange.locator("summary").click();
  await expect(publishedRange.locator("a")).toBeVisible();
  await expect(publishedRange).toContainText("SAT");
  await expect(publishedRange).toContainText("1520–1570");
  await expect(publishedRange).toContainText("Первокурсники, зачисленные осенью 2024 года");
  await expect(publishedRange).toContainText("не обязательный минимум или порог");
  await expect(publishedRange.locator("a")).toHaveAttribute("href", "https://ir.mit.edu/projects/2024-25-common-data-set/");

  await regularRoute.locator("[data-requirement-profile='mit_act']").click();
  publishedRange = regularRoute.locator(".track-published-score-range");
  await publishedRange.locator("summary").click();
  await expect(publishedRange.locator("a")).toBeVisible();
  await expect(publishedRange).toContainText("ACT");
  await expect(publishedRange).toContainText("34–36");
  await expect(publishedRange).toContainText("Первокурсники, зачисленные осенью 2024 года");
  await expect(publishedRange.locator("a")).toHaveAttribute("href", "https://ir.mit.edu/projects/2024-25-common-data-set/");
  await expect(page.locator("#tab-admission .chance-panel .chance-percent")).toHaveText("?");
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test("MIT graduate override is request-local and ignores delayed results from the previous program", async ({ page }) => {
  await seedProfile(page, {
    studyLevel: "Bachelor",
    applicantRoute: "first_year",
    intendedEntryCycle: "Fall 2027",
    citizenship: "KZ",
    studyMode: "On-campus",
    gpa: 3.82,
    gpaScale: 4,
    exams: [{ exam: "SAT", score: 1500 }],
  });

  const requests = [];
  const delayedEndpoints = new Set();
  let releaseDelayed;
  let delayedReady;
  const delayedGate = new Promise((resolve) => { releaseDelayed = resolve; });
  const bothDelayed = new Promise((resolve) => { delayedReady = resolve; });

  for (const endpoint of ["uni-chance", "roi"]) {
    await page.route(`**/universities/mit-usa-cambridge/${endpoint}`, async (route) => {
      const body = route.request().postDataJSON() || {};
      const profile = body.profile || {};
      const selection = profile.selectedAdmissionChoices?.["mit-usa-cambridge"] || {};
      requests.push({ endpoint, profile, programId: selection.programId || selection.program_id || "" });

      if (selection.programId === "mit-course-6-3-bachelor" && !delayedEndpoints.has(endpoint)) {
        const response = await route.fetch();
        delayedEndpoints.add(endpoint);
        if (delayedEndpoints.size === 2) delayedReady();
        await delayedGate;
        await route.fulfill({ response });
        return;
      }

      await route.continue();
    });
  }

  await page.goto("/university.html?id=mit-usa-cambridge");
  await expect(page.locator("#detailName")).not.toBeEmpty();
  await page.locator(".d-tab-btn[data-tab='tab-programs']").click();
  const computerScience = page.locator("#tab-programs .program-card", { has: page.locator("[data-program-admission='mit-course-6-3-bachelor']") });
  await computerScience.locator("[data-program-toggle]").click();
  await computerScience.locator("[data-program-admission]").click();
  await bothDelayed;

  try {
    await page.locator(".d-tab-btn[data-tab='tab-programs']").click();
    await page.locator("#tab-programs [data-program-level='doctorate']").click();
    const physicsPhD = page.locator("#tab-programs .program-card", { has: page.locator("[data-program-admission='mit-physics-phd-course-8']") });
    await physicsPhD.locator("[data-program-toggle]").click();
    await physicsPhD.locator("[data-program-admission]").click();

    const phdCategory = page.locator("#tab-admission .admission-category-card[data-admission-category='mit_physics_phd_admissions']");
    await expect(phdCategory).toBeVisible();
    await expect(page.locator("#tab-admission .mit-admission-context")).toContainText("Physics (Course 8 PhD)");

    for (const endpoint of ["uni-chance", "roi"]) {
      await expect.poll(() => requests.some((request) => request.endpoint === endpoint && request.programId === "mit-physics-phd-course-8")).toBeTruthy();
      const current = requests.find((request) => request.endpoint === endpoint && request.programId === "mit-physics-phd-course-8");
      expect(current.profile.study_level || current.profile.studyLevel).toBe("Doctorate");
      expect(current.profile.applicant_route || current.profile.applicantRoute).toBe("graduate");
      expect(current.profile.intended_entry_cycle || current.profile.intendedEntryCycle).toBe("Fall 2027");
    }

    const savedProfile = await page.evaluate(() => JSON.parse(localStorage.getItem("unisearch_profile") || "{}"));
    expect(savedProfile.studyLevel).toBe("Bachelor");
    expect(savedProfile.applicantRoute).toBe("first_year");
    expect(savedProfile.intendedEntryCycle).toBe("Fall 2027");

    releaseDelayed();
    await expect(phdCategory).toBeVisible();
    await expect(page.locator("#tab-admission .admission-category-card[data-admission-category='mit_regular']")).toHaveCount(0);

    await page.goBack();
    await expect(page).toHaveURL(/admission_program=mit-course-6-3-bachelor/);
    await page.locator(".d-tab-btn[data-tab='tab-admission']").click();
    await expect(page.locator("#tab-admission .mit-admission-context")).toContainText("Computer Science and Engineering");
    await expect(page.locator("#tab-admission .admission-category-card[data-admission-category='mit_regular']")).toBeVisible();
  } finally {
    releaseDelayed();
  }
});

test("Stanford Computer Science opens its applicable admission context", async ({ page }) => {
  await seedProfile(page, {
    studyLevel: "Bachelor",
    applicantRoute: "first_year",
    intendedEntryCycle: "Fall 2027",
    citizenship: "KZ",
    studyMode: "On-campus",
    gpa: 3.78,
    gpaScale: 4,
    exams: [{ exam: "SAT", score: 1510 }],
  });
  await page.goto("/university.html?id=stanford-university-usa-ca");
  await expect(page.locator("#detailName")).not.toBeEmpty();
  await page.locator(".d-tab-btn[data-tab='tab-programs']").click();
  const program = page.locator("#tab-programs .program-card", { has: page.locator("[data-program-admission='stanford-bs-computer-science']") });
  await program.locator("[data-program-toggle]").click();
  await expect(program.locator("[data-program-admission='stanford-bs-computer-science']")).toBeVisible();
  await program.locator("[data-program-admission='stanford-bs-computer-science']").click();
  await expect(page).toHaveURL(/admission_program=stanford-bs-computer-science/);
  await expect(page.locator(".d-tab-btn[data-tab='tab-admission']")).toHaveClass(/active/);
  await expect(page.locator("#tab-admission .mit-admission-context")).toHaveCount(0);
  await expect(page.locator("#tab-admission .admission-category-card[data-admission-category='stanford_standard']")).toBeVisible();
  await expect(page.locator("#tab-admission .admission-category-card[data-admission-category='stanford_undergraduate_transfer']")).toHaveCount(0);
  await expect(page.locator("#tab-admission [data-admission-level]")).toHaveCount(0);
  await page.locator(".d-tab-btn[data-tab='tab-finance']").click();
  await expect(page.locator("#tab-finance .finance-track-group").first()).toBeVisible();
  await expect(page.locator("#tab-finance")).not.toContainText(/Stanford Law School|Juris Doctor|JD Admission/);
});

test("Imperial Computing selects its 2027 course route and leaves unpriced tuition unknown", async ({ page }) => {
  await seedProfile(page, {
    studyLevel: "Bachelor",
    applicantRoute: "first_year",
    intendedEntryCycle: "2027 entry",
    citizenship: "KZ",
    studyMode: "On-campus",
    gpa: 3.8,
    gpaScale: 4,
  });
  await page.goto("/university.html?id=imperial-college-london-uk");
  await expect(page.locator("#detailName")).not.toBeEmpty();
  await page.locator(".d-tab-btn[data-tab='tab-programs']").click();
  const computing = page.locator("#tab-programs .program-card", { has: page.locator("[data-program-admission='imperial-computing-beng']") });
  await computing.locator("[data-program-toggle]").click();
  await computing.locator("[data-program-admission='imperial-computing-beng']").click();

  await expect(page).toHaveURL(/admission_program=imperial-computing-beng/);
  await expect(page.locator("#tab-admission .admission-category-card")).toHaveCount(1);
  await expect(page.locator("#tab-admission .admission-category-card[data-admission-category='imperial_computing_2027']")).toBeVisible();
  await expect(page.locator("#tab-admission .admission-category-card")).toContainText("TMUA");

  await page.locator(".d-tab-btn[data-tab='tab-finance']").click();
  await expect(page.locator("#tab-finance .finance-option-total__value").first()).toContainText(/unknown/i);
  await expect(page.locator("#tab-finance")).not.toContainText("£10,050");
});

test("Imperial Computing MEng keeps its 2027 undergraduate Computing route and requirements", async ({ page }) => {
  await seedProfile(page, {
    studyLevel: "Bachelor",
    applicantRoute: "first_year",
    intendedEntryCycle: "2027 entry",
    citizenship: "KZ",
    studyMode: "On-campus",
    gpa: 3.8,
    gpaScale: 4,
  });
  await page.goto("/university.html?id=imperial-college-london-uk");
  await expect(page.locator("#detailCard")).toBeVisible();
  await expect(page.locator("#detailName")).not.toBeEmpty();
  await page.locator(".d-tab-btn[data-tab='tab-programs']").click();
  const meng = page.locator("#tab-programs .program-card", { has: page.locator("[data-program-admission='imperial-computing-meng']") });
  await expect(meng.locator(".program-card__title")).toContainText("Computing (MEng, undergraduate entry)");
  await meng.locator("[data-program-toggle]").click();
  await meng.locator("[data-program-admission='imperial-computing-meng']").click();

  await expect(page).toHaveURL(/admission_program=imperial-computing-meng/);
  const category = page.locator("#tab-admission .admission-category-card[data-admission-category='imperial_computing_2027']");
  await expect(category).toBeVisible();
  await expect(page.locator("#tab-admission .admission-category-card")).toHaveCount(1);
  await expect(category).toContainText("TMUA");
  await expect(category).toContainText(/A\\*A\\*A|A\\*AAA/);
  await expect(category).toContainText("41 points overall");
  await expect(category).toContainText("13 January 2027 at 18:00 UK time");
});

test("Stanford CS transfer selection stays separate from first-year and JD", async ({ page }) => {
  await seedProfile(page, {
    studyLevel: "Bachelor",
    applicantRoute: "transfer",
    intendedEntryCycle: "Fall 2027",
    citizenship: "KZ",
    studyMode: "On-campus",
    major: "Computer Science",
  });
  await page.goto("/university.html?id=stanford-university-usa-ca&admission_program=stanford-bs-computer-science&admission_route=transfer");
  await expect(page.locator("#detailCard")).toBeVisible();
  await expect(page.locator("#detailName")).not.toBeEmpty();
  await page.locator(".d-tab-btn[data-tab='tab-admission']").click();
  await expect(page).toHaveURL(/admission_program=stanford-bs-computer-science.*admission_route=transfer|admission_route=transfer.*admission_program=stanford-bs-computer-science/);

  const route = page.locator("#tab-admission .admission-category-card[data-admission-category='stanford_undergraduate_transfer']");
  await expect(route).toBeVisible();
  await expect(page.locator("#tab-admission .admission-category-card")).toHaveCount(1);
  await expect(page.locator("#tab-admission .admission-category-card[data-admission-category='stanford_standard']")).toHaveCount(0);
  await expect(route).toContainText("Transfer applicants apply through the Common Application");
  await expect(route).toContainText("ACT or SAT scores");
  await expect(route).toContainText("Fall quarter");
  await expect(page.locator("#tab-admission")).not.toContainText(/Juris Doctor|JD Admission|Stanford Law School/);
  await expect(page.locator("#tab-admission [data-admission-context='route']")).toHaveValue("transfer");
});

test("MIT catalog majors share the sourced university-wide transfer route", async ({ page }) => {
  await page.goto("/university.html?id=mit-usa-cambridge");
  await expect(page.locator("#detailName")).not.toBeEmpty();
  await page.locator(".d-tab-btn[data-tab='tab-programs']").click();
  await expect(page.locator("#tab-programs [data-program-admission='mit-course-6-2-bachelor']")).toHaveCount(0);
  await expect(page.locator("#tab-programs [data-program-admission='mit-bs-6-5']")).toHaveCount(1);

  const architecture = page.locator("#tab-programs .program-card", {
    has: page.locator("[data-program-admission='mit-bs-4']"),
  });
  await architecture.locator("[data-program-toggle]").click();
  await architecture.locator("[data-program-admission]").click();
  await expect(page.locator("#tab-admission .mit-admission-context")).toContainText("Architecture (Course 4)");
  await expect(page.locator("#tab-admission [data-admission-category='mit_regular']")).toBeVisible();
  await expect(page.locator("#tab-admission [data-admission-category='mit_undergrad_early_action']")).toBeVisible();
  await expect(page.locator("#tab-admission [data-admission-category='mit_undergrad_transfer']")).toBeVisible();
});

test("MIT new major has a Russian title and keeps its official course number", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("unisearch_ui_language_v1", "rus"));
  await page.goto("/university.html?id=mit-usa-cambridge");
  await expect(page.locator("#detailName")).not.toBeEmpty();
  await page.locator(".d-tab-btn[data-tab='tab-programs']").click();
  const architecture = page.locator("#tab-programs .program-card", {
    has: page.locator("[data-program-admission='mit-bs-4']"),
  });
  await expect(architecture.locator(".program-card__title")).toContainText("Архитектура (Course 4)");
  await architecture.locator("[data-program-toggle]").click();
  await expect(architecture.locator(".program-card-rows")).toContainText("Бакалавриат");
  await expect(architecture.locator(".program-card-rows")).not.toContainText("нет данных");
  await expect(page.locator("#tab-programs .program-coverage")).toHaveCount(0);
  await expect(architecture.locator("[data-program-admission]")).toBeVisible();
});

test("MIT admission details are concise and localized for a selected program", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("unisearch_ui_language_v1", "rus"));
  await page.goto("/university.html?id=mit-usa-cambridge");
  await expect(page.locator("#detailName")).not.toBeEmpty();
  await page.locator(".d-tab-btn[data-tab='tab-programs']").click();

  const program = page.locator("#tab-programs .program-card", { has: page.locator("[data-program-admission='mit-course-6-3-bachelor']") });
  await program.locator("[data-program-toggle]").click();
  await program.locator("[data-program-admission]").click();

  const transfer = page.locator("[data-admission-category='mit_undergrad_transfer']");
  await expect(transfer).toBeVisible();
  await expect(transfer.locator(".admission-category-title")).toHaveText("Поступление переводом на бакалавриат");
  await expect(transfer.locator(".admission-category-description")).toContainText("Отдельный порядок перевода в MIT");
  await transfer.locator(":scope > summary").click();
  await expect(transfer).toHaveAttribute("open", "");
  await expect(transfer.locator(".track-extra-req-list li").first()).toContainText("К началу обучения в MIT");
  await expect(page.locator("#tab-admission .admission-applicable-programs")).toHaveCount(0);
});

test("MIT graduate program hides raw metadata and undergraduate admission statistics", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("unisearch_ui_language_v1", "rus"));
  await page.goto("/university.html?id=mit-usa-cambridge");
  await expect(page.locator("#detailName")).not.toBeEmpty();
  await page.locator(".d-tab-btn[data-tab='tab-programs']").click();
  await page.locator("[data-program-level='master']").click();

  const program = page.locator("#tab-programs .program-card", { has: page.locator("[data-program-admission='mit-sloan-mfin']") });
  await program.locator("[data-program-toggle]").click();
  await expect(program).toContainText("Магистратура финансов");
  await expect(program.locator(".program-card__description")).toContainText("Программа магистратуры финансов длится 12 или 18 месяцев");
  await expect(program).not.toContainText("[object Object]");
  await expect(program).not.toContainText("ADMISSION ROUTE ID");
  await expect(program).not.toContainText("PRICE FACTS");
  await program.locator("[data-program-admission]").click();

  const admission = page.locator("#tab-admission");
  await expect(admission).toContainText("У программы MFin");
  await expect(admission).not.toContainText("Class of 2029");
  await expect(admission.locator(".track-extra-req-list li").first()).toHaveCount(1);
  await expect(admission.locator(".track-extra-req-list li")).toHaveCount(2);
});

test("MIT admission context fits a narrow dark-theme screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => localStorage.setItem("unisearch_theme", "dark"));
  await page.goto("/university.html?id=mit-usa-cambridge");
  await expect(page.locator("#detailCard")).toBeVisible();
  await expect(page.locator("#detailName")).not.toBeEmpty();
  const programsTab = page.locator(".d-tab-btn[data-tab='tab-programs']");
  await expect(programsTab).toBeVisible();
  await programsTab.click();
  await expect(page.locator("#tab-programs")).toHaveClass(/active/);
  const program = page.locator("#tab-programs .program-card", { has: page.locator("[data-program-admission='mit-course-6-3-bachelor']") });
  await expect(program).toBeVisible();
  await expect(program.locator("[data-program-toggle]")).toBeVisible();
  await program.locator("[data-program-toggle]").click();
  await program.locator("[data-program-admission]").click();
  await expect(page.locator("#tab-admission")).toHaveClass(/active/);
  const context = page.locator("#tab-admission .mit-admission-context");
  await expect(context).toBeVisible();
  await expect(context.locator("[data-mit-open-programs]")).toBeVisible();
  await expect.poll(async () => {
    const bounds = await context.boundingBox();
    return bounds !== null && bounds.x >= 0 && bounds.x + bounds.width <= 390;
  }).toBe(true);

  await page.locator(".d-tab-btn[data-tab='tab-deadlines']").click();
  await expect(page.locator("#tab-deadlines .admissions-deadline-item").first()).toBeVisible();
  await page.locator(".d-tab-btn[data-tab='tab-finance']").click();
  await expect(page.locator("#tab-finance .mit-annual-budget")).toBeVisible();
  await expect(page.locator("#tab-finance .mit-aid-details")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test("programs tab search filters the list and shows empty state", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("unisearch_ui_language_v1", "rus");
  });
  await page.goto("/university.html?id=mit-usa-cambridge");

  await expect(page.locator("#detailCard")).toBeVisible();
  await page.click(".d-tab-btn[data-tab='tab-programs']");

  const search = page.locator("#tab-programs [data-program-search]");
  await expect(search).toBeVisible();
  await expect(page.locator("#tab-programs [data-program-empty]")).toBeHidden();

  await search.fill("Физика");
  await expect(page.locator("#tab-programs .program-card:not([hidden])")).toHaveCount(1);
  await expect(
    page.locator("#tab-programs .program-card:not([hidden]) .program-card__title").first()
  ).toContainText("Физика");

  await search.fill("");
  await expect(page.locator("#tab-programs .program-card:not([hidden])")).toHaveCount(52);

  await search.fill("zzz-no-such-program");
  await expect(page.locator("#tab-programs [data-program-empty]")).toBeVisible();
  await expect(page.locator("#tab-programs .program-card:not([hidden])")).toHaveCount(0);
});

test("profile major pins and highlights matching programs first", async ({ page }) => {
  await seedProfile(page, personas.ruStemGrant.profile);
  await page.addInitScript(() => {
    localStorage.setItem("unisearch_ui_language_v1", "eng");
  });

  await page.goto("/university.html?id=mit-usa-cambridge");

  await expect(page.locator("#detailCard")).toBeVisible();
  await page.click(".d-tab-btn[data-tab='tab-programs']");

  const cards = page.locator("#tab-programs .program-card");
  await expect(cards.first()).toHaveClass(/program-card--major/);
  await expect(cards.first().locator(".program-card__title")).toContainText(
    "Computer Science and Engineering"
  );
  await expect(page.locator("#tab-programs .program-card--major")).toHaveCount(6);
  await expect(
    page.locator("#tab-programs .program-card--major .program-card__major-badge").first()
  ).toBeVisible();
});

test("abai university admission card layout invariants", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("unisearch_ui_language_v1", "rus");
    localStorage.setItem("unisearch_theme", "dark");
  });
  await page.goto("/university.html?id=abai-kazakh-national-pedagogical-university-kaz-almaty");
  await expect(page.locator("#detailCard")).toBeVisible();
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
