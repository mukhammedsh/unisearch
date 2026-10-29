const { test, expect } = require("./helpers/coverage-test.cjs");
const { openDisclosureParents } = require("./helpers/selectors");
const fs = require("node:fs");
const path = require("node:path");
const screenshotDir = path.resolve(__dirname, "../../.tmp_test/detail-redesign-browsing");

const journeys = [
  { name: "MIT first-year", university: "mit-usa-cambridge", option: "mit-course-6-3-bachelor", search: "Computer Science", route: "mit-first-year", viewport: { width: 1280, height: 900 }, language: "eng", theme: "light", domains: ["mit.edu", "mitadmissions.org"] },
  { name: "MIT doctoral", university: "mit-usa-cambridge", option: "mit-eecs-phd-course-6", search: "Computer Science and Engineering", route: "mit_eecs_doctoral_admissions", viewport: { width: 390, height: 844 }, language: "kaz", theme: "dark", domains: ["mit.edu", "mitadmissions.org"] },
  { name: "Imperial Computing MEng", university: "imperial-college-london-uk", option: "imperial-option-computing-meng", search: "Computing", route: "procedure-computing-meng", viewport: { width: 1280, height: 900 }, language: "rus", theme: "dark", domains: ["imperial.ac.uk"] },
  { name: "Imperial Computing MSc", university: "imperial-college-london-uk", option: "imperial-option-computing", search: "Computing", route: "procedure-computing", viewport: { width: 390, height: 844 }, language: "eng", theme: "light", domains: ["imperial.ac.uk"] },
  { name: "Stanford CS external MS", university: "stanford-university-usa-ca", option: "stanford-option-cs-ms", search: "Computer Science", route: "directory-evidence:stanford-graduate-cs-ms", viewport: { width: 1280, height: 900 }, language: "eng", theme: "dark", domains: ["stanford.edu"] },
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
  const browseUrl = page.url();
  await option.click();
  await expect(option.locator("xpath=..").locator(".program-card__body")).toBeVisible();
  expect(page.url()).toBe(browseUrl);
  await option.locator("xpath=..").locator("[data-select-study-option]").click();
  await expect(page.locator("#admissionsContext")).toHaveAttribute("data-state", "ready");
  const card = option.locator("xpath=..");
  await expect(card).toHaveClass(/program-card/);
  await expect(option).toHaveAttribute("aria-expanded", "true");
  await expect(card.locator("#admissionsStudyDetails")).toBeVisible();
  await expect(card.locator("#admissionsStudyOverview")).not.toBeEmpty();
  const references = card.locator("#admissionsStudySources .admissions-programs__references");
  if (await references.count()) await expect(references).not.toHaveAttribute("open", "");
  const selectedUrl = page.url();
  await option.press("Enter");
  await expect(option).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("#admissionsStudyDetails")).toBeHidden();
  expect(page.url()).toBe(selectedUrl);
  await option.press("Enter");
  await expect(card.locator("#admissionsStudyDetails")).toBeVisible();
  if (["MIT first-year", "Imperial Computing MEng", "Stanford CS external MS"].includes(item.name)) {
    await option.evaluate(node => node.scrollIntoView({ block: "start" }));
    await saveScreenshot(page, `${item.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-program-overview.png`);
  }
  await expectAccessibleTextContrast(option);
  const selectionActions = page.locator("#admissionsReferenceSummary .admissions-selection__actions button");
  await expect(selectionActions).toHaveCount(1);
  for (const action of await selectionActions.all()) await expectHoverAndActiveContrast(page, action);
  await expect(page.locator("#tab-programs")).toHaveClass(/active/);
  await selectionActions.first().click();
  await expect(page.locator("#tab-admission")).toHaveClass(/active/);
  await page.locator('.d-tab-btn[data-tab="tab-programs"]').click();
  await expect(page.locator("#tab-programs")).toHaveClass(/active/);
  await expectProgramFacts(page, item);
  await expect(page.locator("#admissionsStudyInfo .admissions-catalog__assessment")).toHaveCount(0);
  await expect(page.locator("#admissionsStudyDetails .program-card__body-inner > .admissions-context__note")).toHaveCount(0);
  await expect(page.locator("#admissionsStudyRelationship")).toHaveCount(0);
  const sources = page.locator("#admissionsStudySources .admissions-programs__references");
  await sources.locator(":scope > summary").click();
  const officialCourseLink = sources.locator('a[href^="https://"]').first();
  await expectAccessibleTextContrast(officialCourseLink);
  if (["MIT first-year", "Imperial Computing MEng", "Stanford CS external MS"].includes(item.name)) {
    await page.locator("#admissionsStudyDetails").scrollIntoViewIfNeeded();
    await saveScreenshot(page, `${item.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-program.png`);
  }
  const url = new URL(page.url());
  expect(url.searchParams.get("admission_option")).toBe(item.option);
  expect(url.searchParams.get("admission_application_route")).toBe("");
  await expect(page.locator("#admissionsStudyOverview .admissions-programs__admission-note")).toBeVisible();
  await page.locator('.d-tab-btn[data-tab="tab-admission"]').click();
  await expect(page.locator("#tab-admission")).toHaveClass(/active/);
  await expect(page.locator("#admissionsContext[data-state='ready']")).toBeVisible();
}

for (const item of [journeys[0], journeys[3], {
  ...journeys[2], name: "Imperial Advanced Aeronautical Engineering",
  option: "imperial-option-advanced-aeronautical-engineering", search: "Advanced Aeronautical Engineering",
}]) {
  test(`${item.name} preview expands without selecting and keeps card geometry stable`, async ({ page }) => {
    await openGuestUniversity(page, item);
    await page.locator('[data-tab="tab-programs"]').click();
    await expect(page.locator("#admissionsProgramCount")).not.toBeEmpty();
    await page.locator("#admissionsSearch").fill(item.search);
    await page.locator("#admissionsSearchSubmit").click();
    const card = page.locator(`#admissionsProgramList [data-study-option="${item.option}"]`).locator("xpath=..");
    await expect(card).toBeVisible();
    const before = await card.evaluate(element => ({
      titleTop: element.querySelector(".program-card__title").getBoundingClientRect().top - element.getBoundingClientRect().top,
      bottom: element.getBoundingClientRect().bottom - element.querySelector(".program-card__admission-action").getBoundingClientRect().bottom,
    }));
    const url = page.url();
    const startsHeightAnimation = await card.evaluate(element => {
      element.querySelector("[data-study-option]").click();
      return element.querySelector(".program-card__body")?.getAnimations().some(animation =>
        animation.effect?.getKeyframes().some(frame => "height" in frame));
    });
    expect(startsHeightAnimation).toBe(true);
    await expect(card.locator("[data-study-option]")).toHaveAttribute("aria-expanded", "true");
    await expect(card.locator(".program-card__body")).toBeVisible();
    await expect(card.locator(".program-card__body")).not.toHaveAttribute("aria-busy", "true");
    await expect.poll(() => card.locator(".program-card__body").evaluate(element => element.getAnimations().length)).toBe(0);
    expect(page.url()).toBe(url);
    await expect(page.locator("#admissionsContextForm")).toBeHidden();
    await expect(page.locator("#admissionsReferenceSummary")).toBeHidden();
    await expect(card.locator("[data-select-study-option]")).toBeVisible();
    const after = await card.evaluate(element => ({
      titleTop: element.querySelector(".program-card__title").getBoundingClientRect().top - element.getBoundingClientRect().top,
      bottom: element.getBoundingClientRect().bottom - element.querySelector(".program-card__admission-action").getBoundingClientRect().bottom,
      originalGap: element.querySelector(".admissions-programs__original")
        ? element.querySelector(".admissions-programs__original").getBoundingClientRect().top - element.querySelector(".program-card__title").getBoundingClientRect().bottom
        : null,
    }));
    expect(Math.abs(after.titleTop - before.titleTop)).toBeLessThanOrEqual(1);
    expect(Math.abs(after.bottom - before.bottom)).toBeLessThanOrEqual(1);
    if (after.originalGap != null) expect(after.originalGap).toBeLessThanOrEqual(9);
    const closesWithHeightAnimation = await card.evaluate(element => {
      element.querySelector("[data-study-option]").click();
      return element.querySelector(".program-card__body")?.getAnimations().some(animation =>
        animation.effect?.getKeyframes().some(frame => "height" in frame));
    });
    expect(closesWithHeightAnimation).toBe(true);
    await expect(card.locator(".program-card__body")).toBeHidden();
    expect(page.url()).toBe(url);
    await card.locator("[data-select-study-option]").click();
    await expect(page).toHaveURL(new RegExp(`admission_option=${item.option}`));
  });
}

test("a failed program preview retries without selecting the program", async ({ page }) => {
  const item = journeys[0];
  await openGuestUniversity(page, item);
  await page.locator('[data-tab="tab-programs"]').click();
  await expect(page.locator("#admissionsProgramCount")).not.toBeEmpty();
  const card = page.locator(`#admissionsProgramList [data-study-option="${item.option}"]`).locator("xpath=..");
  await expect(card).toBeVisible();
  let failed = false;
  await page.route(`**/universities/${item.university}/admissions-context`, async route => {
    const context = route.request().postDataJSON()?.context;
    if (!failed && context?.study_option_id === item.option) {
      failed = true;
      await route.fulfill({ status: 503, contentType: "application/json", body: '{"detail":"Unavailable"}' });
    } else await route.continue();
  });
  const url = page.url();
  await card.locator("[data-study-option]").click();
  const retry = card.locator('[data-study-overview] [data-admissions-retry="context"]');
  await expect(retry).toBeVisible();
  expect(page.url()).toBe(url);
  await retry.click();
  await expect(card.locator("[data-study-overview] .program-card__description")).toBeVisible();
  expect(page.url()).toBe(url);
  await expect(card.locator("[data-select-study-option]")).toBeVisible();
});

test("program cards expand independently, including after one is selected", async ({ page }) => {
  const item = journeys[0];
  await openGuestUniversity(page, item);
  await page.locator('[data-tab="tab-programs"]').click();
  await expect(page.locator("#admissionsProgramCount")).not.toBeEmpty();
  await page.locator("#admissionsSearch").fill("Computer Science");
  await page.locator("#admissionsSearchSubmit").click();
  const first = page.locator('#admissionsProgramList [data-study-option="mit-course-6-3-bachelor"]').locator("xpath=..");
  const second = page.locator('#admissionsProgramList [data-study-option="mit-bs-6-7"]').locator("xpath=..");
  await expect(first).toBeVisible();
  await expect(second).toBeVisible();
  await first.locator("[data-study-option]").click();
  await expect(first.locator(".program-card__body")).not.toHaveAttribute("aria-busy", "true");
  await expect.poll(() => first.locator(".program-card__body").evaluate(body => body.getAnimations().length)).toBe(0);
  const firstHeight = await first.locator(".program-card__body").evaluate(body => body.getBoundingClientRect().height);
  const secondAnimation = await second.evaluate(card => {
    card.querySelector("[data-study-option]").click();
    return card.querySelector(".program-card__body")?.getAnimations().some(animation =>
      animation.effect?.getKeyframes().some(frame => "height" in frame));
  });
  expect(secondAnimation).toBe(true);
  await expect(second.locator(".program-card__body")).not.toHaveAttribute("aria-busy", "true");
  await expect.poll(() => second.locator(".program-card__body").evaluate(body => body.getAnimations().length)).toBe(0);
  await expect(first.locator("[data-study-option]")).toHaveAttribute("aria-expanded", "true");
  await expect(second.locator("[data-study-option]")).toHaveAttribute("aria-expanded", "true");
  expect(await first.locator(".program-card__body").evaluate(body => body.getBoundingClientRect().height)).toBe(firstHeight);
  await first.locator("[data-select-study-option]").click();
  await expect(page.locator("#admissionsContext")).toHaveAttribute("data-state", "ready");
  await expect(first.locator("#admissionsStudyDetails")).toBeVisible();
  await expect(second.locator(".program-card__body")).toBeVisible();
  await first.locator("[data-study-option]").click();
  await expect(first.locator("#admissionsStudyDetails")).toBeHidden();
  await expect(second.locator(".program-card__body")).toBeVisible();
  await expect(second.locator("[data-study-option]")).toHaveAttribute("aria-expanded", "true");
  await first.locator("[data-study-option]").click();
  await expect(first.locator("#admissionsStudyDetails")).toBeVisible();
  await second.locator("[data-select-study-option]").click();
  await expect(page.locator("#admissionsContext")).toHaveAttribute("data-state", "ready");
  await expect(first.locator(".program-card__body")).toBeVisible();
  await expect(second.locator("#admissionsStudyDetails")).toBeVisible();
});

test("the selected program leads the list after search and page reload", async ({ page }) => {
  const item = journeys[0];
  await openGuestUniversity(page, item);
  await page.locator('[data-tab="tab-programs"]').click();
  await expect(page.locator("#admissionsProgramCount")).not.toBeEmpty();
  await page.locator("#admissionsSearch").fill("Computer Science");
  await page.locator("#admissionsSearchSubmit").click();
  const selectedId = "mit-bs-6-7";
  const selected = page.locator(`#admissionsProgramList [data-study-option="${selectedId}"]`).locator("xpath=..");
  await expect(selected).toBeVisible();
  await selected.locator("[data-select-study-option]").click();
  await expect(page.locator("#admissionsContext")).toHaveAttribute("data-state", "ready");
  await page.locator("#admissionsSearchSubmit").click();
  await expect(page.locator("#admissionsProgramCount")).not.toBeEmpty();
  await expect(page.locator("#admissionsProgramList [data-study-option]").first()).toHaveAttribute("data-study-option", selectedId);
  await page.reload();
  await expect(page.locator("body")).toHaveAttribute("data-page", "university");
  await expect(page.locator("#admissionsContext")).toHaveAttribute("data-state", "ready");
  await expect(page.locator("#admissionsProgramCount")).not.toBeEmpty();
  await page.locator('[data-tab="tab-programs"]').click();
  await expect(page.locator("#detailPrograms .program-card:visible [data-study-option]").first()).toHaveAttribute("data-study-option", selectedId);
});

test("Imperial's selected card is compact without changing its outer button offset", async ({ page }) => {
  const item = { ...journeys[2], option: "imperial-option-advanced-aeronautical-engineering", search: "Advanced Aeronautical Engineering" };
  await openGuestUniversity(page, item);
  await page.locator('[data-tab="tab-programs"]').click();
  await expect(page.locator("#admissionsProgramCount")).not.toBeEmpty();
  await page.locator("#admissionsSearch").fill(item.search);
  await page.locator("#admissionsSearchSubmit").click();
  const card = page.locator(`#admissionsProgramList [data-study-option="${item.option}"]`).locator("xpath=..");
  await card.locator("[data-select-study-option]").click();
  await expect(card.locator("[data-selected-study-option]")).toBeVisible();
  const distances = await card.evaluate(element => {
    const original = element.querySelector(".admissions-programs__original").getBoundingClientRect();
    const button = element.querySelector(".program-card__selection-state").getBoundingClientRect();
    const card = element.getBoundingClientRect();
    return { internal: button.top - original.bottom, bottom: card.bottom - button.bottom };
  });
  expect(distances.internal).toBeLessThanOrEqual(2);
  expect(distances.bottom).toBe(12);
  await saveScreenshot(page, "imperial-advanced-aeronautical-engineering-selected-program.png");
});

async function expectProgramFacts(page, item) {
  const source = page.locator('#admissionsStudyDetails [data-admissions-fact] a[href^="https://"]').first();
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
  if (await page.locator("#admissionsSelectionEditor").isHidden()) await page.locator("#admissionsReferenceSummary button").click();
  const advanced = page.locator("#admissionsAdvanced[data-admissions-advanced]");
  await expect(advanced).toBeVisible();
  await expect(advanced).not.toHaveAttribute("open", "");

  const route = page.locator("#admissionsRoute");
  if (await route.inputValue() !== item.route) {
    const entry = page.locator(`[data-read-route="${item.route}"]`);
    if (await entry.count()) await openDisclosureParents(entry);
    if (await entry.isVisible()) {
      await entry.click();
      await expect(page.locator("#admissionsContext")).toHaveAttribute("data-state", "ready");
    } else {
      const routeWrapper = route.locator("xpath=..");
      await expect(routeWrapper.locator(".custom-select-trigger")).toBeVisible();
      await routeWrapper.locator(".custom-select-trigger").click();
      const routeOption = routeWrapper.locator(`.custom-option[data-value="${item.route}"]`);
      await expect(routeOption).toBeVisible();
      await routeOption.click();
    }
  }
  await expect(route).toHaveValue(item.route);
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
    const fullRecords = page.locator(`${pane} > .admissions-reading > .admissions-reading__references:not([data-general-references])`).first();
    if (await fullRecords.count() && !(await fullRecords.evaluate(node => node.open))) await fullRecords.locator(":scope > summary").click();
    const general = page.locator(`${pane} > .admissions-reading > [data-general-references]`);
    if (await general.count() && !(await general.evaluate(node => node.open))) await general.locator(":scope > summary").click();
    await expect(page.locator(`${pane} [data-admissions-domain="${domain}"]`).first()).toBeVisible();
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
      await expect(page.locator(`${pane} [data-admissions-domain="funding"]`).first()).toBeVisible();
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

for (const item of [journeys[0], journeys[1], journeys[2]]) {
  test(`${item.name} selection stays in Programs with readable card spacing`, async ({ page }) => {
    await openGuestUniversity(page, item);
    await page.locator('[data-tab="tab-programs"]').click();
    await expect(page.locator("#admissionsProgramCount")).not.toBeEmpty();
    await page.locator("#admissionsSearch").fill(item.search);
    await page.locator("#admissionsSearchSubmit").click();
    const card = page.locator(`#admissionsProgramList [data-study-option="${item.option}"]`).locator("xpath=..");
    const selectProgram = card.locator("[data-select-study-option]");
    await expect(selectProgram).toBeVisible();
    await expectAccessibleTextContrast(selectProgram);
    const resting = await selectProgram.evaluate(button => {
      const card = button.closest(".program-card").getBoundingClientRect();
      const bounds = button.getBoundingClientRect();
      const heading = button.closest(".program-card").querySelector(".program-card__toggle").getBoundingClientRect();
      return { top: bounds.top - heading.bottom, right: card.right - bounds.right, bottom: card.bottom - bounds.bottom, background: getComputedStyle(button).backgroundColor };
    });
    expect(resting.top).toBeGreaterThanOrEqual(0);
    expect(resting.right).toBeGreaterThanOrEqual(12);
    expect(resting.bottom).toBeGreaterThanOrEqual(12);
    await selectProgram.hover();
    expect(await selectProgram.evaluate(button => getComputedStyle(button).backgroundColor)).not.toBe(resting.background);
    await expectAccessibleTextContrast(selectProgram);
    await selectProgram.click();
    await expect(page.locator("#admissionsContext")).toHaveAttribute("data-state", "ready");
    await expect(page.locator("#tab-programs")).toHaveClass(/active/);
    await expect(page.locator("#tab-admission")).not.toHaveClass(/active/);
    await expect(card.locator("[data-selected-study-option]")).toBeVisible();
    await expect(card.locator("[data-selected-study-option]")).toHaveText(/Selected|Выбрано|Таңдалған/);
    await expect(page.locator("#admissionsStudyDetails")).toBeHidden();
    await card.locator("[data-study-option]").click();
    await expect(page.locator("#admissionsStudyDetails")).toBeVisible();
    const selectedPosition = await card.evaluate(element => {
      const details = element.querySelector("#admissionsStudyDetails").getBoundingClientRect();
      const selected = element.querySelector("[data-selected-study-option]").getBoundingClientRect();
      const card = element.getBoundingClientRect();
      return { belowDetails: selected.top - details.bottom, right: card.right - selected.right, bottom: card.bottom - selected.bottom };
    });
    expect(selectedPosition.belowDetails).toBeGreaterThanOrEqual(0);
    expect(selectedPosition.right).toBeGreaterThanOrEqual(12);
    expect(selectedPosition.bottom).toBeGreaterThanOrEqual(12);
    expect(new URL(page.url()).searchParams.get("admission_option")).toBe(item.option);
    const sizes = await card.evaluate(element => [".program-card__kicker", ".program-card__title", ".program-card__description", ".program-card-label", ".program-card-value", ".admissions-programs__references > summary"]
      .map(selector => getComputedStyle(element.querySelector(selector)).fontSize));
    expect(new Set(sizes).size).toBe(1);
    const sources = card.locator(".admissions-programs__references");
    await sources.locator(":scope > summary").click();
    await expect(sources.locator("a[href^='https://']")).not.toHaveCount(0);
    await expect(sources.locator(".admissions-catalog__meta").first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(item.viewport.width);
    await saveScreenshot(page, `${item.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-selected-program.png`);
  });
}

test("a program remains readable outside search results without losing its selected application path", async ({ page }) => {
  const item = journeys[0];
  await openGuestUniversity(page, item);
  await chooseOption(page, item);
  await chooseRoute(page, item);
  await page.locator('.d-tab-btn[data-tab="tab-programs"]').click();
  await expect(page.locator("#tab-programs")).toHaveClass(/active/);
  const selectedUrl = page.url();

  await page.locator("#admissionsSearch").fill("Physics");
  await page.locator("#admissionsSearchSubmit").click();
  await expect(page.locator("#admissionsProgramList [data-study-option]").first()).toContainText("Physics");
  const pinned = page.locator("#admissionsSelectedProgram");
  await expect(pinned).toBeVisible();
  await expect(pinned.locator("#admissionsStudyDetails")).toBeHidden();
  const toggle = pinned.locator("[data-study-option]");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  expect(page.url()).toBe(selectedUrl);
  await expect(page.locator("#admissionsRoute")).toHaveValue(item.route);
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(pinned.locator("#admissionsStudyDetails")).toBeVisible();
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(pinned.locator("#admissionsStudyDetails")).toBeHidden();
  await toggle.click();
  await expect(pinned.locator("#admissionsStudyDetails")).toBeVisible();
  expect(page.url()).toBe(selectedUrl);
  await expect(page.locator("#admissionsRoute")).toHaveValue(item.route);

  await page.locator("#admissionsSearch").fill("");
  await page.locator("#admissionsSearch").press("Enter");
  const originalCard = page.locator(`#admissionsProgramList [data-study-option="${item.option}"]`).locator("xpath=..");
  await expect(originalCard.locator("#admissionsStudyDetails")).toBeHidden();
  await originalCard.locator("[data-study-option]").click();
  await expect(originalCard.locator("#admissionsStudyDetails")).toBeVisible();
  await expect(pinned).toBeHidden();
  await expect(page.locator("#admissionsStudyDetails")).toHaveCount(1);
  await expect(page.locator(`[data-study-option="${item.option}"]`)).toHaveCount(1);
  await expect(page.locator("#admissionsRoute")).toHaveValue(item.route);
});

test("dates and costs guide guests to the missing program or application path", async ({ page }) => {
  const item = journeys[0];
  await openGuestUniversity(page, item);
  await page.locator('[data-tab="tab-deadlines"]').click();
  await expect(page.locator("#tab-deadlines")).toHaveClass(/active/);
  await page.locator("#detailDeadlines .admissions-state button").click();
  await expect(page.locator("#tab-programs")).toHaveClass(/active/);
  const option = page.locator(`[data-study-option="${item.option}"]`);
  await expect(option).toBeVisible();
  await option.click();
  await option.locator("xpath=..").locator("[data-select-study-option]").click();
  await expect(page.locator("#admissionsContext")).toHaveAttribute("data-state", "ready");
  await page.locator('[data-tab="tab-finance"]').click();
  await expect(page.locator("#tab-finance")).toHaveClass(/active/);
  await page.locator("#detailFinance .admissions-state button").click();
  await expect(page.locator("#tab-admission")).toHaveClass(/active/);
  await expect(page.locator("#admissionsRoute")).toBeEnabled();
  await expect(page.locator("#admissionsRoute")).toHaveValue("");
  expect(new URL(page.url()).searchParams.get("admission_option")).toBe(item.option);
});

for (const theme of ["light", "dark"]) {
  test(`Russian program actions stay inside the card at narrow phone widths (${theme})`, async ({ page }) => {
    const item = { ...journeys[2], name: "Imperial phone", theme, viewport: { width: 390, height: 844 } };
    await openGuestUniversity(page, item);
    await chooseOption(page, item);
    await page.locator('[data-tab="tab-programs"]').click();
    await expect(page.locator("#tab-programs")).toHaveClass(/active/);
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      const bounds = await page.locator("#admissionsStudySources").evaluate(source => {
        const area = source.getBoundingClientRect();
        const body = source.closest(".program-card__body-inner").getBoundingClientRect();
        return { left: area.left - body.left, right: body.right - area.right, height: area.height };
      });
      expect(bounds.left).toBeGreaterThanOrEqual(-1);
      expect(bounds.right).toBeGreaterThanOrEqual(-1);
      expect(bounds.height).toBeGreaterThanOrEqual(28);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
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
    const response = page.waitForResponse((response) => response.url().endsWith("/admissions-context") && response.request().method() === "POST");
    await wrapper.locator(`.custom-option[data-value="${item.route}"]`).click();
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
    await expect(page.locator("#admissionsAdvanced > summary")).toHaveText("Контексті нақтылау (міндетті емес)");
    await expect(page.locator("#admissionsContextApply")).toHaveText("Сүзгілерді қолдану");
    await expect(page.locator("#admissionsAdvanced")).not.toHaveAttribute("open", "");
  }
});
