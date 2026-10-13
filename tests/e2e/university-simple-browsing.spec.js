const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");
const { setNativeSelect } = require("./helpers/selectors");
const screenshotDir = path.resolve(__dirname, "../../.tmp_test/simplify-top3-browsing");

const journeys = [
  { name: "MIT first-year", university: "mit-usa-cambridge", option: "mit-course-6-3-bachelor", search: "Computer Science", route: "mit-first-year", applicant: "first_year", viewport: { width: 1280, height: 900 }, language: "eng", theme: "light", domains: ["mit.edu", "mitadmissions.org"] },
  { name: "MIT doctoral", university: "mit-usa-cambridge", option: "mit-eecs-phd-course-6", search: "Computer Science and Engineering", route: "mit_eecs_doctoral_admissions", applicant: "graduate", viewport: { width: 390, height: 844 }, language: "rus", theme: "dark", domains: ["mit.edu", "mitadmissions.org"] },
  { name: "Imperial Computing MEng", university: "imperial-college-london-uk", option: "imperial-option-computing-meng", search: "Computing", route: "procedure-computing-meng", applicant: "first_year", viewport: { width: 1280, height: 900 }, language: "rus", theme: "dark", domains: ["imperial.ac.uk"] },
  { name: "Imperial Computing MSc", university: "imperial-college-london-uk", option: "imperial-option-computing", search: "Computing", route: "procedure-computing", applicant: "graduate", viewport: { width: 390, height: 844 }, language: "eng", theme: "light", domains: ["imperial.ac.uk"] },
  { name: "Stanford CS external MS", university: "stanford-university-usa-ca", option: "stanford-option-cs-ms", search: "Computer Science", route: "engineering-doerr-evidence:external-graduate", applicant: "graduate", viewport: { width: 1280, height: 900 }, language: "eng", theme: "dark", domains: ["stanford.edu"] },
  { name: "Stanford CS coterm MS", university: "stanford-university-usa-ca", option: "stanford-option-cs-ms", search: "Computer Science", route: "engineering-doerr-evidence:cs-coterm", applicant: "", viewport: { width: 390, height: 844 }, language: "rus", theme: "light", domains: ["stanford.edu"] },
];

async function openGuestUniversity(page, item) {
  await page.setViewportSize(item.viewport);
  await page.addInitScript(({ language, theme }) => {
    localStorage.setItem("unisearch_ui_language_v1", language);
    localStorage.setItem("unisearch_theme", theme);
    localStorage.setItem("unisearch_universities_tour_seen_v1", "1");
  }, { language: item.language, theme: item.theme });
  await page.goto(`/university.html?id=${item.university}`);
  await expect(page.locator("body")).toHaveAttribute("data-page", "university");
  await expect(page.locator("#detailCard")).toHaveClass(/is-mounted/);
  await expect(page.locator("#detailName")).not.toBeEmpty();
  await expect(page.locator(".d-tab-btn.active")).toHaveAttribute("data-tab", "tab-general");
  await expect(page.locator("#detailExtra")).not.toBeEmpty();
  await expect(page.locator("html")).toHaveAttribute("data-theme", item.theme);
  await expect(page.locator("#admissionsContext")).toHaveAttribute("data-state", "ready");
  await expect(page.locator("#siteInitialLoader")).toBeHidden();
  await expect(page.locator(".global-loading-overlay")).toBeHidden();
}

async function chooseOption(page, item) {
  await page.locator('.d-tab-btn[data-tab="tab-programs"]').click();
  await expect(page.locator("#tab-programs")).toHaveClass(/active/);
  await expect(page.locator("#admissionsProgramCount")).not.toBeEmpty();
  await page.locator("#admissionsSearch").fill(item.search);
  await page.locator("#admissionsSearchForm").locator('button[type="submit"]').click();
  const option = page.locator(`#admissionsProgramList [data-study-option="${item.option}"]`);
  await expect(option).toBeVisible();
  await option.click();
  await expect(page.locator("#admissionsStudyDetails")).toBeVisible();
  await expectProgramFacts(page, item);
  await expect(page.locator("#admissionsStudyInfo .admissions-catalog__assessment")).toHaveCount(0);
  await expect(page.locator("#admissionsStudyDetails .admissions-context__note")).toHaveCount(2);
  await expect(page.locator("#admissionsStudyDetails .admissions-context__note").last()).not.toBeEmpty();
  const url = new URL(page.url());
  expect(url.searchParams.get("admission_option")).toBe(item.option);
  expect(url.searchParams.get("admission_application_route")).toBe("");
  await expect(page.locator("#admissionsViewRequirements")).toBeEnabled();
  await page.locator("#admissionsViewRequirements").click();
  await expect(page.locator("#tab-admission")).toHaveClass(/active/);
  await expect(page.locator("#admissionsContext[data-state='ready']")).toBeVisible();
}

async function expectProgramFacts(page, item) {
  const facts = page.locator("#admissionsStudyInfo [data-admissions-domain] [data-admissions-fact]");
  await expect(facts.first()).toBeVisible();
  const source = facts.locator('a[href^="https://"]').first();
  await expect(source).toHaveCount(1);
  const fact = source.locator("xpath=ancestor::details[@data-admissions-fact][1]");
  if (!(await fact.evaluate((node) => node.open))) await fact.locator(":scope > summary").click();
  await expect(source).toBeVisible();
  const official = await source.evaluate((link, domains) => {
    const hostname = new URL(link.href).hostname;
    return domains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
  }, item.domains);
  expect(official).toBe(true);
}

async function chooseRoute(page, item) {
  const advanced = page.locator("#admissionsAdvanced[data-admissions-advanced]");
  await expect(advanced).toBeVisible();
  await expect(advanced).not.toHaveAttribute("open", "");
  const applicantWrapper = page.locator("#admissionsApplicant").locator("xpath=..");
  const feeWrapper = page.locator("#admissionsFee").locator("xpath=..");
  await expect(applicantWrapper.locator(".custom-select-trigger")).toBeHidden();
  await expect(page.locator("#admissionsCycle")).toBeHidden();
  await expect(feeWrapper.locator(".custom-select-trigger")).toBeHidden();

  const route = page.locator("#admissionsRoute");
  const routeWrapper = route.locator("xpath=..");
  await expect(routeWrapper.locator(".custom-select-trigger")).toBeVisible();
  await expect(route).toHaveValue("");
  await routeWrapper.locator(".custom-select-trigger").click();
  const routeOption = routeWrapper.locator(`.custom-option[data-value="${item.route}"]`);
  await expect(routeOption).toBeVisible();
  await routeOption.click();
  await expect(route).toHaveValue(item.route);

  await advanced.locator(":scope > summary").click();
  await expect(advanced).toHaveAttribute("open", "");
  await expect(applicantWrapper.locator(".custom-select-trigger")).toBeVisible();
  await expect(page.locator("#admissionsCycle")).toBeVisible();
  await expect(feeWrapper.locator(".custom-select-trigger")).toBeVisible();
  if (item.applicant) await setNativeSelect(page, "admissionsApplicant", item.applicant);
  await page.locator("#admissionsContextApply").click();
  await expect(page.locator("#admissionsContext[data-state='ready']")).toBeVisible();
  await expect(route).toHaveValue(item.route);
  expect(new URL(page.url()).searchParams.get("admission_application_route")).toBe(item.route);
}

async function expectOfficialFact(page, item) {
  const facts = page.locator("#detailRequirements [data-admissions-domain] [data-admissions-fact]");
  await expect(facts.first()).toBeVisible();
  const firstSource = facts.locator('a[href^="https://"]').first();
  await expect(firstSource).toHaveCount(1);
  const sourcedFact = firstSource.locator("xpath=ancestor::details[@data-admissions-fact][1]");
  await expect(sourcedFact).toBeVisible();
  const summary = sourcedFact.locator(":scope > summary");
  if (!(await sourcedFact.evaluate((node) => node.open))) await summary.click();
  const sources = sourcedFact.locator('a[href^="https://"]');
  await expect(sources.first()).toBeVisible();
  const officialSourceAvailable = await sources.evaluateAll((links, domains) => links.some((link) => {
    const hostname = new URL(link.href).hostname;
    return domains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
  }), item.domains);
  expect(officialSourceAvailable).toBe(true);
}

for (const item of journeys) {
  test(`${item.name} supports guest browsing before explicit route selection`, async ({ page }) => {
    await openGuestUniversity(page, item);
    await expect(page.locator("#admissionsContextForm")).toBeHidden();
    await chooseOption(page, item);
    await chooseRoute(page, item);
    await expectOfficialFact(page, item);

    fs.mkdirSync(screenshotDir, { recursive: true });
    const filename = `${item.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.png`;
    await page.screenshot({ path: path.join(screenshotDir, filename), fullPage: true });

    if (item.viewport.width <= 480) {
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(item.viewport.width);
    }
  });
}

test("undergraduate requirements in all three universities can be read without additional applicant details", async ({ page }, testInfo) => {
  const choices = [journeys[0], journeys[2], {
    ...journeys[5], name: "Stanford CS undergraduate", option: "stanford-option-cs-bs",
    route: "undergraduate-shared-evidence:stanford-first-year",
  }];
  for (const item of choices) {
    await openGuestUniversity(page, item);
    await page.screenshot({ path: testInfo.outputPath(`${item.university}-overview.png`), fullPage: false });
    await chooseOption(page, item);
    const wrapper = page.locator("#admissionsRoute").locator("xpath=..");
    await wrapper.locator(".custom-select-trigger").click();
    await wrapper.locator(`.custom-option[data-value="${item.route}"]`).click();
    const response = page.waitForResponse((response) => response.url().endsWith("/admissions-context") && response.request().method() === "POST");
    await page.locator("#admissionsContextApply").click();
    const context = await (await response).json();
    expect(context.selected_route.id).toBe(item.route);
    expect(context.context.applicant_route).toBeNull();
    await expect(page.locator("#admissionsContext")).toHaveAttribute("data-state", "ready");
    await expect(page.locator("#admissionsAdvanced")).not.toHaveAttribute("open", "");
    await expect(page.locator("#admissionsCycle")).toBeHidden();
    await expectOfficialFact(page, item);
    await page.locator("#admissionsContext").scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath(`${item.university}-basic-requirements.png`), fullPage: false });
  }
});

test("a saved MIT choice survives reload while Back and Forward restore manual route context", async ({ page }) => {
  const item = journeys[0];
  await openGuestUniversity(page, item);
  await chooseOption(page, item);
  await chooseRoute(page, item);
  await page.locator("#admissionsSaveChoice").click();
  await expect(page.locator("#admissionsSaveStatus")).not.toBeEmpty();
  const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem("unisearch_profile") || "{}").selectedAdmissionChoices?.["mit-usa-cambridge"]);
  await expect.poll(saved).toMatchObject({ studyOptionId: item.option, applicationRouteId: item.route });

  await page.reload();
  await expect(page.locator("body")).toHaveAttribute("data-page", "university");
  await expect(page.locator("#detailCard")).toHaveClass(/is-mounted/);
  await expect(page.locator("#admissionsContext[data-state='ready']")).toBeVisible();
  await expect(page.locator("#admissionsRoute")).toHaveValue(item.route);
  await page.goBack();
  await expect.poll(() => new URL(page.url()).searchParams.get("admission_application_route")).toBe("");
  await expect(page.locator("#admissionsRoute")).toHaveValue("");
  await page.goForward();
  await expect.poll(() => new URL(page.url()).searchParams.get("admission_application_route")).toBe(item.route);
  await expect(page.locator("#admissionsRoute")).toHaveValue(item.route);
  await expect.poll(saved).toMatchObject({ studyOptionId: item.option, applicationRouteId: item.route });
});

test("the study-option list can recover from an error and report an empty search", async ({ page }) => {
  const item = journeys[0];
  let failed = false;
  await page.route((url) => new URL(url).pathname.endsWith("/study-options"), async (route) => {
    if (!failed) {
      failed = true;
      await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ detail: "Unavailable" }) });
      return;
    }
    await route.continue();
  });
  await openGuestUniversity(page, item);
  await page.locator('.d-tab-btn[data-tab="tab-programs"]').click();
  await expect(page.locator("#tab-programs")).toHaveClass(/active/);
  const retry = page.locator('#admissionsProgramList [data-admissions-retry="programs"]');
  await expect(retry).toBeVisible();
  await retry.click();
  await expect(page.locator("#admissionsProgramList [data-study-option]").first()).toBeVisible();

  await page.locator("#admissionsSearch").fill("No real study option should match this query");
  const emptyResults = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname.endsWith("/study-options") && url.searchParams.get("search") === "No real study option should match this query";
  });
  await page.locator("#admissionsSearchForm").locator('button[type="submit"]').click();
  await emptyResults;
  await expect(page.locator("#admissionsProgramList [data-study-option]")).toHaveCount(0);
  await expect(page.locator("#admissionsProgramList .admissions-state")).toBeVisible();
  await expect(page.locator('#admissionsProgramList [role="alert"]')).toHaveCount(0);
});

test("a failed earlier detail request cannot replace the newly opened university", async ({ page }) => {
  await openGuestUniversity(page, journeys[0]);
  await expect(page.locator("#admissionsContext")).toHaveAttribute("data-state", "ready");
  let releaseEarlier;
  let earlierStarted;
  const gate = new Promise((resolve) => { releaseEarlier = resolve; });
  const started = new Promise((resolve) => { earlierStarted = resolve; });
  await page.route((url) => url.pathname === "/universities/imperial-college-london-uk", async (route) => {
    earlierStarted();
    await gate;
    await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ detail: "Unavailable" }) });
  });
  try {
    await page.evaluate(async () => {
      const { initUniversityPage } = await import("/javascript/pages/university.js");
      history.pushState({}, "", "/university.html?id=imperial-college-london-uk");
      window.__earlierDetailRequest = initUniversityPage();
    });
    await started;
    await page.evaluate(async () => {
      const { initUniversityPage } = await import("/javascript/pages/university.js");
      history.pushState({}, "", "/university.html?id=stanford-university-usa-ca");
      await initUniversityPage();
    });
    await expect(page.locator("#detailName")).toHaveText("Stanford University");
    releaseEarlier();
    await page.evaluate(() => window.__earlierDetailRequest);
    await expect(page.locator("#detailState")).toBeEmpty();
    await expect(page.locator("#detailName")).toHaveText("Stanford University");
    await expect(page.locator("#admissionsContext")).toHaveAttribute("data-state", "ready");
  } finally {
    releaseEarlier();
  }
});

test("Kazakh browsing keeps all three reviewed catalogs usable and searches a translated subject", async ({ page }) => {
  const choices = [journeys[0], journeys[2], {
    ...journeys[5], option: "stanford-option-cs-bs", search: "Информатика",
  }];
  for (const choice of choices) {
    const item = { ...choice, language: "kaz" };
    await openGuestUniversity(page, item);
    await expect(page.locator("html")).toHaveAttribute("lang", "kk");
    await chooseOption(page, item);
    await expect(page.locator("#admissionsContext h2")).toHaveText("Қабылдау талаптары");
    await expect(page.locator("#admissionsAdvanced > summary")).toContainText("Қосымша мәліметтер");
    await expect(page.locator("#admissionsContextApply")).toHaveText("Талаптарды көрсету");
    await expect(page.locator("#admissionsAdvanced")).not.toHaveAttribute("open", "");
  }
});
