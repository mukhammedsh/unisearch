const { test, expect } = require("./helpers/coverage-test.cjs");
const { expectNoStackedGapMargins } = require("./helpers/design");
const { openAdmissionSelectionEditor, openDisclosureParents, revealRestrictedProgram, selectAdmissionRoute } = require("./helpers/selectors");
const fs = require("node:fs");
const path = require("node:path");

const university = "imperial-college-london-uk";
const evidence = path.resolve(__dirname, "../../output/playwright/imperial-applicant-reading");
const presentations = [
  { language: "eng", width: 1280, theme: "light" },
  { language: "rus", width: 390, theme: "dark" },
  { language: "kaz", width: 320, theme: "light" },
  { language: "eng", width: 390, theme: "dark" },
  { language: "rus", width: 1280, theme: "light" },
  { language: "kaz", width: 1280, theme: "dark" },
];

async function ready(page) {
  await expect(page.locator("body")).toHaveAttribute("data-page", "university");
  await expect(page.locator("#detailCard")).toHaveClass(/is-mounted/);
  await expect(page.locator("#admissionsContext")).toHaveAttribute("data-state", "ready");
}

async function prepare(page, item) {
  await page.setViewportSize({ width: item.width, height: 900 });
  await page.addInitScript(item => {
    if (sessionStorage.getItem("imperial-reading-initialized")) return;
    localStorage.setItem("unisearch_ui_language_v1", item.language);
    localStorage.setItem("unisearch_theme", item.theme);
    localStorage.setItem("unisearch_universities_tour_seen_v1", "1");
    localStorage.setItem("unisearch_settings_cache_v1", JSON.stringify([
      { key: "open_universities_new_tab", value: false }, { key: "currency_display_mode", value: "original" },
    ]));
    sessionStorage.setItem("imperial-reading-initialized", "1");
  }, item);
}

async function tab(page, name) {
  await page.locator(`[data-tab="tab-${name}"]`).click();
  await expect(page.locator(`#tab-${name}`)).toHaveClass(/active/);
}

async function select(page, id, value) {
  const wrapper = page.locator(`.custom-select-wrapper:has(#${id})`);
  await wrapper.locator(".custom-select-trigger").click();
  await wrapper.locator(`.custom-option[data-value="${value}"]`).click();
  await expect(page.locator(`#${id}`)).toHaveValue(value);
}

async function program(page, id, search = "Computing", level = "") {
  await tab(page, "programs");
  if (level) await select(page, "admissionsStudyLevel", level);
  const selectedLevel = level || await page.locator("#admissionsStudyLevel").inputValue();
  await page.locator("#admissionsSearch").fill(search);
  const response = page.waitForResponse(response => {
    const url = new URL(response.url());
    return url.pathname.endsWith("/study-options") && response.request().method() === "GET"
      && url.searchParams.get("search") === search && (url.searchParams.get("study_level") || "") === selectedLevel;
  });
  await page.locator("#admissionsSearchSubmit").click();
  expect((await response).ok()).toBe(true);
  await expect(page.locator("#admissionsSearchSubmit")).toBeEnabled();
  const option = page.locator(`[data-study-option="${id}"]`);
  await revealRestrictedProgram(option);
  await expect(option).toBeVisible();
  await option.click();
  await ready(page);
  await expect(option).toHaveAttribute("aria-expanded", "true");
}

async function route(page, value) {
  await page.locator("#admissionsViewRequirements").click();
  if (await selectAdmissionRoute(page, value)) await page.locator("#admissionsContextApply").click();
  await ready(page);
}

async function openAdvanced(page) {
  await openAdmissionSelectionEditor(page);
  const advanced = page.locator("#admissionsAdvanced");
  if (!(await advanced.evaluate(node => node.open))) await advanced.locator(":scope > summary").click();
}

async function screenshot(page, name, section) {
  fs.mkdirSync(evidence, { recursive: true });
  await page.locator(section).scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(evidence, `${name}.png`) });
}

for (const item of presentations) {
  test(`Imperial guest reads and saves Computing MEng in ${item.language}, ${item.width}px, ${item.theme}`, async ({ page }) => {
    await prepare(page, item);
    await page.goto("/index.html?q=Imperial");
    await expect(page.locator("body")).toHaveAttribute("data-page", "universities");
    const card = page.locator(`.uni-card[data-uni-id="${university}"]`);
    await expect(card).toBeVisible();
    await card.locator(".uni-card-link-overlay").click();
    await ready(page);
    await expect(page.locator("html")).toHaveAttribute("data-theme", item.theme);
    await program(page, "imperial-option-computing-meng");
    await expect(page.locator("#admissionsReferenceSummary")).toContainText("MEng");
    await expect(page.locator("[data-integrated-meng]")).toBeVisible();
    await expect(page.locator("#admissionsStudyOverview > .program-card__description")).not.toContainText(/not available|отсутствует|әлі жоқ/);
    if (item.language !== "eng") {
      await expect(page.locator("#admissionsStudyOverview .program-card-rows")).not.toContainText(/Full-time|October 2027/);
      await page.locator("[data-program-original] > summary").click();
      await expect(page.locator("[data-program-original] p")).toContainText("industrial placement");
      await page.locator("[data-program-original] > summary").click();
    }
    await expect(page.locator("#admissionsStudyRelationship")).toContainText("G401");
    await route(page, "procedure-computing-meng");
    const requirements = page.locator('[data-source-summary="requirements"]');
    await expect(requirements).toContainText("TMUA");
    await expect(requirements).toContainText("41");
    await expect(requirements).toContainText(/Kazakhstan|Казахстан|Қазақстан/);
    await expect(page.locator('[data-source-summary="application"]')).toContainText("I50");
    await expect(page.locator(".admissions-application-link")).toHaveAttribute("href", /^https:\/\/(?:[a-z0-9-]+\.)*imperial\.ac\.uk(?:[/?#]|$)/i);
    await expectNoStackedGapMargins(page, "#tab-admission");
    await screenshot(page, `${item.language}-${item.width}-${item.theme}-requirements`, '[data-source-summary="requirements"] h3');
    await tab(page, "deadlines");
    await expect(page.locator("[data-ucas-dates]")).toContainText("2027");
    await expect(page.locator("[data-ucas-dates]")).toContainText("18:00");
    await expect(page.locator('[data-source-summary="deadlines"]')).toContainText("TMUA");
    await expectNoStackedGapMargins(page, "#tab-deadlines");
    await tab(page, "finance");
    await expect(page.locator("[data-course-tuition]")).toContainText("47,800");
    await expect(page.locator("[data-living-reference]")).toContainText("2026");
    await expect(page.locator(".admissions-reading__total")).toHaveCount(0);
    await expect(page.locator('[data-source-summary="funding"]')).toContainText("Imperial Bursary");
    await expect(page.locator('[data-source-summary="funding"]')).not.toContainText("i360");
    await expect(page.locator('[data-source-summary="costs"]')).toContainText(/34[.,]50/);
    await expectNoStackedGapMargins(page, "#tab-finance");
    await screenshot(page, `${item.language}-${item.width}-${item.theme}-costs`, "[data-course-tuition] caption");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(item.width);
    await tab(page, "admission");
    await page.locator("#admissionsSaveChoice").click();
    await expect(page.locator("#admissionsSaveStatus")).not.toBeEmpty();
    await page.goto(`/university.html?id=${university}`);
    await ready(page);
    await expect(page.locator("#tab-general")).toHaveClass(/active/);
    await tab(page, "admission");
    await expect(page.locator("#admissionsRoute")).toHaveValue("procedure-computing-meng");
    await expect(page.locator("#admissionsReferenceSummary")).toContainText("MEng");
    await page.reload();
    await ready(page);
    const choice = await page.evaluate(id => JSON.parse(localStorage.getItem("unisearch_profile")).selectedAdmissionChoices[id], university);
    expect(choice.studyOptionId).toBe("imperial-option-computing-meng");
    expect(choice.studyLevel).toBe("undergraduate");
  });
}

const contrasts = [
  { option: "imperial-option-computing-beng", route: "procedure-computing-beng", award: "BEng" },
  { option: "imperial-option-computing", route: "procedure-computing", award: "MSc" },
  { option: "imperial-computing-phd", search: "Computing Research", level: "doctoral", route: "procedure-computing-phd", award: "PhD" },
];

for (const item of presentations) {
  test(`Imperial completed study overviews stay readable in ${item.language}, ${item.width}px, ${item.theme}`, async ({ page }) => {
    await prepare(page, item);
    await page.goto(`/university.html?id=${university}`);
    await ready(page);
    for (const entry of [
      { id: "imperial-option-full-time-mba", search: "Full-Time MBA", text: /management foundation|Основа управления|Басқару негіздері/, original: "Business Analytics" },
      { id: "imperial-option-medicine", search: "Medicine", text: /six-year|Шестилетняя|Алты жылдық/, original: "Principles of Medicine" },
      { id: "imperial-option-data-science", search: "Biomedical Research Data Science", text: /not compulsory|не являются обязательными|міндетті модульдер/, original: "Example projects" },
      { id: "imperial_genomic_medicine_msc_pgcert", search: "Genomic Medicine", text: /four taught modules|четырёх модулей|төрт модуль/ },
      { id: "imperial-brain-sciences-phd", search: "Brain Sciences", text: /neurology|неврологию|Неврология/ },
      { id: "imperial_experimental_biomolecular_sciences_mres_msc", search: "Experimental Biomolecular Sciences", text: /not established|не подтверждён|расталмаған/ },
    ]) {
      await program(page, entry.id, entry.search);
      const overview = page.locator("#admissionsStudyOverview");
      await expect(overview.locator(":scope > .program-card__description")).toContainText(entry.text);
      await expect(overview.locator("[data-program-overview-missing]")).toHaveCount(0);
      if (entry.id === "imperial-option-full-time-mba") await expect(overview.locator(".program-card-rows")).toContainText(/12 (months|месяцев|ай)/);
      if (entry.original) {
        await overview.locator("[data-program-original] > summary").click();
        await expect(overview.locator("[data-program-original]")).toContainText(entry.original);
        await expect(overview.locator('[data-program-original] a[href*="imperial.ac.uk"]').first()).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(item.width);
        if (entry.id === "imperial-option-full-time-mba") await screenshot(page, `completed-overview-${item.language}-${item.width}-${item.theme}`, "#admissionsStudyOverview");
        await overview.locator("[data-program-original] > summary").click();
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(item.width);
    }
  });
}

for (const [index, language] of ["eng", "rus", "kaz"].entries()) {
  test(`Imperial HealthBRIDGE distinguishes the opening announcement from an unverified form in ${language}`, async ({ page }) => {
    await prepare(page, { language, width: index ? 390 : 1280, theme: index === 1 ? "dark" : "light" });
    await page.goto(`/university.html?id=${university}`);
    await ready(page);
    await program(page, "imperial-healthbridge", "HealthBRIDGE");
    await route(page, "procedure-healthbridge");
    await expect(page.locator('[data-source-summary="application"]')).toContainText(/not been independently verified|отдельно не проверена|бөлек тексерілген жоқ/);
    await tab(page, "deadlines");
    const dates = page.locator('[data-source-summary="deadlines"]');
    await expect(dates).toContainText("12:00 GMT");
    await expect(dates).toContainText("2026");
    await expect(dates).toContainText("2027");
    await expect(dates).toContainText(/reports applications open|сообщает об открытом наборе|қабылдау ашық екенін хабарлайды/);
  });
}

for (const [index, entry] of contrasts.entries()) for (const [position, language] of ["eng", "rus", "kaz"].entries()) {
  const item = { language, width: [320, 390, 1280][(index + position) % 3], theme: (index + position) % 2 ? "dark" : "light" };
  test(`Imperial ${entry.award} keeps its own entry, dates and costs in ${language}`, async ({ page }) => {
    await prepare(page, item);
    await page.goto(`/university.html?id=${university}`);
    await ready(page);
    await program(page, entry.option, entry.search, entry.level);
    await expect(page.locator("#admissionsReferenceSummary")).toContainText(entry.award);
    await route(page, entry.route);
    const requirements = page.locator('[data-source-summary="requirements"]');
    if (entry.award === "BEng") await expect(requirements).toContainText("TMUA");
    else {
      await expect(requirements).not.toContainText("TMUA");
      await expect(requirements).toContainText(/First-Class|first-class/);
    }
    await tab(page, "deadlines");
    if (entry.award === "MSc") await expect(page.locator('[data-source-summary="deadlines"]')).toContainText("23:59");
    if (entry.award === "PhD") {
      await expect(page.locator('[data-source-summary="deadlines"]')).toContainText("2026");
      await expect(page.locator('[data-source-summary="deadlines"]')).not.toContainText("23:59");
      await expect(page.locator("[data-ucas-dates]")).toHaveCount(0);
    }
    await tab(page, "finance");
    if (entry.award === "PhD") {
      await expect(page.locator("[data-course-tuition]")).toHaveCount(0);
      await expect(page.locator("[data-scholarship-rounds]")).toContainText("23:59");
      await expect(page.locator('[data-source-summary="funding"]')).toContainText(/31[ ,]380/);
    } else await expect(page.locator("[data-course-tuition]")).toBeVisible();
    await expect(page.locator(".admissions-reading__total")).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(item.width);
  });
}

test("Imperial language changes, invalid cycles and saving preserve a synthetic general profile", async ({ page }) => {
  await prepare(page, presentations[0]);
  await page.addInitScript(() => {
    if (!localStorage.getItem("unisearch_profile")) localStorage.setItem("unisearch_profile", JSON.stringify({ _v: 2, gpa: 3.8, budget: 30000, applicantRoute: "graduate", intendedEntryCycle: "2028 entry" }));
  });
  await page.goto(`/university.html?id=${university}&admission_cycle=`);
  await ready(page);
  await program(page, "imperial-option-computing-meng");
  await select(page, "admissionsStudyLevel", "undergraduate");
  await expect(page.locator('[data-study-option="imperial-option-computing-meng"]')).toBeVisible();
  await route(page, "procedure-computing-meng");
  const url = page.url();
  for (const [language, code] of [["rus", "ru"], ["kaz", "kk"], ["eng", "en"]]) {
    await select(page, "languageSelect", language);
    await expect(page.locator("html")).toHaveAttribute("lang", code);
    await expect(page.locator("#detailCard")).not.toHaveClass(/is-language-refreshing/);
    await ready(page);
    expect(page.url()).toBe(url);
    await expect(page.locator("#admissionsSearch")).toHaveValue("Computing");
    await expect(page.locator("#admissionsStudyLevel")).toHaveValue("undergraduate");
    await expect(page.locator("#admissionsReferenceSummary")).toContainText("MEng");
  }
  await openAdvanced(page);
  await page.locator("#admissionsCycle").fill("undecided cycle");
  await expect(page.locator("#admissionsCycleNotice")).toBeVisible();
  await page.locator("#admissionsCycle").fill("2027 entry");
  await select(page, "admissionsApplicant", "first_year");
  await page.locator("#admissionsContextApply").click();
  await ready(page);
  await page.locator("#admissionsSaveChoice").click();
  await expect(page.locator("#admissionsSaveStatus")).not.toBeEmpty();
  const profile = await page.evaluate(() => JSON.parse(localStorage.getItem("unisearch_profile")));
  expect(profile.gpa).toBe(3.8);
  expect(profile.budget).toBe(30000);
  expect(profile.applicantRoute).toBe("graduate");
  expect(profile.intendedEntryCycle).toBe("2028 entry");
  expect(profile.selectedAdmissionChoices[university].applicantRoute).toBe("first_year");
});

test("Imperial retries a context failure and keeps the selected program through empty search and history", async ({ page }) => {
  await prepare(page, presentations[0]);
  await page.goto(`/university.html?id=${university}`);
  await ready(page);
  await page.route(`**/universities/${university}/admissions-context`, route => route.fulfill({ status: 503, contentType: "application/json", body: '{"detail":"Unavailable"}' }), { times: 1 });
  await tab(page, "programs");
  await page.locator("#admissionsSearch").fill("Computing");
  const searchResponse = page.waitForResponse(response => {
    const url = new URL(response.url());
    return url.pathname.endsWith("/study-options") && url.searchParams.get("search") === "Computing";
  });
  await page.locator("#admissionsSearchSubmit").click();
  expect((await searchResponse).ok()).toBe(true);
  await expect(page.locator("#admissionsSearchSubmit")).toBeEnabled();
  await page.locator('[data-study-option="imperial-option-computing-meng"]').click();
  await expect(page.locator("#admissionsContext")).toHaveAttribute("data-state", "error");
  await page.locator('#admissionsStudyInfo [data-admissions-retry="context"]').click();
  await ready(page);
  await route(page, "procedure-computing-meng");
  await page.goBack();
  await ready(page);
  await expect(page.locator("#admissionsRoute")).toHaveValue("");
  await page.goForward();
  await ready(page);
  await expect(page.locator("#admissionsRoute")).toHaveValue("procedure-computing-meng");
  await tab(page, "programs");
  await page.locator("#admissionsSearch").fill("no such published course 123");
  await page.locator("#admissionsSearchSubmit").click();
  await expect(page.locator("#admissionsProgramList [data-study-option]")).toHaveCount(0);
  await expect(page.locator("#admissionsSelectedProgram")).toBeVisible();
  await expect(page.locator("#admissionsReferenceSummary")).toContainText("MEng");
});

for (const item of [
  { option: "imperial-option-aeronautical-engineering", search: "Aeronautical Engineering", route: "procedure-aeronautical-engineering", fact: "imperial-aeronautical-engineering-admission", expected: /ESAT/ },
  { option: "imperial-option-medicine", search: "Medicine", route: "procedure-medicine", fact: "fact_medicine_ucas_ucat_2027", expected: /UCAT/ },
  { option: "imperial-option-full-time-mba", search: "Full-Time MBA", route: "procedure-full-time-mba", fact: "fact_full_time_mba_application_2027", expected: /GMAT|GRE/ },
  { option: "imperial_computational_biomedicine_computational_brain_sciences_online_msc_pgcert", search: "Computational Biomedicine", route: "procedure-imperial_computational_biomedicine_computational_brain_sciences_online_msc_pgcert", award: "PGCert" },
  { option: "imperial-option-medicine-phd", search: "Intercalated", route: "procedure-medicine-phd", award: "MBBS/PhD" },
]) {
  test(`Imperial preserves the distinct ${item.option} offering`, async ({ page }) => {
    await prepare(page, presentations[1]);
    await page.goto(`/university.html?id=${university}`);
    await ready(page);
    await program(page, item.option, item.search, item.level);
    if (item.award) await expect(page.locator("#admissionsReferenceSummary")).toContainText(item.award);
    await route(page, item.route);
    await expect(page.locator('[data-source-summary="requirements"]')).not.toContainText(/Computing requires TMUA|Для Computing нужен TMUA/);
    if (item.fact) {
      const fact = page.locator(`#detailRequirements [data-admissions-fact="${item.fact}"]`);
      await openDisclosureParents(fact);
      if (await fact.evaluate(node => node.tagName === "DETAILS" && !node.open)) await fact.locator(":scope > summary").click();
      await expect(fact).toContainText(item.expected);
    }
    if (item.option === "imperial-option-medicine") {
      await tab(page, "deadlines");
      await expect(page.locator("[data-ucas-dates] tbody")).toContainText("15 октября 2026");
      await expect(page.locator("[data-ucas-dates] tbody")).not.toContainText("2027");
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  });
}

test("Imperial ignores an older delayed response after Back and exposes keyboard focus", async ({ page }) => {
  await prepare(page, presentations[0]);
  let release;
  let fetched;
  const gate = new Promise(resolve => { release = resolve; });
  const fetchedResponse = new Promise(resolve => { fetched = resolve; });
  await page.route("**/admissions-context", async route => {
    if (route.request().postDataJSON().context.intended_entry_cycle === "2027 entry") {
      const response = await route.fetch();
      fetched();
      await gate;
      await route.fulfill({ response });
    } else await route.continue();
  });
  await page.goto(`/university.html?id=${university}&admission_option=imperial-option-computing-meng&admission_application_route=procedure-computing-meng&admission_level=undergraduate&admission_cycle=2026%20entry`);
  await ready(page);
  await openAdmissionSelectionEditor(page);
  const advancedSummary = page.locator("#admissionsAdvanced > summary");
  await advancedSummary.focus();
  await page.keyboard.press("Tab");
  await expect(page.locator("#admissionsContextApply")).toBeFocused();
  expect(await page.locator("#admissionsContextApply").evaluate(node => getComputedStyle(node).outlineWidth)).toBe("2px");
  await openAdvanced(page);
  await page.locator("#admissionsCycle").fill("2027 entry");
  await page.locator("#admissionsContextApply").click();
  await fetchedResponse;
  await page.goBack();
  await ready(page);
  await expect(page.locator("#admissionsCycle")).toHaveValue("2026 entry");
  release();
  await expect(page.locator("#admissionsContext")).toHaveAttribute("data-state", "ready");
  await expect(page.locator("#admissionsCycle")).toHaveValue("2026 entry");
});

test("Imperial map marker keeps tuition separate from the unavailable annual budget", async ({ page }) => {
  await prepare(page, presentations[0]);
  await page.goto("/index.html?q=Imperial&cost_basis=tuition");
  await expect(page.locator("body")).toHaveAttribute("data-page", "universities");
  await expect(page.locator(`#universitiesList .uni-card[data-uni-id="${university}"]`)).toBeVisible();
  await page.locator("#viewMapBtn").click();
  const marker = page.locator("#mapContainer .leaflet-marker-icon");
  await expect(marker).toHaveCount(1);
  await page.locator(`#mapResultsPanel .uni-card[data-uni-id="${university}"]`).click();
  const mapBox = await page.locator("#mapContainer").boundingBox();
  await expect.poll(async () => {
    const box = await marker.boundingBox();
    return box && box.x > mapBox.x && box.x + box.width < mapBox.x + mapBox.width
      && box.y > mapBox.y && box.y + box.height < mapBox.y + mapBox.height;
  }).toBe(true);
  await marker.click();
  const popup = page.locator(`#mapContainer .custom-map-popup .uni-card[data-uni-id="${university}"]`);
  await expect(popup).toBeVisible();
  await expect(popup.locator('[data-cost-basis="tuition"]')).toContainText(/10[\s,]?050/);
  await expect(popup.locator('[data-cost-basis="annual_total"]')).toHaveCount(0);
  await popup.locator('.uni-cost-trigger').click();
  await expect(popup.locator('.uni-cost-tooltip [role="tooltip"]')).toBeVisible();
  await expect(popup.locator('.uni-cost-tooltip [role="tooltip"]')).toContainText("2027");
  await screenshot(page, "eng-1280-map-tuition", "#mapContainer");
});
