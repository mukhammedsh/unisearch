const { test, expect } = require("./helpers/coverage-test.cjs");
const { expectNoStackedGapMargins } = require("./helpers/design");
const { openAdmissionSelectionEditor, openDisclosureParents, revealRestrictedProgram, selectAdmissionRoute } = require("./helpers/selectors");
const fs = require("node:fs");
const path = require("node:path");

const university = "stanford-university-usa-ca";
const evidence = path.resolve(__dirname, "../../output/playwright/stanford-applicant-reading");
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
    if (sessionStorage.getItem("stanford-reading-initialized")) return;
    localStorage.setItem("unisearch_ui_language_v1", item.language);
    localStorage.setItem("unisearch_theme", item.theme);
    localStorage.setItem("unisearch_universities_tour_seen_v1", "1");
    localStorage.setItem("unisearch_settings_cache_v1", JSON.stringify([
      { key: "open_universities_new_tab", value: false }, { key: "currency_display_mode", value: "original" },
    ]));
    sessionStorage.setItem("stanford-reading-initialized", "1");
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

async function program(page, id, search = "Computer Science") {
  await tab(page, "programs");
  await page.locator("#admissionsSearch").fill(search);
  const level = await page.locator("#admissionsStudyLevel").inputValue();
  const response = page.waitForResponse(response => {
    const url = new URL(response.url());
    return url.pathname.endsWith("/study-options") && response.request().method() === "GET"
      && url.searchParams.get("search") === search && (url.searchParams.get("study_level") || "") === level;
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
  test(`Stanford guest reads and saves CS BS first-year in ${item.language}, ${item.width}px, ${item.theme}`, async ({ page }) => {
    await prepare(page, item);
    await page.goto("/index.html?q=Stanford");
    await expect(page.locator("body")).toHaveAttribute("data-page", "universities");
    const card = page.locator(`.uni-card[data-uni-id="${university}"]`);
    await expect(card).toBeVisible();
    await card.locator(".uni-card-link-overlay").focus();
    await page.keyboard.press("Enter");
    await ready(page);
    await expect(page.locator("html")).toHaveAttribute("data-theme", item.theme);
    const search = { eng: "Computer Science", rus: "Компьютерные науки", kaz: "Информатика" }[item.language];
    await program(page, "stanford-option-cs-bs", search);
    await expect(page.locator("[data-award-explanation]")).toContainText("BS");
    await expect(page.locator("#admissionsStudyOverview > .program-card__description")).not.toBeEmpty();
    await page.locator("[data-program-original] > summary").click();
    await expect(page.locator("[data-program-original] p")).toContainText("artificial intelligence");
    await page.locator("[data-program-original] > summary").click();
    await route(page, "undergraduate-shared-evidence:stanford-first-year");
    await expect(page.locator('[data-source-summary="requirements"]')).toContainText("SAT");
    await expect(page.locator('[data-source-summary="requirements"]')).toContainText("ACT");
    await expect(page.locator('[data-source-summary="requirements"]')).toContainText(/Kazakhstan|Казахстан|Қазақстан/i);
    await expect(page.locator('[data-source-summary="application"]')).toContainText("Common Application");
    await expect(page.locator(".admissions-application-link")).toHaveAttribute("href", "https://admission.stanford.edu/apply/first-year/apply.html");
    await expectNoStackedGapMargins(page, "#tab-admission");
    await screenshot(page, `${item.language}-${item.width}-${item.theme}-requirements`, '[data-source-summary="requirements"] h3');
    await tab(page, "deadlines");
    const dates = page.locator('[data-source-summary="deadlines"]');
    await expect(dates).toContainText("REA");
    await expect(dates).toContainText(/23:59|11:59/);
    await expect(dates).not.toContainText(/2027|2028/);
    await expectNoStackedGapMargins(page, "#tab-deadlines");
    await tab(page, "finance");
    await expect(page.locator('[data-source-summary="costs"]')).toContainText(/67[\s,]?731/);
    await expect(page.locator('[data-source-summary="funding"]')).toContainText("4704");
    await expect(page.locator('[data-source-summary="funding"]')).toContainText("2027");
    await expect(page.locator('[data-source-summary="funding"]')).toContainText("ISAFA");
    const domesticAid = page.locator('[data-summary-fact="undergraduate-shared-evidence:stanford-ug-firstyear-domestic-aid-2027-28"]');
    await expect(domesticAid).toContainText("2025");
    await expect(domesticAid).toContainText("001305");
    await expectNoStackedGapMargins(page, "#tab-finance");
    await screenshot(page, `${item.language}-${item.width}-${item.theme}-aid`, '[data-source-summary="funding"] h3');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(item.width);
    await tab(page, "admission");
    await page.locator("#admissionsSaveChoice").click();
    await expect(page.locator("#admissionsSaveStatus")).not.toBeEmpty();
    await page.goto(`/university.html?id=${university}`);
    await ready(page);
    await expect(page.locator("#tab-general")).toHaveClass(/active/);
    await tab(page, "admission");
    await expect(page.locator("#admissionsRoute")).toHaveValue("undergraduate-shared-evidence:stanford-first-year");
    await page.reload();
    await ready(page);
    const choice = await page.evaluate(id => JSON.parse(localStorage.getItem("unisearch_profile")).selectedAdmissionChoices[id], university);
    expect(choice.studyOptionId).toBe("stanford-option-cs-bs");
    expect(choice.studyLevel).toBe("undergraduate");
  });
}

const contrasts = [
  { option: "stanford-option-cs-bs", route: "undergraduate-shared-evidence:stanford-transfer", kind: "transfer", search: "Computer Science" },
  { option: "stanford-option-cs-ms", route: "directory-evidence:stanford-graduate-cs-ms", kind: "MS", search: "Computer Science" },
  { option: "stanford-option-cs-ms", route: "engineering-doerr-evidence:cs-coterm", kind: "coterm", search: "Computer Science" },
  { option: "stanford-option-cs-phd", route: "engineering-doerr-evidence:external-graduate", kind: "PhD", search: "Computer Science" },
  { option: "stanford-option-gsb-mba", route: "professional-evidence:gsb_mba_admission", kind: "MBA", search: "Business Administration" },
  { option: "stanford-option-med-md", route: "professional-evidence:med_md_admission", kind: "MD", search: "Medicine" },
];

for (const [index, entry] of contrasts.entries()) for (const [position, language] of ["eng", "rus", "kaz"].entries()) {
  const item = { language, width: [320, 390, 1280][(index + position) % 3], theme: (index + position) % 2 ? "dark" : "light" };
  test(`Stanford ${entry.kind} keeps its own entry, dates and funding in ${language}`, async ({ page }) => {
    await prepare(page, item);
    await page.goto(`/university.html?id=${university}`);
    await ready(page);
    await program(page, entry.option, entry.search);
    if (["MBA", "MD"].includes(entry.kind)) {
      await expect(page.locator("#admissionsStudyOverview > .program-card__description")).not.toBeEmpty();
      await page.locator("[data-program-original] > summary").click();
      await expect(page.locator("[data-program-original] p")).toContainText(entry.kind === "MBA" ? "Two-year" : "Discovery Curriculum");
      await expect(page.locator("[data-program-original] a")).not.toHaveCount(0);
      await page.locator("[data-program-original] > summary").click();
    }
    await route(page, entry.route);
    const requirements = page.locator('[data-source-summary="requirements"]');
    if (entry.kind === "transfer") await expect(requirements).toContainText("College Report");
    if (["MS", "PhD"].includes(entry.kind)) await expect(requirements).toContainText("GRE");
    if (entry.kind === "MS") {
      await expect(page.locator('[data-summary-fact="engineering-doerr-evidence:cs-ms-tests-and-english-policy"] [data-summary-conflict]')).toHaveCount(0);
      await expect(page.locator('[data-summary-fact="engineering-doerr-evidence:cs-ms-tests-and-english-policy"]')).toContainText("10");
      await expect(page.locator('[data-summary-fact="engineering-doerr-evidence:cs-ms-entry-and-hcp"]')).toContainText("PhD");
    }
    if (entry.kind === "coterm") await expect(requirements).toContainText("120");
    if (entry.kind === "MBA") await expect(requirements).toContainText("GMAT");
    if (entry.kind === "MD") {
      await expect(requirements).toContainText("MCAT");
      await expect(page.locator('[data-source-summary="application"]')).toContainText("AMCAS");
    }
    await expect(page.locator(".admissions-application-link")).toHaveAttribute("href", /^https:\/\/(?:[a-z0-9-]+\.)*stanford\.edu(?:[/?#]|$)/i);
    const full = page.locator("#detailRequirements [data-admissions-fact]").first();
    await openDisclosureParents(full);
    if (await full.evaluate(node => node.tagName === "DETAILS" && !node.open)) await full.locator(":scope > summary").click();
    await expect(full.locator('a[href^="https://"]')).not.toHaveCount(0);
    await tab(page, "deadlines");
    if (["MS", "PhD"].includes(entry.kind)) {
      await expect(page.locator("[data-program-deadlines]")).toContainText(/8.*2026|December 8/);
      await expect(page.locator("[data-program-deadlines]")).toContainText(entry.kind);
      await expect(page.locator("[data-program-deadlines]")).toContainText("2027");
    } else {
      const dates = page.locator('[data-source-summary="deadlines"]');
      if (entry.kind === "transfer") { await expect(dates).toContainText(/June 1|1 июня|1 маусым/); await expect(dates).not.toContainText(/REA|2027/); }
      if (entry.kind === "coterm") { await expect(dates).toContainText("2026"); await expect(dates).toContainText("2027"); }
      if (entry.kind === "MBA") { await expect(dates).toContainText("2027"); await expect(dates).toContainText(/16:00|4:00/); }
      if (entry.kind === "MD") { await expect(dates).toContainText("ET"); await expect(dates).toContainText("PT"); }
    }
    await tab(page, "finance");
    const funding = page.locator('[data-source-summary="funding"]');
    if (entry.kind === "transfer") {
      await expect(funding).toContainText("4704");
      await expect(funding).not.toContainText("REA");
      await expect(page.locator('#detailFinance [data-summary-fact="undergraduate-shared-evidence:stanford-transfer-fee"]')).toContainText("100");
      await expect(page.locator('[data-summary-fact="undergraduate-shared-evidence:stanford-ug-transfer-domestic-aid-2027-28"]')).toContainText("2025");
      expect((await page.locator('#detailFinance .admissions-catalog__unknowns').allTextContents()).join(" ")).not.toContain("general transfer requirements page states USD 90");
    }
    if (entry.kind === "PhD") await expect(funding).toContainText(/progress|прогресс|ілгерілеу/);
    if (entry.kind === "MS") await expect(funding).not.toContainText(/PhD funding guarantee|гарантию финансирования PhD|PhD қаржыландыру кепілдігін/);
    if (entry.kind === "MBA") await expect(page.locator('[data-source-summary="costs"]')).toContainText(/89[\s,]?187/);
    if (entry.kind === "MD") {
      await expect(page.locator('[data-source-summary="costs"]')).toContainText(/24[\s,]?034/);
      await expect(funding).toContainText("Direct Loans");
    }
    if (!["transfer", "coterm"].includes(entry.kind)) await expect(page.locator(".admissions-reading__total")).toHaveCount(0);
    await screenshot(page, `${language}-${item.width}-${entry.kind}-finance`, "#detailFinance");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(item.width);
  });
}

test("Stanford preserves search, route and general profile across language changes, save and history", async ({ page }) => {
  await prepare(page, presentations[0]);
  await page.addInitScript(() => localStorage.setItem("unisearch_profile", JSON.stringify({ version: 2, gpa: 3.8, budget: 30000, applicantRoute: "graduate", intendedEntryCycle: "2028 entry", citizenships: ["Kazakhstan"] })));
  await page.goto(`/university.html?id=${university}`);
  await ready(page);
  await program(page, "stanford-option-cs-bs");
  await select(page, "admissionsStudyLevel", "undergraduate");
  await route(page, "undergraduate-shared-evidence:stanford-transfer");
  const url = page.url();
  for (const [language, code] of [["rus", "ru"], ["kaz", "kk"], ["eng", "en"]]) {
    await select(page, "languageSelect", language);
    await expect(page.locator("html")).toHaveAttribute("lang", code);
    await expect(page.locator("#detailCard")).not.toHaveClass(/is-language-refreshing/);
    await ready(page);
    expect(page.url()).toBe(url);
    await expect(page.locator("#admissionsSearch")).toHaveValue("Computer Science");
    await expect(page.locator("#admissionsStudyLevel")).toHaveValue("undergraduate");
  }
  await openAdvanced(page);
  await page.locator("#admissionsCycle").fill("undecided cycle");
  await expect(page.locator("#admissionsCycleNotice")).toBeVisible();
  await page.locator("#admissionsCycle").fill("");
  await select(page, "admissionsApplicant", "transfer");
  await page.locator("#admissionsContextApply").click();
  await ready(page);
  await page.locator("#admissionsSaveChoice").click();
  await expect(page.locator("#admissionsSaveStatus")).not.toBeEmpty();
  const profile = await page.evaluate(() => JSON.parse(localStorage.getItem("unisearch_profile")));
  expect(profile.gpa).toBe(3.8);
  expect(profile.budget).toBe(30000);
  expect(profile.applicantRoute).toBe("graduate");
  expect(profile.intendedEntryCycle).toBe("2028 entry");
  expect(profile.selectedAdmissionChoices[university].applicantRoute).toBe("transfer");
  await page.goBack();
  await ready(page);
  await page.goForward();
  await ready(page);
  await openAdmissionSelectionEditor(page);
  await expect(page.locator("#admissionsApplicant")).toHaveValue("transfer");
});

test("Stanford retries failures and keeps selection through an empty search", async ({ page }) => {
  await prepare(page, presentations[1]);
  await page.goto(`/university.html?id=${university}`);
  await ready(page);
  await page.route(`**/universities/${university}/admissions-context`, route => route.fulfill({ status: 503, contentType: "application/json", body: '{"detail":"Unavailable"}' }), { times: 1 });
  await tab(page, "programs");
  await page.locator("#admissionsSearch").fill("Computer Science");
  const searchResponse = page.waitForResponse(response => {
    const url = new URL(response.url());
    return url.pathname.endsWith("/study-options") && url.searchParams.get("search") === "Computer Science";
  });
  await page.locator("#admissionsSearchSubmit").click();
  expect((await searchResponse).ok()).toBe(true);
  await expect(page.locator("#admissionsSearchSubmit")).toBeEnabled();
  await page.locator('[data-study-option="stanford-option-cs-ms"]').click();
  await expect(page.locator("#admissionsContext")).toHaveAttribute("data-state", "error");
  await page.locator('#admissionsStudyInfo [data-admissions-retry="context"]').click();
  await ready(page);
  await route(page, "directory-evidence:stanford-graduate-cs-ms");
  await tab(page, "programs");
  await page.locator("#admissionsSearch").fill("no such published course 123");
  await page.locator("#admissionsSearchSubmit").click();
  await expect(page.locator("#admissionsProgramList [data-study-option]")).toHaveCount(0);
  await expect(page.locator("#admissionsSelectedProgram")).toBeVisible();
  await expect(page.locator("#admissionsReferenceSummary")).toContainText("MS");
});

test("Stanford ignores an older response after Back and retains keyboard focus", async ({ page }) => {
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
  await page.goto(`/university.html?id=${university}&admission_option=stanford-option-cs-ms&admission_application_route=directory-evidence:stanford-graduate-cs-ms&admission_level=masters&admission_cycle=2026%20entry`);
  await ready(page);
  await openAdmissionSelectionEditor(page);
  await page.locator("#admissionsAdvanced > summary").focus();
  await page.keyboard.press("Tab");
  await expect(page.locator("#admissionsContextApply")).toBeFocused();
  expect(await page.locator("#admissionsContextApply").evaluate(node => getComputedStyle(node).outlineWidth)).toBe("2px");
  await openAdvanced(page);
  await page.locator("#admissionsCycle").fill("2027 entry");
  await page.locator("#admissionsContextApply").click();
  await fetchedResponse;
  await expect(page.locator("#admissionsContextApply")).toBeDisabled();
  await expect(page.locator("#admissionsSaveChoice")).toBeDisabled();
  await page.goBack();
  await ready(page);
  await expect(page.locator("#admissionsCycle")).toHaveValue("2026 entry");
  release();
  await expect(page.locator("#admissionsContext")).toHaveAttribute("data-state", "ready");
  await expect(page.locator("#admissionsCycle")).toHaveValue("2026 entry");
});

for (const [index, entry] of [
  { option: "stanford-option-econ-ba", search: "Economics", original: /macroeconomic|microeconomic/ },
  { option: "stanford-option-arths-ma", search: "Art History", original: /only to doctoral students/ },
  { option: "stanford-option-ed-ma-cte", search: "Curriculum and Teacher Education", original: /no admission intake for2027[-‑]28/ },
].entries()) {
  test(`Stanford sourced overview preserves the distinct ${entry.option} scope`, async ({ page }) => {
    await prepare(page, presentations[index]);
    await page.goto(`/university.html?id=${university}`);
    await ready(page);
    await program(page, entry.option, entry.search);
    await expect(page.locator("#admissionsStudyOverview > .program-card__description")).not.toBeEmpty();
    await page.locator("[data-program-original] > summary").click();
    await expect(page.locator("[data-program-original] p")).toContainText(entry.original);
    await expect(page.locator("#admissionsStudyOverview")).not.toContainText(/Bulletin flags|externalAdmissions/);
    await screenshot(page, `overview-${entry.option}-${presentations[index].language}`, "#admissionsStudyOverview");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(presentations[index].width);
  });
}

test("Stanford catalog and map retain the chosen cost basis, currency and study level", async ({ page }) => {
  await prepare(page, presentations[0]);
  await page.route("**/currency/rates", route => route.fulfill({ contentType: "application/json", body: JSON.stringify({ rates: { USD: 1, KZT: 450 }, date: "2026-10-19", source: "test" }) }));
  await page.goto("/index.html?q=Stanford&max_tuition=70000");
  await expect(page.locator("body")).toHaveAttribute("data-page", "universities");
  const card = page.locator(`#universitiesList .uni-card[data-uni-id="${university}"]`);
  await expect(page.locator(".u-state-card--empty")).toBeVisible();
  await select(page, "costBasisSelect", "tuition");
  await expect(card).toBeVisible();
  await expect(card.locator('[data-cost-basis="tuition"]')).toContainText(/67[\s,]?731/);
  await expect(card.locator('[data-cost-basis="annual_total"]')).toHaveCount(0);
  await select(page, "sortSelect", "tuition_asc");
  await expect(card).toBeVisible();
  await page.locator('#catalogLevelSegmented [data-level="master"]').click();
  await expect(page.locator('#catalogLevelSegmented [data-level="master"]')).toHaveAttribute("aria-pressed", "true");
  await expect(card).toHaveCount(0);
  await page.locator('#catalogLevelSegmented [data-level="bachelor"]').click();
  await expect(card).toBeVisible();
  await page.locator("#settingsBtn").click();
  await expect(page.locator("#settingsModal")).toHaveClass(/is-open/);
  await select(page, "settingPreferredCurrency", "KZT");
  await select(page, "settingCurrencyDisplay", "preferred");
  await page.locator("#settingsCloseBtn").click();
  await expect(page.locator("#settingsModal")).not.toHaveClass(/is-open/);
  await expect(card.locator('[data-cost-basis="tuition"]')).toContainText(/₸|KZT/);
  await page.reload();
  await expect(card).toBeVisible();
  await expect(page.locator("#costBasisSelect")).toHaveValue("tuition");
  await expect(page.locator("#sortSelect")).toHaveValue("tuition_asc");
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
  await expect(popup.locator('[data-cost-basis="tuition"]')).toContainText(/₸|KZT/);
  await expect(popup.locator('[data-cost-basis="annual_total"]')).toHaveCount(0);
  await popup.locator('.uni-cost-trigger').click();
  await expect(popup.locator('.uni-cost-tooltip [role="tooltip"]')).toBeVisible();
  await expect(popup).toContainText("2026");
  await screenshot(page, "eng-1280-map-tuition-kzt", "#mapContainer");
});

const completedMedicalOverviews = [
  ["bioc-phd", "Biochemistry"],
  ["bmds-phd", "Biomedical Data Science"],
  ["bmp-phd", "Biomedical Physics"],
  ["canbi-phd", "Cancer Biology"],
  ["csb-phd", "Chemical and Systems Biology"],
  ["dbio-phd", "Developmental Biology"],
  ["epidcr-phd", "Epidemiology and Clinical Research"],
  ["gene-phd", "Genetics"],
  ["hrp-phd", "Health Policy"],
  ["hmn-gen-ms", "Human Genetics and Genetic Counseling"],
  ["immun-phd", "Immunology"],
  ["mcp-phd", "Molecular and Cellular Physiology"],
  ["mi-phd", "Microbiology and Immunology"],
  ["neurs-phd", "Neurosciences"],
  ["sbio-phd", "Structural Biology"],
  ["stmrm-phd", "Stem Cell Biology and Regenerative Medicine"],
];

for (const [languageIndex, language] of ["eng", "rus", "kaz"].entries()) {
  test(`Stanford all sixteen completed medical overviews are readable with originals in ${language}`, async ({ page }) => {
    test.setTimeout(180000);
    await prepare(page, { language, width: 1280, theme: language === "rus" ? "dark" : "light" });
    await page.goto(`/university.html?id=${university}`);
    await ready(page);
    for (const [index, [suffix, search]] of completedMedicalOverviews.entries()) {
      const width = [1280, 390, 320][(index + languageIndex) % 3];
      await page.setViewportSize({ width, height: 900 });
      await program(page, `stanford-option-${suffix}`, search);
      const overview = page.locator("#admissionsStudyOverview");
      const summary = overview.locator(":scope > .program-card__description");
      await expect(summary).not.toBeEmpty();
      if (language !== "eng") await expect(summary).toContainText(/[\u0400-\u04ff]/u);
      await expect(overview.locator("[data-program-overview-missing]")).toHaveCount(0);
      await expect(overview).not.toContainText(/Bulletin flags:|externalAdmissions|programCurrentPhdOnly/);
      const sourceRecord = page.locator(`#admissionsStudyInfo [data-admissions-fact="medicine-graduate-evidence:study-overview-${suffix}"]`);
      await expect(sourceRecord).toHaveCount(1);
      if (suffix === "hmn-gen-ms") await expect(summary).toContainText(/cannot automatically transfer|автоматического перехода|автоматты ауысу/i);
      if (suffix === "sbio-phd") {
        await expect(summary).toContainText("2026");
        await expect(summary).toContainText("GRE");
        await expect(summary).toContainText(/23:59:59|11:59:59/);
        await screenshot(page, `completed-overview-${language}-${width}-structural-biology`, "#admissionsStudyOverview");
      }
      const original = overview.locator("[data-program-original]");
      await expect(original.locator("p")).toBeHidden();
      await original.locator(":scope > summary").click();
      await expect(original.locator("p")).toBeVisible();
      const official = original.locator('a[href^="https://bulletin.stanford.edu/programs/"]');
      await expect(official).not.toHaveCount(0);
      await expect(official.first()).toBeVisible();
      if (suffix === "sbio-phd") {
        await expect(original).toContainText("December 15");
        await expect(original).toContainText("GRE general score is optional");
        await expect(original.locator('a[href="https://med.stanford.edu/structuralbio/education/application.html"]')).toBeVisible();
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      await expectNoStackedGapMargins(page, "#admissionsStudyOverview");
      await original.locator(":scope > summary").click();
    }
    await page.reload();
    await ready(page);
    await tab(page, "programs");
    await expect(page.locator('[data-study-option="stanford-option-stmrm-phd"]')).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator("#admissionsStudyOverview > .program-card__description")).not.toBeEmpty();
  });
}
