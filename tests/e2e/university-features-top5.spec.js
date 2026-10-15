const { test, expect } = require("./helpers/coverage-test.cjs");
const { personas, seedProfile, markTourAsSeen } = require("./helpers/personas");

function reviewedContextUrl({ university, option, route, level, applicant, cycle, fee = "unknown" }) {
  const params = new URLSearchParams({
    id: university,
    admission_option: option,
    admission_application_route: route,
    admission_level: level,
    admission_route: applicant,
    admission_cycle: cycle,
    admission_fee: fee,
  });
  return `/university.html?${params}`;
}

async function openEvidence(fact) {
  const evidence = fact.locator("details.admissions-catalog__evidence");
  if (await evidence.count() && !(await evidence.evaluate((node) => node.open))) await evidence.locator(":scope > summary").click();
}

test("citizenship picker searches the full list and saves a selected country", async ({ page }) => {
  await page.goto("/profile.html");
  const trigger = page.locator("#citizenshipCountrySelect + .custom-select-trigger");
  await expect(trigger).toBeVisible();
  await expect(page.locator("#citizenshipCountrySelect option[data-country-code]")).toHaveCount(250);
  await trigger.click();
  await page.locator(".custom-select-wrapper:has(#citizenshipCountrySelect) .custom-select-search").fill("BR");
  await page.locator('.custom-select-wrapper:has(#citizenshipCountrySelect) .custom-option[data-value="BR"]').click();
  await page.locator("#addCitizenshipBtn").click();
  await expect(page.locator("[data-citizenship-chip]")).toContainText("BR");
  await page.locator("#saveProfileBtn").click();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("unisearch_profile") || "{}").citizenships)).toEqual(["BR"]);
});

test("citizenship picker enforces the API limit of ten entries", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("unisearch_profile", JSON.stringify({
      _v: 2,
      citizenships: ["US", "CA", "GB", "KZ", "RU", "CN", "IN", "JP", "FR", "DE"],
    }));
  });
  await page.goto("/profile.html");
  const picker = page.locator(".custom-select-wrapper:has(#citizenshipCountrySelect)");
  await picker.locator(".custom-select-trigger").click();
  await picker.locator(".custom-select-search").fill("BR");
  await picker.locator('.custom-option[data-value="BR"]').click();
  await page.locator("#addCitizenshipBtn").click();

  await expect(page.locator("[data-citizenship-chip]")).toHaveCount(10);
  await expect(page.locator(".toast.error")).toContainText("10");
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("unisearch_profile") || "{}").citizenships)).toHaveLength(10);
});

test("legacy saved study level can be changed and saved in the canonical profile", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("unisearch_profile", JSON.stringify({
      _v: 2,
      study_level: "Master",
      major: "Computer Science",
    }));
  });
  await page.goto("/profile.html");
  await page.waitForSelector("#studyLevelSelect", { state: "attached" });
  await expect(page.locator("#studyLevelSelect")).toHaveValue("Master");

  const studyLevelPicker = page.locator(".custom-select-wrapper:has(#studyLevelSelect)");
  await studyLevelPicker.locator(".custom-select-trigger").click();
  await studyLevelPicker.locator('.custom-option[data-value="Doctorate"]').click();
  await expect(page.locator("#studyLevelSelect")).toHaveValue("Doctorate");
  await expect(page.locator("#saveProfileBtn")).toBeVisible();
  await page.locator("#saveProfileBtn").click();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("unisearch_profile") || "{}").studyLevel)).toBe("Doctorate");
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("unisearch_profile") || "{}").study_level)).toBeUndefined();
});

test("reviewed Imperial shows fee-scoped course tuition and leaves Oxford legacy prices unknown", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("unisearch_profile", JSON.stringify({ _v: 2, study_level: "Master" }));
  });

  await page.goto(reviewedContextUrl({
    university: "imperial-college-london-uk",
    option: "imperial-option-computing",
    route: "procedure-computing",
    level: "masters",
    applicant: "graduate",
    cycle: "2027 entry",
  }));
  await expect(page.locator("#detailCard")).toBeVisible();
  await expect(page.locator("#admissionsContext")).toHaveAttribute("data-state", "ready");
  await page.locator('.d-tab-btn[data-tab="tab-finance"]').click();
  const imperialFinance = page.locator("#detailFinance");
  await expect(imperialFinance).toContainText("Home fee");
  await expect(imperialFinance).toContainText("£25,850");
  await expect(imperialFinance).toContainText("Overseas fee");
  await expect(imperialFinance).toContainText("£48,300");
  await expect(imperialFinance).toContainText(/comparable annual total is not established/i);

  await page.goto("/university.html?id=university-of-oxford-uk-oxford");
  await expect(page.locator("#detailCard")).toBeVisible();
  await page.locator('.d-tab-btn[data-tab="tab-finance"]').click();
  await expect(page.locator("#detailPrice")).toHaveText("Cost unknown");
  await expect(page.locator("#detailPrice")).not.toContainText(/(?:£|\$|€)\s?0(?:\.00)?\b/);
});

test("legacy Oxford calendar navigates and exports its exact sourced deadline", async ({ page }) => {
  if (process.env.PLAYWRIGHT_API_PORT) {
    await page.route("**/env.js", async (route) => {
      const response = await route.fetch();
      const body = (await response.text()).replace(/"API_PORT":\s*"\d+"/, `"API_PORT": "${process.env.PLAYWRIGHT_API_PORT}"`);
      await route.fulfill({ response, body });
    });
  }
  await page.goto("/university.html?id=university-of-oxford-uk-oxford");
  await expect(page.locator("#detailCard")).toBeVisible();
  await page.locator('.d-tab-btn[data-tab="tab-deadlines"]').click();
  const month = page.locator("[data-calendar-month-key]");
  await expect(month).toBeVisible();
  const firstMonth = await month.getAttribute("data-calendar-month-key");
  expect(await page.locator("[data-calendar-day]").count()).toBeGreaterThan(0);
  await page.locator('[data-calendar-month="next"]').click();
  const [year, monthNumber] = firstMonth.split("-").map(Number);
  const nextMonth = new Date(Date.UTC(year, monthNumber, 1)).toISOString().slice(0, 7);
  await expect(month).toHaveAttribute("data-calendar-month-key", nextMonth);

  await page.evaluate(() => {
    const createObjectURL = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (blob) => {
      window.__lastCalendarExport = blob.text();
      return createObjectURL(blob);
    };
  });
  const exactDate = "2026-10-15";
  const targetMonth = exactDate.slice(0, 7);
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const currentMonth = await month.getAttribute("data-calendar-month-key");
    if (currentMonth === targetMonth) break;
    const direction = currentMonth < targetMonth ? "next" : "previous";
    await page.locator(`[data-calendar-month="${direction}"]`).click();
    await expect(month).not.toHaveAttribute("data-calendar-month-key", currentMonth);
  }
  await expect(month).toHaveAttribute("data-calendar-month-key", targetMonth);
  await page.locator(`[data-calendar-day="${exactDate}"]`).click();
  const exportButton = page.locator("[data-calendar-export]").first();
  await expect(exportButton).toBeVisible();
  await exportButton.click();
  const exportedIcs = await page.evaluate(async () => (await window.__lastCalendarExport).replace(/\r\n[ \t]/g, ""));
  expect(exportedIcs).toContain("DTSTART;VALUE=DATE:20261015");
  expect(exportedIcs).toContain("Admissions cycle: 2027 entry");
  expect(exportedIcs).toContain("Source: https://www.ox.ac.uk/admissions/undergraduate/applying/admissions-timeline");
});

test("exact Imperial Computing deadline preserves its source, time, course scope, and cycle", async ({ page }) => {
  await page.goto(reviewedContextUrl({
    university: "imperial-college-london-uk",
    option: "imperial-option-computing-meng",
    route: "procedure-computing-meng",
    level: "undergraduate",
    applicant: "first_year",
    cycle: "2027 entry",
  }));
  await expect(page.locator("#detailCard")).toBeVisible();
  await expect(page.locator("#admissionsContext")).toHaveAttribute("data-state", "ready");
  await page.locator('.d-tab-btn[data-tab="tab-deadlines"]').click();
  await expect(page.locator("#tab-deadlines")).toHaveClass(/active/);

  const exactDeadline = page.locator('#detailDeadlines [data-admissions-fact="imperial-ucas-2027-window"]');
  await expect(exactDeadline).toBeVisible();
  await openEvidence(exactDeadline);
  await expect(exactDeadline).toContainText(/2027[-\u2011]01[-\u2011]13/);
  await expect(exactDeadline).toContainText("18:00");
  await expect(exactDeadline).toContainText("Europe/London");
  await expect(exactDeadline).toContainText("2027 entry");
  await expect(exactDeadline.locator("a[href^='https://']").first()).toBeVisible();
  await expect(exactDeadline.locator("a[href^='https://']").first()).toHaveAttribute("href", "https://www.imperial.ac.uk/study/apply/undergraduate/process/deadlines/");
});

test("yearless Harvard first-year deadlines retain their source and current cycle without calendar export", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("unisearch_profile", JSON.stringify({ _v: 2, study_level: "Bachelor" }));
  });
  await page.goto("/university.html?id=harvard-usa-cambridge");
  await expect(page.locator("#detailCard")).toBeVisible();
  await expect(page.locator("#detailName")).not.toBeEmpty();
  await page.locator('.d-tab-btn[data-tab="tab-deadlines"]').click();
  await expect(page.locator("#tab-deadlines")).toHaveClass(/active/);

  const firstYearDeadline = page.locator("#detailDeadlines .admissions-deadline-item").filter({ hasText: "November 1" }).first();
  await expect(firstYearDeadline).toBeVisible();
  await expect(firstYearDeadline.locator(".admissions-deadline-cycle")).toContainText("Fall 2027 first-year admission");
  await expect(firstYearDeadline.locator(".admissions-deadline-source")).toHaveAttribute("href", "https://college.harvard.edu/admissions/apply/first-year-applicants");
  await expect(page.locator("#detailDeadlines [data-calendar-export]")).toHaveCount(0);
  await expect(page.locator("#detailDeadlines .deadline-calendar")).toContainText("exact published date and year");
});

test("catalog study level switcher is interactive and filters degree levels", async ({ page }) => {
  await markTourAsSeen(page);
  await page.goto("/index.html");
  await page.waitForSelector("[data-page='universities']", { state: "attached" });
  await page.waitForSelector(".catalog-level-segmented", { state: "visible" });

  const allLevelsBtn = page.locator(".catalog-level-btn[data-level='']");
  await expect(allLevelsBtn).toHaveClass(/is-active/);

  const mbaBtn = page.locator(".catalog-level-btn[data-level='mba']");
  const mbaResponsePromise = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname.endsWith("/universities") && url.searchParams.get("study_level") === "mba";
  });
  await mbaBtn.click();
  await expect(mbaBtn).toHaveClass(/is-active/);
  await expect(allLevelsBtn).not.toHaveClass(/is-active/);
  const mbaResponse = await mbaResponsePromise;
  expect(mbaResponse.ok()).toBeTruthy();

  const mbaCards = page.locator(".uni-card[data-uni-id]:not(.is-skeleton)");
  await expect(mbaCards).toHaveCount(5);
  const mbaUniversityIds = await mbaCards.evaluateAll((cards) => cards.map((card) => card.dataset.uniId).sort());
  expect(mbaUniversityIds).toEqual([
    "harvard-usa-cambridge",
    "imperial-college-london-uk",
    "mit-usa-cambridge",
    "stanford-university-usa-ca",
    "university-of-oxford-uk-oxford",
  ]);
});

test("MIT first-year deadline facts keep recurring dates separate from the 2027 cycle", async ({ page }) => {
  await page.goto(reviewedContextUrl({
    university: "mit-usa-cambridge",
    option: "mit-course-6-3-bachelor",
    route: "mit-first-year",
    level: "undergraduate",
    applicant: "first_year",
    cycle: "Fall 2027 entry",
  }));
  await expect(page.locator("#detailCard")).toBeVisible();
  await expect(page.locator("#admissionsContext")).toHaveAttribute("data-state", "ready");

  const deadlinesTabBtn = page.locator(".d-tab-btn[data-tab='tab-deadlines']");
  await expect(deadlinesTabBtn).toBeVisible();
  await deadlinesTabBtn.click();

  const recurring = page.locator('#detailDeadlines [data-admissions-fact="first-year-rounds"]');
  await expect(recurring).toBeVisible();
  await expect(recurring).toHaveAttribute("open", "");
  await expect(recurring).toContainText("Early Action");
  await expect(recurring).toContainText("November 1");
  await expect(recurring).toContainText("January 4");
  await expect(recurring).toContainText("page does not specify entry year");

  const cycleDeadline = page.locator('#detailDeadlines [data-admissions-fact="mit-first-year-application-deadline"]');
  await expect(cycleDeadline).toBeVisible();
  await expect(cycleDeadline).toContainText("January 4");
  await expect(cycleDeadline).toContainText("Fall 2027 entry");
});

test("UK citizenship alone does not assign a home fee status", async ({ page }) => {
  await seedProfile(page, {
    ...personas.enResearch.profile,
    citizenships: ["GB"],
  });
  await page.goto("/university.html?id=university-of-oxford-uk-oxford");
  await expect(page.locator("#detailCard")).toBeVisible();
  await page.click(".d-tab-btn[data-tab='tab-finance']");

  const feeStatus = page.locator(".finance-fee-status-badge");
  await expect(feeStatus).toBeVisible();
  await expect(feeStatus).toContainText("requires an eligibility check");
  await expect(feeStatus).not.toContainText("Home Fee Status");
  await expect(feeStatus).not.toContainText("Overseas Status");
});

test("MIT requirement groups collapse and expand in the selected first-year context", async ({ page }) => {
  await page.goto(reviewedContextUrl({
    university: "mit-usa-cambridge",
    option: "mit-course-6-3-bachelor",
    route: "mit-first-year",
    level: "undergraduate",
    applicant: "first_year",
    cycle: "Fall 2027 entry",
  }));
  await expect(page.locator("#detailCard")).toBeVisible();
  await expect(page.locator("#admissionsContext")).toHaveAttribute("data-state", "ready");

  await page.click(".d-tab-btn[data-tab='tab-admission']");
  await expect(page.locator("#tab-admission")).toHaveClass(/active/);
  const fact = page.locator('#detailRequirements [data-admissions-domain="requirements"] [data-admissions-fact="first-year-documents"]');
  const collapsible = fact.locator("xpath=ancestor::details[@data-admissions-group][1]");
  await expect(collapsible).toBeVisible();
  await expect(collapsible).not.toHaveAttribute("open");
  await expect(fact).not.toBeVisible();
  const summary = collapsible.locator(":scope > summary");
  await summary.click();
  await expect(collapsible).toHaveAttribute("open", "");
  await expect(fact).toBeVisible();
  await expect(fact).toContainText("Two teacher recommendations");
  await summary.click();
  await expect(collapsible).not.toHaveAttribute("open");
  await expect(fact).not.toBeVisible();
});
