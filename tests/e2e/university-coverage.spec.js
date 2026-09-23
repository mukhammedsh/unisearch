const { test, expect } = require("@playwright/test");

const topFiveUniversities = [
  "mit-usa-cambridge",
  "imperial-college-london-uk",
  "stanford-university-usa-ca",
  "harvard-usa-cambridge",
  "university-of-oxford-uk-oxford",
];

async function openUniversity(page, id) {
  await page.goto(`/university.html?id=${id}`);
  await expect(page.locator("#detailCard")).toBeVisible();
  await expect(page.locator("#detailName")).not.toBeEmpty();
  await expect(page.locator("#detailCoverage .university-coverage__level").first()).toBeVisible();
}

test("coverage renders for the top five and a legacy university, and follows language changes", async ({ page }) => {
  for (const universityId of topFiveUniversities) {
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

test("MBA programs have a dedicated degree filter on MIT, Stanford, and Oxford", async ({ page }) => {
  for (const universityId of ["mit-usa-cambridge", "stanford-university-usa-ca", "university-of-oxford-uk-oxford"]) {
    await openUniversity(page, universityId);
    await page.locator('.d-tab-btn[data-tab="tab-programs"]').click();
    await expect(page.locator("#tab-programs")).toHaveClass(/active/);
    await expect(page.locator('#detailPrograms [data-program-level="mba"]')).toBeVisible();
    const mbaTab = page.locator('#detailPrograms [data-program-level="mba"]');
    await mbaTab.click();
    await expect(mbaTab).toHaveClass(/is-active/);
    const visibleProgramTitles = await page.locator("#detailPrograms .program-card__title").allTextContents();
    expect(visibleProgramTitles.join(" ").toLowerCase()).toContain("mba");
  }

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
