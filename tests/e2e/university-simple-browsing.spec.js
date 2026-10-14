const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");
const screenshotDir = path.resolve(__dirname, "../../.tmp_test/detail-redesign-browsing");

const journeys = [
  { name: "MIT first-year", university: "mit-usa-cambridge", option: "mit-course-6-3-bachelor", search: "Computer Science", route: "mit-first-year", viewport: { width: 1280, height: 900 }, language: "eng", theme: "light", domains: ["mit.edu", "mitadmissions.org"] },
  { name: "MIT doctoral", university: "mit-usa-cambridge", option: "mit-eecs-phd-course-6", search: "Computer Science and Engineering", route: "mit_eecs_doctoral_admissions", viewport: { width: 390, height: 844 }, language: "kaz", theme: "dark", domains: ["mit.edu", "mitadmissions.org"] },
  { name: "Imperial Computing MEng", university: "imperial-college-london-uk", option: "imperial-option-computing-meng", search: "Computing", route: "procedure-computing-meng", viewport: { width: 1280, height: 900 }, language: "rus", theme: "dark", domains: ["imperial.ac.uk"] },
  { name: "Imperial Computing MSc", university: "imperial-college-london-uk", option: "imperial-option-computing", search: "Computing", route: "procedure-computing", viewport: { width: 390, height: 844 }, language: "eng", theme: "light", domains: ["imperial.ac.uk"] },
  { name: "Stanford CS external MS", university: "stanford-university-usa-ca", option: "stanford-option-cs-ms", search: "Computer Science", route: "engineering-doerr-evidence:external-graduate", viewport: { width: 1280, height: 900 }, language: "eng", theme: "dark", domains: ["stanford.edu"] },
  { name: "Stanford CS coterm MS", university: "stanford-university-usa-ca", option: "stanford-option-cs-ms", search: "Computer Science", route: "engineering-doerr-evidence:cs-coterm", viewport: { width: 390, height: 844 }, language: "rus", theme: "light", domains: ["stanford.edu"] },
];

async function openGuestUniversity(page, item) {
  await page.setViewportSize(item.viewport);
  await page.addInitScript(({ language, theme }) => {
    const initialized = sessionStorage.getItem("detail-redesign-test-initialized") === "1";
    if (!initialized) {
      localStorage.clear();
      sessionStorage.clear();
      sessionStorage.setItem("detail-redesign-test-initialized", "1");
    }
    localStorage.setItem("unisearch_ui_language_v1", language);
    localStorage.setItem("unisearch_theme", theme);
    localStorage.setItem("unisearch_universities_tour_seen_v1", "1");
  }, { language: item.language, theme: item.theme });
  await page.goto(`/university.html?id=${item.university}`);
  await expect(page.locator("body")).toHaveAttribute("data-page", "university");
  await expect(page.locator("#detailCard")).toHaveClass(/is-mounted/);
  await expect(page.locator("#detailName")).not.toBeEmpty();
  await expect(page.locator("#detailExtra")).not.toContainText(/(?:computer_science|natural_sciences|social_sciences|private_university)/);
  const expectedLanguage = { eng: "en", rus: "ru", kaz: "kk" }[item.language];
  await expect(page.locator("html")).toHaveAttribute("lang", expectedLanguage);
  const coverWidths = await page.evaluate(() => ({
    card: Math.round(document.getElementById("detailCard").getBoundingClientRect().width),
    cover: Math.round(document.getElementById("detailCover").getBoundingClientRect().width),
  }));
  expect(coverWidths.cover).toBeGreaterThanOrEqual(coverWidths.card - 2);
  await expect(page.locator(".d-tab-btn.active")).toHaveAttribute("data-tab", "tab-general");
  await expect(page.locator("#detailExtra")).not.toBeEmpty();
  await expect(page.locator("html")).toHaveAttribute("data-theme", item.theme);
  await expect(page.locator("#admissionsContext")).toHaveAttribute("data-state", "ready");
  await expect(page.locator("#siteInitialLoader")).toBeHidden();
  await expect(page.locator(".global-loading-overlay")).toBeHidden();
  if (item.name === "MIT first-year") await saveScreenshot(page, "mit-overview-default.png");
  if (item.name === "MIT doctoral") {
    await saveScreenshot(page, "mit-overview-mobile-390.png");
    await page.setViewportSize({ width: 320, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
    await saveScreenshot(page, "mit-overview-mobile-320.png");
    await page.setViewportSize(item.viewport);
  }
}

async function saveScreenshot(page, filename) {
  fs.mkdirSync(screenshotDir, { recursive: true });
  await page.screenshot({ path: path.join(screenshotDir, filename) });
}

async function expectAccessibleTextContrast(locator) {
  const result = await locator.evaluate((element) => {
    const channels = (value) => {
      const values = value.match(/[\d.]+/g)?.map(Number) || [];
      return values.length >= 3 ? { rgb: values.slice(0, 3), alpha: values[3] ?? 1 } : null;
    };
    const foreground = channels(getComputedStyle(element).color)?.rgb;
    const layers = [];
    let backgroundElement = element;
    while (backgroundElement) {
      const style = getComputedStyle(backgroundElement);
      const parsed = channels(style.backgroundColor);
      if (parsed && parsed.alpha > 0) layers.push(parsed);
      backgroundElement = backgroundElement.parentElement;
      if (parsed && parsed.alpha >= 0.99) break;
    }
    if (!foreground || !layers.length || layers.at(-1).alpha < 0.99) return { ratio: 0, foreground, background: null };
    let background = layers.at(-1).rgb;
    for (const layer of layers.slice(0, -1).reverse()) {
      background = layer.rgb.map((channel, index) => channel * layer.alpha + background[index] * (1 - layer.alpha));
    }
    const luminance = (rgb) => rgb.map((channel) => {
      const value = channel / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    }).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
    const values = [luminance(foreground), luminance(background)].sort((left, right) => right - left);
    return {
      ratio: (values[0] + 0.05) / (values[1] + 0.05),
      foreground: `rgb(${foreground.join(", ")})`,
      background: `rgb(${background.join(", ")})`,
    };
  });
  if (process.env.UNISEARCH_DETAIL_CONTRAST === "1") {
    console.info(`[contrast] ${await locator.innerText().catch(() => locator.toString())}: ${result.foreground} on ${result.background} = ${result.ratio.toFixed(2)}:1`);
  }
  expect(result.ratio, `Text contrast should meet WCAG AA; got ${result.ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
}

async function expectHoverAndActiveContrast(page, locator) {
  await locator.hover();
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await expectAccessibleTextContrast(locator);
  const handle = await locator.elementHandle();
  await page.evaluate((element) => {
    const preventAction = (event) => {
      if (!element.contains(event.target)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      document.removeEventListener("click", preventAction, true);
    };
    document.addEventListener("click", preventAction, true);
  }, handle);
  await page.mouse.down();
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await expectAccessibleTextContrast(locator);
  await page.mouse.up();
}

async function openSourceFact(source) {
  const group = source.locator("xpath=ancestor::details[@data-admissions-group][1]");
  if (await group.count()) {
    if (!(await group.evaluate((node) => node.open))) await group.locator(":scope > summary").click();
  }
  const fact = source.locator("xpath=ancestor::*[@data-admissions-fact][1]");
  if (await fact.count()) {
    const isDisclosure = await fact.evaluate((node) => node instanceof HTMLDetailsElement);
    if (isDisclosure && !(await fact.evaluate((node) => node.open))) await fact.locator(":scope > summary").click();
  }
  return fact;
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
  await expect(page.locator("#admissionsContext")).toHaveAttribute("data-state", "ready");
  await expectAccessibleTextContrast(option);
  const selectionActions = page.locator("#admissionsReferenceSummary .admissions-selection__actions button");
  await expect(selectionActions).toHaveCount(2);
  for (const action of await selectionActions.all()) await expectHoverAndActiveContrast(page, action);
  await expect(page.locator("#tab-programs")).toHaveClass(/active/);
  await selectionActions.nth(1).click();
  await expect(page.locator("#tab-admission")).toHaveClass(/active/);
  await page.locator('.d-tab-btn[data-tab="tab-programs"]').click();
  await expect(page.locator("#tab-programs")).toHaveClass(/active/);
  await expectProgramFacts(page, item);
  await expect(page.locator("#admissionsStudyInfo .admissions-catalog__assessment")).toHaveCount(0);
  await expect(page.locator("#admissionsStudyDetails .admissions-context__note")).toHaveCount(1);
  await expect(page.locator("#admissionsStudyDetails .admissions-context__note").first()).not.toBeEmpty();
  await expect(page.locator("#admissionsStudyRelationship")).not.toBeEmpty();
  const officialCourseLink = page.locator("#admissionsStudyRelationship a[href^=\"https://\"]").first();
  if (await officialCourseLink.count()) await expectAccessibleTextContrast(officialCourseLink);
  if (["MIT first-year", "Imperial Computing MEng", "Stanford CS external MS"].includes(item.name)) {
    await page.locator("#admissionsStudyDetails").scrollIntoViewIfNeeded();
    await saveScreenshot(page, `${item.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-program.png`);
  }
  const url = new URL(page.url());
  expect(url.searchParams.get("admission_option")).toBe(item.option);
  expect(url.searchParams.get("admission_application_route")).toBe("");
  await expect(page.locator("#admissionsViewRequirements")).toBeEnabled();
  await page.locator("#admissionsViewRequirements").click();
  await expect(page.locator("#tab-admission")).toHaveClass(/active/);
  await expect(page.locator("#admissionsContext[data-state='ready']")).toBeVisible();
}

async function expectProgramFacts(page, item) {
  const source = page.locator('#admissionsStudyInfo [data-admissions-domain] [data-admissions-fact] a[href^="https://"]').first();
  await expect(source).toHaveCount(1);
  const fact = await openSourceFact(source);
  await expect(fact).toBeVisible();
  await expect(source).toBeVisible();
  await expectAccessibleTextContrast(source);
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

  const route = page.locator("#admissionsRoute");
  const routeWrapper = route.locator("xpath=..");
  await expect(routeWrapper.locator(".custom-select-trigger")).toBeVisible();
  await expect(route).toHaveValue("");
  await routeWrapper.locator(".custom-select-trigger").click();
  const routeOption = routeWrapper.locator(`.custom-option[data-value="${item.route}"]`);
  await expect(routeOption).toBeVisible();
  await routeOption.click();
  await expect(route).toHaveValue(item.route);
  await page.locator("#admissionsContextApply").click();
  await expect(page.locator("#admissionsContext[data-state='ready']")).toBeVisible();
  await expect(advanced).not.toHaveAttribute("open", "");
  await expect(route).toHaveValue(item.route);
  expect(new URL(page.url()).searchParams.get("admission_application_route")).toBe(item.route);
  expect(new URL(page.url()).searchParams.get("admission_route")).toBe("");
}

async function expectOfficialFact(page, item) {
  const firstSource = page.locator('#detailRequirements [data-admissions-domain] [data-admissions-fact] a[href^="https://"]').first();
  await expect(firstSource).toHaveCount(1);
  const sourcedFact = await openSourceFact(firstSource);
  await expect(sourcedFact).toBeVisible();
  const sources = sourcedFact.locator('a[href^="https://"]');
  await expect(sources.first()).toBeVisible();
  await expectAccessibleTextContrast(sources.first());
  await expectAccessibleTextContrast(page.locator(".d-tab-btn.active"));
  const officialSourceAvailable = await sources.evaluateAll((links, domains) => links.some((link) => {
    const hostname = new URL(link.href).hostname;
    return domains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
  }), item.domains);
  expect(officialSourceAvailable).toBe(true);
}

async function expectReferenceTabs(page, item) {
  const summary = page.locator("#admissionsReferenceSummary");
  for (const [tab, pane, domain] of [
    ["tab-deadlines", "#detailDeadlines", "deadlines"],
    ["tab-finance", "#detailFinance", "costs"],
  ]) {
    await page.locator(".d-tabs").scrollIntoViewIfNeeded();
    await page.locator(`.d-tab-btn[data-tab="${tab}"]`).click();
    await expect(page.locator(`#${tab}`)).toHaveClass(/active/);
    await expect(summary).toBeVisible();
    await expect(page.locator(`${pane} [data-admissions-domain="${domain}"]`)).toBeVisible();
    await expect(page.locator(`${pane} .admissions-catalog__fact[open]`).first()).toBeVisible();
    await expect(page.locator(`${pane} .admissions-catalog__meta`).first()).not.toBeEmpty();
    if (domain === "deadlines" && item.name === "MIT first-year") {
      await expect(page.locator(pane)).toContainText("Fall 2027 entry");
      await expect(page.locator(pane)).toContainText("Recurring first-year dates; page does not specify entry year");
    }
    if (domain === "deadlines" && item.name === "Imperial Computing MEng") await expect(page.locator(pane)).toContainText(/2027[\u2011-]01[\u2011-]13/);
    if (domain === "deadlines" && item.name === "Stanford CS external MS") await expect(page.locator(pane)).toContainText(/2026[\u2011-]12[\u2011-]08/);
    if (item.name === "MIT first-year") await saveScreenshot(page, `mit-${domain === "deadlines" ? "dates" : "costs"}.png`);
    if (domain === "costs") {
      await expect(page.locator(`${pane} [data-admissions-domain="funding"]`)).toBeVisible();
      await expect(page.locator(pane)).toContainText(/potential funding is not awarded aid|не считается предоставленной помощью|тағайындалған көмек емес/i);
      if (item.name === "MIT first-year") {
        await expect(page.locator(pane)).toContainText("USD");
        await expect(page.locator(pane)).toContainText("66,720");
      }
    }
  }
}

for (const item of journeys) {
  test(`${item.name} supports guest browsing before explicit route selection`, async ({ page }) => {
    await openGuestUniversity(page, item);
    await expect(page.locator("#admissionsContextForm")).toBeHidden();
    await chooseOption(page, item);
    await chooseRoute(page, item);
    await expectOfficialFact(page, item);
    if (["MIT first-year", "Imperial Computing MEng", "Stanford CS external MS"].includes(item.name)) {
      await page.locator(".d-tabs").scrollIntoViewIfNeeded();
      await saveScreenshot(page, `${item.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-admission.png`);
    }
    await expectReferenceTabs(page, item);

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
    await expect(page.locator("#admissionsContext h2")).toHaveText("Жарияланған өтініш беру жолдары");
    await expect(page.locator("#admissionsAdvanced > summary")).toHaveText("Өтініш беруші санаты, қабылдау кезеңі немесе оқу ақысы бойынша сүзу (міндетті емес)");
    await expect(page.locator("#admissionsContextApply")).toHaveText("Жарияланған мәліметтерді оқу");
    await expect(page.locator("#admissionsAdvanced")).not.toHaveAttribute("open", "");
  }
});
