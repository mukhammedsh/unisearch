const { test, expect } = require("./helpers/coverage-test.cjs");
const { setNativeSelect } = require("./helpers/selectors");

const cases = [
  {
    name: "MIT first-year Computer Science",
    university: "mit-usa-cambridge",
    option: "mit-course-6-3-bachelor",
    route: "mit-first-year",
    level: "undergraduate",
    applicant: "first_year",
    cycle: "Fall 2027 entry",
    fee: "unknown",
    viewport: { width: 1280, height: 900 },
    language: "eng",
    theme: "light",
    tab: "admission",
    facts: [
      { id: "ug-sat-act-presence", text: /SAT.*ACT|ACT.*SAT/i },
    ],
    excludedFacts: ["reviewed-mit_eecs_doctoral_admissions-tests"],
    finance: { note: /comparable annual total is not established|сопоставимая годовая сумма.*не установлена/i },
  },
  {
    name: "MIT EECS doctoral Computer Science",
    university: "mit-usa-cambridge",
    option: "mit-eecs-phd-course-6",
    route: "mit_eecs_doctoral_admissions",
    level: "doctoral",
    applicant: "graduate",
    cycle: "",
    fee: "unknown",
    viewport: { width: 390, height: 844 },
    language: "rus",
    theme: "dark",
    tab: "admission",
    facts: [
      { id: "reviewed-mit_eecs_doctoral_admissions-tests", text: /GRE.*(not required|не требуется)|(?:not required|не требуется).*GRE/i },
      { id: "reviewed-mit_eecs_doctoral_admissions-application-window", tab: "deadlines", text: /December 1|year not stated/i },
      { id: "reviewed-mit_eecs_doctoral_admissions-funding", tab: "finance", text: /automatically considered|full tuition|medical insurance/i },
    ],
    excludedFacts: ["ug-sat-act-presence"],
    finance: { note: /comparable annual total is not established|сопоставимая годовая сумма.*не установлена/i, excluded: /MIT Need-Based Scholarship/i },
  },
  {
    name: "Imperial Computing MEng",
    university: "imperial-college-london-uk",
    option: "imperial-option-computing-meng",
    route: "procedure-computing-meng",
    level: "undergraduate",
    applicant: "first_year",
    cycle: "2027 entry",
    fee: "unknown",
    viewport: { width: 1280, height: 900 },
    language: "eng",
    theme: "light",
    tab: "admission",
    facts: [
      { id: "imperial-computing-meng-admission", text: /TMUA/i },
      { id: "imperial-ucas-process", text: /UCAS.*I50|I50.*UCAS/i },
      { id: "imperial-ucas-2027-window", tab: "deadlines", text: /2027|UCAS/i },
      { id: "imperial-computing-meng-course-profile", tab: "finance", text: /Home|Overseas/i },
    ],
    excludedFacts: ["imperial-computing-admission"],
    finance: { note: /comparable annual total is not established|сопоставимая годовая сумма.*не установлена/i },
  },
  {
    name: "Imperial Computing MSc",
    university: "imperial-college-london-uk",
    option: "imperial-option-computing",
    route: "procedure-computing",
    level: "masters",
    applicant: "graduate",
    cycle: "2027 entry",
    fee: "unknown",
    viewport: { width: 390, height: 844 },
    language: "rus",
    theme: "dark",
    tab: "admission",
    facts: [
      { id: "imperial-computing-admission", text: /First-Class/i },
      { id: "imperial-computing-application-details", tab: "deadlines", text: /application rounds|staged admissions/i },
      { id: "imperial-computing-course-profile", tab: "finance", text: /Home|Overseas/i },
    ],
    excludedFacts: ["imperial-computing-meng-admission"],
    finance: { note: /comparable annual total is not established|сопоставимая годовая сумма.*не установлена/i },
  },
  {
    name: "Stanford external Computer Science MS",
    university: "stanford-university-usa-ca",
    option: "stanford-option-cs-ms",
    route: "engineering-doerr-evidence:external-graduate",
    level: "masters",
    applicant: "graduate",
    cycle: "2027-28 entry",
    fee: "unknown",
    viewport: { width: 1280, height: 900 },
    language: "eng",
    theme: "light",
    tab: "admission",
    facts: [
      { id: "engineering-doerr-evidence:graduate-entry-eligibility", text: /bachelor.*equivalent|recognized international equivalent/i },
      { id: "engineering-doerr-evidence:graduate-application-limit", text: /one.*graduate degree program|one Stanford graduate degree program/i },
    ],
    finance: { note: /comparable annual total is not established|сопоставимая годовая сумма.*не установлена/i },
  },
  {
    name: "Stanford current-student Computer Science coterm",
    university: "stanford-university-usa-ca",
    option: "stanford-option-cs-ms",
    route: "engineering-doerr-evidence:cs-coterm",
    level: "masters",
    applicant: "",
    cycle: "2026-27 to 2027-28 entries",
    fee: "unknown",
    viewport: { width: 390, height: 844 },
    language: "rus",
    theme: "dark",
    tab: "admission",
    facts: [
      { id: "coterm-central-evidence:stanford-coterm-central-eligibility", text: /Current Stanford undergraduate|120 units/i },
      { id: "coterm-central-evidence:stanford-coterm-central-application-fee", tab: "finance", text: /125|coterm application fee/i },
    ],
    excludedFacts: ["engineering-doerr-evidence:graduate-application-limit"],
    finance: { note: /comparable annual total is not established|сопоставимая годовая сумма.*не установлена/i },
  },
];

function contextUrl(item) {
  const params = new URLSearchParams({
    id: item.university,
    admission_option: item.option,
    admission_application_route: item.route,
    admission_level: item.level,
    admission_fee: item.fee,
  });
  if (item.applicant) params.set("admission_route", item.applicant);
  if (item.cycle) params.set("admission_cycle", item.cycle);
  return `/university.html?${params.toString()}`;
}

async function openContext(page, item) {
  await page.setViewportSize(item.viewport);
  await page.addInitScript(({ language, theme }) => {
    localStorage.setItem("unisearch_ui_language_v1", language);
    localStorage.setItem("unisearch_theme", theme);
    localStorage.setItem("unisearch_universities_tour_seen_v1", "1");
  }, { language: item.language, theme: item.theme });
  await page.goto(contextUrl(item));
  await expect(page.locator("#detailCard")).toBeVisible();
  await expect(page.locator("#detailName")).not.toBeEmpty();
  await expect(page.locator("#tab-admission")).toHaveClass(/active/);
  await expect(page.locator("#admissionsContext")).toHaveAttribute("data-state", "ready");
  await expect(page.locator("#admissionsRoute")).toHaveValue(item.route);
  await expect(page.locator("#admissionsApplicant")).toHaveValue(item.applicant);
  await expect(page.locator("#admissionsCycle")).toHaveValue(item.cycle);
  await expect(page.locator("#admissionsFee")).toHaveValue(item.fee);
  await expect(page.locator("html")).toHaveAttribute("data-theme", item.theme);
}

async function openAdvanced(page) {
  const advanced = page.locator("#admissionsAdvanced");
  if (await advanced.count() && !(await advanced.evaluate((node) => node.open))) await advanced.locator(":scope > summary").click();
}

async function openAssessment(page) {
  const details = page.locator("#detailRequirements details.admissions-catalog__assessment-detail");
  if (await details.count() && !(await details.evaluate((node) => node.open))) await details.locator(":scope > summary").click();
}

async function openFact(page, tab, id, pattern) {
  await expect(page.locator(`#tab-${tab}`)).toHaveClass(/active/);
  const fact = page.locator(`.d-tab-pane.active [data-admissions-fact="${id}"]`).first();
  const group = fact.locator("xpath=ancestor::details[@data-admissions-group][1]");
  if (await group.count() && !(await group.evaluate((node) => node.open))) await group.locator(":scope > summary").click();
  await expect(fact).toBeVisible();
  const isDetails = await fact.evaluate((node) => node.tagName === "DETAILS");
  if (isDetails && !(await fact.evaluate((node) => node.open))) await fact.locator(":scope > summary").click();
  await expect(fact).toContainText(pattern);
}

for (const item of cases) {
  test(`${item.name} keeps its selected route and scoped facts`, async ({ page }, testInfo) => {
    await openContext(page, item);

    for (const tab of new Set(item.facts.map((fact) => fact.tab || item.tab))) {
      await page.locator(`.d-tab-btn[data-tab="tab-${tab}"]`).click();
      await expect(page.locator(`#tab-${tab}`)).toHaveClass(/active/);
      for (const fact of item.facts.filter((entry) => (entry.tab || item.tab) === tab)) {
        await openFact(page, tab, fact.id, fact.text);
      }
    }
    for (const id of item.excludedFacts || []) {
      await expect(page.locator(`.d-tab-pane [data-admissions-fact="${id}"]`)).toHaveCount(0);
    }

    const context = page.locator("#admissionsContext");
    await expect(context).not.toContainText(/mit-[a-z0-9-]+|imperial-option-[a-z0-9-]+|stanford-option-[a-z0-9-]+/i);
    const currentUrl = new URL(page.url());
    expect(currentUrl.searchParams.get("admission_option")).toBe(item.option);
    expect(currentUrl.searchParams.get("admission_application_route")).toBe(item.route);

    if (item.finance) {
      await page.locator('.d-tab-btn[data-tab="tab-finance"]').click();
      await expect(page.locator("#tab-finance")).toHaveClass(/active/);
      await expect(page.locator("#detailFinance")).toContainText(item.finance.note);
      if (item.finance.excluded) await expect(page.locator("#detailFinance")).not.toContainText(item.finance.excluded);
    }

    if (item.name === "MIT first-year Computer Science" || item.name === "MIT EECS doctoral Computer Science") {
      await page.screenshot({ path: testInfo.outputPath(`${item.name === "MIT first-year Computer Science" ? "desktop" : "mobile"}-admissions-context.png`), fullPage: true });
    }

    if (item.name === "MIT first-year Computer Science") {
      const requirements = page.locator('#detailRequirements .admissions-catalog__section[data-admissions-domain="requirements"]');
      for (const presentation of [
        { name: "desktop-light", theme: "light", width: 1280, height: 900 },
        { name: "desktop-dark", theme: "dark", width: 1280, height: 900 },
        { name: "phone-light", theme: "light", width: 390, height: 844 },
        { name: "phone-dark", theme: "dark", width: 390, height: 844 },
      ]) {
        await page.setViewportSize({ width: presentation.width, height: presentation.height });
        await page.addInitScript(({ language, theme }) => {
          localStorage.setItem("unisearch_ui_language_v1", language);
          localStorage.setItem("unisearch_theme", theme);
        }, { language: item.language, theme: presentation.theme });
        await page.goto(contextUrl(item));
        await expect(page.locator("body")).toHaveAttribute("data-page", "university");
        await expect(page.locator("#detailCard")).toHaveClass(/is-mounted/);
        await expect(page.locator("#tab-admission")).toHaveClass(/active/);
        await expect(page.locator("#admissionsContext")).toHaveAttribute("data-state", "ready");
        await expect(page.locator("#admissionsRoute")).toHaveValue(item.route);
        await expect(page.locator("html")).toHaveAttribute("data-theme", presentation.theme);
        await openFact(page, "admission", "ug-sat-act-presence", /SAT.*ACT|ACT.*SAT/i);
        await expect(requirements).toBeVisible();
        await page.mouse.move(presentation.width - 1, presentation.height - 1);
        // shortcut: the checked-in baseline is Windows-only; add an OS capture before enabling Linux comparisons.
        if (process.platform === "win32") {
          const targetTop = await requirements.evaluate((section) => {
            const navbar = document.querySelector(".navbar");
            return section.getBoundingClientRect().top + window.scrollY - (navbar?.getBoundingClientRect().height || 0);
          });
          await page.evaluate((top) => window.scrollTo({ top: Math.max(0, top), behavior: "instant" }), targetTop);
          await expect(page).toHaveScreenshot(`mit-first-year-admission-requirements-${presentation.name}.png`, {
            animations: "disabled",
            caret: "hide",
          });
        }
      }
    }

    if (item.viewport.width <= 480) {
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(item.viewport.width);
    }
  });
}

const imperialMEng = cases.find(({ name }) => name === "Imperial Computing MEng");
for (const language of ["eng", "rus"]) {
  test(`Imperial Computing MEng route summary is localized in ${language}`, async ({ page }) => {
    await openContext(page, {
      ...imperialMEng,
      language,
      theme: language === "rus" ? "dark" : "light",
    });
    const summary = page.locator("#admissionsContext .admissions-context__summary");
    await expect(summary).toContainText(language === "rus" ? "Выбор программы через UCAS" : "UCAS course choice");
    await expect(summary).not.toContainText("UCAS Hub; institution I50, stated course code");

    await openFact(page, "admission", "imperial-ucas-process", /UCAS.*I50|I50.*UCAS/i);
  });
}

test("program search requires an explicit route and a manual context stays out of the saved profile", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.addInitScript(() => {
    localStorage.setItem("unisearch_ui_language_v1", "eng");
    localStorage.setItem("unisearch_theme", "light");
    localStorage.setItem("unisearch_universities_tour_seen_v1", "1");
    localStorage.setItem("unisearch_profile", JSON.stringify({ gpa: 3.8, applicant_route: "first_year" }));
  });
  await page.goto("/university.html?id=imperial-college-london-uk");
  await expect(page.locator("#detailCard")).toBeVisible();
  await expect(page.locator("#tab-general")).toHaveClass(/active/);
  const originalProfile = await page.evaluate(() => localStorage.getItem("unisearch_profile"));

  await page.locator('.d-tab-btn[data-tab="tab-programs"]').click();
  await setNativeSelect(page, "admissionsStudyLevel", "undergraduate");
  await page.locator("#admissionsSearch").fill("no-such-option-123");
  await page.locator("#admissionsSearchSubmit").click();
  await expect(page.locator("#admissionsProgramList .admissions-state")).toContainText(/no.*study options|no options/i);

  await page.locator("#admissionsSearch").fill("Computing");
  await page.locator("#admissionsSearchSubmit").click();
  const program = page.locator('#admissionsProgramList button[data-study-option="imperial-option-computing-meng"]');
  await expect(program).toBeVisible();
  await program.click();
  await expect(page.locator("#tab-programs")).toHaveClass(/active/);
  await expect(page.locator("#admissionsStudyDetails")).toBeVisible();
  await page.locator("#admissionsViewRequirements").click();
  await expect(page.locator("#tab-admission")).toHaveClass(/active/);
  const routeTrigger = page.locator("#admissionsContext .custom-select-wrapper:has(#admissionsRoute) .custom-select-trigger");
  await expect(routeTrigger).toBeVisible();
  await expect(page.locator("#admissionsContext")).toHaveAttribute("data-state", "ready");
  await expect(page.locator("#admissionsRoute")).toHaveValue("");
  await expect(page.locator("#admissionsContext .admissions-context__status")).toContainText("Choose one of the published paths above to read its requirements and application details.");

  await setNativeSelect(page, "admissionsRoute", "procedure-computing-meng");
  await openAdvanced(page);
  await setNativeSelect(page, "admissionsApplicant", "first_year");
  await page.locator("#admissionsCycle").fill("2027 entry");
  await setNativeSelect(page, "admissionsFee", "unknown");
  await page.locator("#admissionsContextApply").click();
  await expect(page.locator("#admissionsContext")).toHaveAttribute("data-state", "ready");
  await expect(page).toHaveURL(/admission_option=imperial-option-computing-meng/);
  await expect(page).toHaveURL(/admission_application_route=procedure-computing-meng/);
  await expect(page.locator("#admissionsRoute")).toHaveValue("procedure-computing-meng");
  await expect.poll(() => page.evaluate(() => localStorage.getItem("unisearch_profile"))).toBe(originalProfile);

  await page.goBack();
  await expect(page.locator("#tab-programs")).toHaveClass(/active/);
  await expect(page.locator("#admissionsStudyDetails")).toBeVisible();
  await page.locator("#admissionsViewRequirements").click();
  await expect(page.locator("#admissionsContext")).toHaveAttribute("data-state", "ready");
  await expect(page.locator("#admissionsRoute")).toHaveValue("");
  await expect.poll(() => page.evaluate(() => localStorage.getItem("unisearch_profile"))).toBe(originalProfile);
});

test("admissions context retry recovers from one request failure using the live catalog", async ({ page }) => {
  let failedFirstContext = false;
  await page.route("**/admissions-context", async (route) => {
    if (!failedFirstContext) {
      failedFirstContext = true;
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ detail: "Injected one-time E2E failure" }),
      });
      return;
    }
    await route.continue();
  });

  const item = cases[0];
  await page.setViewportSize(item.viewport);
  await page.addInitScript(({ language, theme }) => {
    localStorage.setItem("unisearch_ui_language_v1", language);
    localStorage.setItem("unisearch_theme", theme);
    localStorage.setItem("unisearch_universities_tour_seen_v1", "1");
  }, { language: item.language, theme: item.theme });
  await page.goto(contextUrl(item));
  await expect(page.locator("#detailCard")).toBeVisible();
  await expect(page.locator("#tab-admission")).toHaveClass(/active/);
  await expect(page.locator("#admissionsContext")).toHaveAttribute("data-state", "error");
  await page.locator('#admissionsContext [data-admissions-retry="context"]').click();
  await expect(page.locator("#admissionsContext")).toHaveAttribute("data-state", "ready");
  await expect(page.locator("#admissionsRoute")).toHaveValue(item.route);
  await expect(page.locator("#tab-admission")).toHaveClass(/active/);
  const examFact = page.locator('#tab-admission [data-admissions-fact="ug-sat-act-presence"]').first();
  const examGroup = examFact.locator("xpath=ancestor::details[@data-admissions-group][1]");
  if (await examGroup.count() && !(await examGroup.evaluate((node) => node.open))) await examGroup.locator(":scope > summary").click();
  await expect(examFact).toBeVisible();
  expect(failedFirstContext).toBe(true);
});

test("new profile exam evidence refreshes the selected admissions context", async ({ page }) => {
  const item = cases[0];
  await page.addInitScript(() => {
    localStorage.setItem("unisearch_ui_language_v1", "eng");
    localStorage.setItem("unisearch_theme", "light");
    localStorage.setItem("unisearch_universities_tour_seen_v1", "1");
    localStorage.setItem("unisearch_profile", JSON.stringify({}));
  });
  await page.goto(contextUrl(item));
  await expect(page.locator("#admissionsContext")).toHaveAttribute("data-state", "ready");
  await expect(page.locator("#tab-admission")).toHaveClass(/active/);
  const examCheck = page.locator("#detailRequirements .admissions-catalog__check").filter({ hasText: "Required test alternatives" });
  await openAssessment(page);
  await expect(examCheck).toContainText("Evidence missing");

  const refreshed = page.waitForResponse((response) => response.url().includes("/admissions-context") && response.request().method() === "POST");
  await page.evaluate(() => {
    localStorage.setItem("unisearch_profile", JSON.stringify({ exams: [{ exam: "ACT", score: 34 }] }));
    window.dispatchEvent(new Event("profileUpdated"));
  });
  await refreshed;
  await expect(page.locator("#admissionsContext")).toHaveAttribute("data-state", "ready");
  await openAssessment(page);
  await expect(examCheck).toContainText("Met");
});

test("a delayed old context response cannot replace the latest selected cycle", async ({ page }) => {
  let releaseOldResponse;
  let oldResponseFetched;
  const oldResponseGate = new Promise((resolve) => { releaseOldResponse = resolve; });
  const fetchedOldResponse = new Promise((resolve) => { oldResponseFetched = resolve; });
  await page.route("**/admissions-context", async (route) => {
    const body = JSON.parse(route.request().postData() || "{}");
    if (body.context?.intended_entry_cycle === "Fall 2027 entry") {
      const response = await route.fetch();
      oldResponseFetched();
      await oldResponseGate;
      await route.fulfill({ response });
      return;
    }
    await route.continue();
  });

  const item = { ...cases[0], cycle: "Fall 2026 entry" };
  await page.setViewportSize(item.viewport);
  await page.addInitScript(({ language, theme }) => {
    localStorage.setItem("unisearch_ui_language_v1", language);
    localStorage.setItem("unisearch_theme", theme);
    localStorage.setItem("unisearch_universities_tour_seen_v1", "1");
  }, { language: item.language, theme: item.theme });
  await page.goto(contextUrl(item));
  await expect(page.locator("#admissionsContext")).toHaveAttribute("data-state", "ready");

  await openAdvanced(page);
  const firstRequest = page.waitForRequest((request) => {
    if (!request.url().includes("/admissions-context") || request.method() !== "POST") return false;
    return JSON.parse(request.postData() || "{}").context?.intended_entry_cycle === "Fall 2027 entry";
  });
  await page.locator("#admissionsCycle").fill("Fall 2027 entry");
  await page.locator("#admissionsContextApply").click();
  await firstRequest;
  await fetchedOldResponse;

  const backRequest = page.waitForResponse((response) => {
    if (!response.url().includes("/admissions-context") || response.request().method() !== "POST") return false;
    return JSON.parse(response.request().postData() || "{}").context?.intended_entry_cycle === "Fall 2026 entry";
  });
  await page.goBack();
  await backRequest;
  await expect(page.locator("#admissionsContext")).toHaveAttribute("data-state", "ready");
  await expect(page.locator("#admissionsCycle")).toHaveValue("Fall 2026 entry");
  expect(new URL(page.url()).searchParams.get("admission_cycle")).toBe("Fall 2026 entry");

  releaseOldResponse();
  await expect.poll(() => page.locator("#admissionsCycle").inputValue()).toBe("Fall 2026 entry");
  await expect(page.locator("#admissionsContext")).toHaveAttribute("data-state", "ready");
});

test("Stanford deadline and GRE table labels stay readable in a mobile admissions context", async ({ page }, testInfo) => {
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  const item = cases.find((entry) => entry.name === "Stanford external Computer Science MS");
  await openContext(page, item);
  await expect(page.locator('#admissionsRoute option:checked')).toHaveText("external non-professional graduate application");
  await expect(page.locator('#admissionsRoute option[value="engineering-doerr-evidence:cs-coterm"]')).toHaveText("Computer Science coterm application");
  await page.locator('.d-tab-btn[data-tab="tab-deadlines"]').click();
  await expect(page.locator("#tab-deadlines")).toHaveClass(/active/);

  const table = page.locator('#tab-deadlines [data-admissions-fact="engineering-doerr-evidence:program-deadline-gre-2027"]').first();
  const group = table.locator("xpath=ancestor::details[@data-admissions-group][1]");
  if (await group.count() && !(await group.evaluate((node) => node.open))) await group.locator(":scope > summary").click();
  await expect(table).toBeVisible();
  const isDetails = await table.evaluate((node) => node.tagName === "DETAILS");
  if (isDetails && !(await table.evaluate((node) => node.open))) await table.locator(":scope > summary").click();
  await expect(table).toContainText("Computer Science (MS)");
  await expect(table).toContainText(/2026[-‑]12-08/);
  await expect(table).toContainText("Aeronautics and Astronautics (MS)");
  await expect(table).not.toContainText(/stanford-aa-ms|stanford-cs-ms|source-[a-f0-9]+/i);

  await page.locator('.d-tab-btn[data-tab="tab-admission"]').click();
  await expect(page.locator("#tab-admission")).toHaveClass(/active/);
  await openAdvanced(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => {
    localStorage.setItem("unisearch_theme", "dark");
    document.documentElement.setAttribute("data-theme", "dark");
  });
  const cycle = page.locator("#admissionsCycle");
  await page.waitForLoadState("networkidle");
  await expect(page.locator("#detailCard")).not.toHaveClass(/is-language-refreshing/);
  await expect(page.locator("#admissionsRoute")).toBeEnabled();
  await expect(page.locator("#admissionsContext .custom-select-wrapper:has(#admissionsRoute) .custom-select-trigger")).toHaveAttribute("aria-disabled", "false");
  await cycle.evaluate((element) => element.scrollIntoView({ block: "center", behavior: "instant" }));
  const geometry = await cycle.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const navbar = document.querySelector(".navbar").getBoundingClientRect();
    const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    return {
      top: rect.top,
      navbarBottom: navbar.bottom,
      centerIsInput: hit === element || element.contains(hit),
    };
  });
  expect(geometry.top).toBeGreaterThanOrEqual(geometry.navbarBottom);
  expect(geometry.centerIsInput).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("stanford-source-table-mobile-viewport.png"), fullPage: false });

  const route = page.locator("#admissionsRoute");
  const routeWrapper = page.locator("#admissionsContext .custom-select-wrapper:has(#admissionsRoute)");
  const routeTrigger = routeWrapper.locator(".custom-select-trigger");
  await routeTrigger.scrollIntoViewIfNeeded();
  await routeTrigger.click();
  const routeOption = routeWrapper.locator('.custom-option[data-value="engineering-doerr-evidence:external-graduate"]');
  await expect(routeOption).toBeVisible();
  await routeOption.click();
  await expect(route).toHaveValue("engineering-doerr-evidence:external-graduate");

  const applicant = page.locator("#admissionsApplicant");
  const applicantTrigger = page.locator("#admissionsContext .custom-select-wrapper:has(#admissionsApplicant) .custom-select-trigger");
  await applicantTrigger.focus();
  await applicantTrigger.press("ArrowDown");
  await applicantTrigger.press("Home");
  await applicantTrigger.press("ArrowDown");
  await applicantTrigger.press("Enter");
  await expect(applicant).toHaveValue("first_year");
  await applicantTrigger.press("g");
  await expect(applicant).toHaveValue("graduate");
  await expect(page.locator("#admissionsContext")).toHaveAttribute("data-state", "ready");
  expect(pageErrors).toEqual([]);
});

test("dynamic admission controls release global subscriptions on refresh and page disposal", async ({ page }) => {
  await page.addInitScript(() => {
    const languageListeners = new Set();
    const add = window.addEventListener.bind(window);
    const remove = window.removeEventListener.bind(window);
    window.addEventListener = (type, handler, options) => {
      if (type === "languageChanged") languageListeners.add(handler);
      return add(type, handler, options);
    };
    window.removeEventListener = (type, handler, options) => {
      if (type === "languageChanged") languageListeners.delete(handler);
      return remove(type, handler, options);
    };
    window.__testLanguageListenerCount = () => languageListeners.size;
  });
  await openContext(page, cases[0]);
  await page.waitForLoadState("networkidle");
  const baseline = await page.evaluate(() => window.__testLanguageListenerCount());
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.locator("#admissionsContextApply").click();
    await expect(page.locator("#admissionsContext")).toHaveAttribute("data-state", "ready");
    expect(await page.evaluate(() => window.__testLanguageListenerCount())).toBe(baseline);
  }
  await page.evaluate(async () => {
    const { disposeUniversityPage } = await import("/javascript/pages/university.js");
    disposeUniversityPage();
  });
  expect(await page.evaluate(() => window.__testLanguageListenerCount())).toBeLessThanOrEqual(baseline - 4);
});
