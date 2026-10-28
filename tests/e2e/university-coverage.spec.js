const { test, expect } = require("./helpers/coverage-test.cjs");
const { setNativeSelect } = require("./helpers/selectors");

const reviewedUniversities = [
  { id: "mit-usa-cambridge", levels: ["doctoral", "masters", "professional", "undergraduate"] },
  { id: "imperial-college-london-uk", levels: ["doctoral", "masters", "undergraduate"] },
  { id: "stanford-university-usa-ca", levels: ["doctoral", "masters", "professional", "undergraduate"] },
];
const legacyCoverageUniversities = ["harvard-usa-cambridge", "university-of-oxford-uk-oxford"];

async function openUniversity(page, id) {
  await page.goto(`/university.html?id=${id}`);
  await expect(page.locator("#detailCard")).toBeVisible();
  await expect(page.locator("#detailName")).not.toBeEmpty();
  const coverage = page.locator(".university-coverage-section");
  await expect(coverage).not.toHaveAttribute("open", "");
  await coverage.locator("summary").click();
  await expect(page.locator("#detailCoverage .university-coverage__level").first()).toBeVisible();
}

async function openReviewedUniversity(page, university) {
  await page.addInitScript(() => {
    localStorage.removeItem("unisearch_profile");
    localStorage.setItem("unisearch_ui_language_v1", "eng");
    localStorage.setItem("unisearch_theme", "light");
    localStorage.setItem("unisearch_universities_tour_seen_v1", "1");
  });
  const detailPromise = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname.endsWith(`/universities/${university.id}`) && response.request().method() === "GET";
  });
  const optionsPromise = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname.endsWith(`/universities/${university.id}/study-options`);
  });
  await page.goto(`/university.html?id=${university.id}`);
  await expect(page.locator("body")).toHaveAttribute("data-page", "university");
  await expect(page.locator("#detailCard")).toHaveClass(/is-mounted/);
  const detailResponse = await detailPromise;
  expect(detailResponse.status()).toBe(200);
  const detail = await detailResponse.json();
  expect(detail.admissions_catalog.availability).toBe("reviewed");
  expect(detail.admissions_catalog.study_option_count).toBeGreaterThan(0);
  expect(detail.admissions_catalog.study_levels).toEqual(university.levels);
  expect(detail).not.toHaveProperty("academics.programs");

  const optionsResponse = await optionsPromise;
  expect(optionsResponse.status()).toBe(200);
  expect((await optionsResponse.json()).total).toBe(detail.admissions_catalog.study_option_count);

  await page.locator('.d-tab-btn[data-tab="tab-programs"]').click();
  await expect(page.locator("#tab-programs")).toHaveClass(/active/);
  await expect(page.locator("#admissionsProgramList [data-study-option]").first()).toBeVisible();
  await expect(page.locator("#admissionsStudyDetails")).toBeHidden();
  const programCards = page.locator("#admissionsProgramList .program-card:has([data-study-option])");
  expect(await programCards.count()).toBeGreaterThan(0);
  await expect(page.locator("#detailPrograms .program-card:visible")).toHaveCount(await programCards.count());
  await expect(page.locator("#admissionsStudyLevel")).toHaveValue("");
  return detail;
}

test("reviewed catalog metadata and optional browsing use the accepted study options", async ({ page }) => {
  for (const university of reviewedUniversities) {
    const detail = await openReviewedUniversity(page, university);
    expect(detail.admissions_catalog.study_option_count).toBeGreaterThanOrEqual(1);
  }

  for (const universityId of legacyCoverageUniversities) {
    await openUniversity(page, universityId);
    const levels = page.locator("#detailCoverage .university-coverage__level");
    const levelCount = await levels.count();
    expect(levelCount).toBeGreaterThanOrEqual(4);
    const bachelorLevelCount = await levels.evaluateAll((nodes) => nodes.filter((node) => node.querySelector("h4")?.textContent === "Bachelor's").length);
    expect(bachelorLevelCount).toBe(1);
    const levelNames = await levels.locator("h4").allTextContents();
    expect(new Set(levelNames).size).toBe(levelNames.length);
    await expect(page.locator("#detailCoverage .university-coverage__row")).toHaveCount(levelCount * 6 + 1);
    await expect(page.locator("#detailCoverage .university-coverage__state").filter({ hasText: "Catalogued" }).first()).toBeVisible();
    await expect(page.locator("#detailCoverage .university-coverage__state").filter({ hasText: "Not catalogued" }).first()).toBeVisible();
  }

  await openUniversity(page, "eth-zurich-ch-zurich");
  await expect(page.locator("#detailCoverage .university-coverage__level")).toHaveCount(1);
  await expect(page.locator("#detailCoverage .university-coverage__level h4")).toHaveText("Bachelor's");
  await expect(page.locator("#detailCoverage")).toContainText("University-wide undergraduate cost data");

  const languageControl = page.locator('.custom-select-wrapper:has(#languageSelect)');
  await languageControl.locator(".custom-select-trigger").click();
  await languageControl.locator('.custom-option[data-value="rus"]').click();
  await expect(page.locator("#universityCoverageTitle")).toHaveText("Данные UniSearch");
  await expect(page.locator("#detailCoverage .university-coverage__level h4")).toHaveText("Бакалавриат");
  await expect(page.locator("#detailCoverage")).toContainText("Общие данные о стоимости бакалавриата");

  await page.setViewportSize({ width: 375, height: 812 });
  await page.locator(".university-coverage__level").first().evaluate((node) => document.documentElement.setAttribute("data-theme", "light"));
  const lightSurface = await page.locator(".university-coverage__level").first().evaluate((node) => getComputedStyle(node).backgroundColor);
  await page.locator(".university-coverage__level").first().evaluate((node) => document.documentElement.setAttribute("data-theme", "dark"));
  const darkSurface = await page.locator(".university-coverage__level").first().evaluate((node) => getComputedStyle(node).backgroundColor);
  expect(darkSurface).not.toBe(lightSurface);
  const coverageFitsMobile = await page.locator("#detailCoverage").evaluate((node) => node.scrollWidth <= node.clientWidth);
  expect(coverageFitsMobile).toBe(true);
});

test("MBA study options use canonical levels for reviewed universities and retain Oxford's legacy filter", async ({ page }) => {
  const mbaOptions = [
    { university: "mit-usa-cambridge", option: "mit-sloan-mba-full-time", level: "masters" },
    { university: "imperial-college-london-uk", option: "imperial-option-full-time-mba", level: "masters" },
    { university: "stanford-university-usa-ca", option: "stanford-option-gsb-mba", level: "professional" },
  ];
  for (const item of mbaOptions) {
    await page.addInitScript(() => {
      localStorage.removeItem("unisearch_profile");
      localStorage.setItem("unisearch_ui_language_v1", "eng");
      localStorage.setItem("unisearch_theme", "light");
      localStorage.setItem("unisearch_universities_tour_seen_v1", "1");
    });
    await page.goto(`/university.html?id=${item.university}`);
    await expect(page.locator("#detailCard")).toHaveClass(/is-mounted/);
    await page.locator('.d-tab-btn[data-tab="tab-programs"]').click();
    await expect(page.locator("#tab-programs")).toHaveClass(/active/);
    await setNativeSelect(page, "admissionsStudyLevel", item.level);
    await page.locator("#admissionsSearch").fill("MBA");
    const responsePromise = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return url.pathname.endsWith(`/universities/${item.university}/study-options`)
        && url.searchParams.get("study_level") === item.level
        && url.searchParams.get("search") === "MBA";
    });
    await page.locator("#admissionsSearchSubmit").click();
    const response = await responsePromise;
    expect(response.status()).toBe(200);
    const results = await response.json();
    const mba = results.items.find((option) => option.id === item.option);
    expect(mba).toBeTruthy();
    expect(mba.levels).toContain(item.level);
    const result = page.locator(`#admissionsProgramList [data-study-option="${item.option}"]`);
    await expect(result).toBeVisible();
    await expect(result).toContainText("MBA");
    await result.click();
    await result.locator("xpath=..").locator("[data-select-study-option]").click();
    await expect(page.locator("#admissionsStudyDetails")).toBeVisible();
    await expect(page.locator("#admissionsStudyLevel")).toHaveValue(item.level);
    await expect(page.locator("#admissionsRoute")).toHaveValue("");
  }

  await openUniversity(page, "university-of-oxford-uk-oxford");
  await page.locator('.d-tab-btn[data-tab="tab-programs"]').click();
  await expect(page.locator("#tab-programs")).toHaveClass(/active/);
  const mbaTab = page.locator('#detailPrograms [data-program-level="mba"]');
  await expect(mbaTab).toBeVisible();
  await mbaTab.click();
  await expect(mbaTab).toHaveClass(/is-active/);
  const visibleProgramTitles = await page.locator("#detailPrograms .program-card__title").allTextContents();
  expect(visibleProgramTitles.join(" ").toLowerCase()).toContain("mba");
});

test("yearless deadline rows inherit the current cycle from their admission category", async ({ page }) => {
  await page.goto("/university.html?id=harvard-usa-cambridge");
  await expect(page.locator("#detailCard")).toBeVisible();
  await expect(page.locator("#detailName")).not.toBeEmpty();
  await page.locator('.d-tab-btn[data-tab="tab-deadlines"]').click();
  await expect(page.locator("#tab-deadlines")).toHaveClass(/active/);
  const firstYearDeadline = page.locator("#detailDeadlines .admissions-deadline-item").filter({ hasText: "November 1" }).first();
  await expect(firstYearDeadline.locator(".admissions-deadline-cycle")).toContainText("Fall 2027 first-year admission");
  await expect(firstYearDeadline.locator(".admissions-deadline-source")).toHaveAttribute("href", "https://college.harvard.edu/admissions/apply/first-year-applicants");
});
