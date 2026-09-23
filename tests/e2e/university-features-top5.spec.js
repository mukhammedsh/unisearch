const { test, expect } = require("@playwright/test");
const { personas, seedProfile, markTourAsSeen } = require("./helpers/personas");

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

test("legacy Master's profile keeps missing Imperial and Oxford prices unknown", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("unisearch_profile", JSON.stringify({ _v: 2, study_level: "Master" }));
  });

  for (const universityId of ["imperial-college-london-uk", "university-of-oxford-uk-oxford"]) {
    await page.goto(`/university.html?id=${universityId}`);
    await expect(page.locator("#detailCard")).toBeVisible();
    await expect(page.locator("#detailName")).not.toBeEmpty();
    await page.locator('.d-tab-btn[data-tab="tab-finance"]').click();
    await expect(page.locator("#tab-finance")).toHaveClass(/active/);

    const annualEstimate = page.locator("#detailPrice");
    await expect(annualEstimate).toHaveText("Cost unknown");
    await expect(annualEstimate).not.toContainText(/(?:£|\$|€)\s?0(?:\.00)?\b/);
  }
});

test("deadline calendar shows exact dates and supports month navigation", async ({ page }) => {
  if (process.env.PLAYWRIGHT_API_PORT) {
    await page.route("**/env.js", async (route) => {
      const response = await route.fetch();
      const body = (await response.text()).replace(/"API_PORT":\s*"\d+"/, `"API_PORT": "${process.env.PLAYWRIGHT_API_PORT}"`);
      await route.fulfill({ response, body });
    });
  }
  await page.goto("/university.html?id=imperial-college-london-uk");
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
});

test("exact Imperial deadline export preserves its official source and admissions cycle", async ({ page }) => {
  await page.goto("/university.html?id=imperial-college-london-uk");
  await expect(page.locator("#detailCard")).toBeVisible();
  await expect(page.locator("#detailName")).not.toBeEmpty();
  await page.locator('.d-tab-btn[data-tab="tab-deadlines"]').click();
  await expect(page.locator("#tab-deadlines")).toHaveClass(/active/);

  const exactDate = "2027-01-13";
  const exactDeadline = page.locator("#detailDeadlines .admissions-deadline-item").filter({ hasText: "Undergraduate Engineering & Computing Route" }).first();
  await expect(exactDeadline).toBeVisible();
  const publishedDate = (await exactDeadline.locator(".admissions-deadline-date").textContent()).replace(/[\u2010-\u2015\u2212]/g, "-");
  expect(publishedDate).toBe(exactDate);
  const publishedCycle = (await exactDeadline.locator(".admissions-deadline-cycle").textContent()).replace(/[\u2010-\u2015\u2212]/g, "-");
  expect(publishedCycle).toContain("2027-28 entry");
  const sourceUrl = await exactDeadline.locator(".admissions-deadline-source").getAttribute("href");
  expect(sourceUrl).toBe("https://www.imperial.ac.uk/study/apply/undergraduate/process/deadlines/");

  await page.evaluate(() => {
    const createObjectURL = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (blob) => {
      window.__lastCalendarExport = blob.text();
      return createObjectURL(blob);
    };
  });

  const targetMonth = exactDate.slice(0, 7);
  const month = page.locator("[data-calendar-month-key]");
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
  expect(exportedIcs).toContain("DTSTART;VALUE=DATE:20270113");
  expect(exportedIcs).toContain("Admissions cycle: 2027-28 entry");
  expect(exportedIcs).toContain(`Source: ${sourceUrl}`);
});

test("yearless Harvard first-year deadlines retain their source and cycle without calendar export", async ({ page }) => {
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
  await expect(firstYearDeadline.locator(".admissions-deadline-cycle")).toContainText("does not name an entry year");
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

test("detail page renders dedicated Deadlines tab with interactive timeline", async ({ page }) => {
  await page.goto("/university.html?id=mit-usa-cambridge");
  await expect(page.locator("#detailCard")).toBeVisible();

  // Deadlines tab button should exist and switch to Deadlines pane
  const deadlinesTabBtn = page.locator(".d-tab-btn[data-tab='tab-deadlines']");
  await expect(deadlinesTabBtn).toBeVisible();
  await deadlinesTabBtn.click();

  const deadlinesPane = page.locator("#tab-deadlines");
  await expect(deadlinesPane).toHaveClass(/active/);

  const deadlineCards = page.locator(".admissions-deadline-item");
  const count = await deadlineCards.count();
  expect(count).toBeGreaterThan(0);
  for (const deadlineCard of await deadlineCards.all()) {
    await expect(deadlineCard.locator(".admissions-deadline-date")).not.toBeEmpty();
  }
  const cycleLabels = page.locator(".admissions-deadline-cycle");
  for (const cycleLabel of await cycleLabels.all()) {
    await expect(cycleLabel).not.toBeEmpty();
  }
  await expect(deadlinesPane).not.toContainText("2026–27");
  const milestones = page.locator(".timeline-milestone");
  for (const milestone of await milestones.all()) {
    await expect(milestone.locator(".timeline-milestone-date")).not.toBeEmpty();
  }

  const levelTabs = page.locator("#detailDeadlines [data-deadlines-level]");
  await expect(levelTabs).toHaveCount(5);
  const allTab = page.locator("#detailDeadlines [data-deadlines-level='all']");
  await allTab.click();
  const expectedCount = Number((await allTab.textContent()).match(/\((\d+)\)/)?.[1]);
  await expect(deadlineCards).toHaveCount(expectedCount);

  const degreeTab = page.locator("#detailDeadlines [data-deadlines-level]:not([data-deadlines-level='all'])").first();
  const degreeCount = Number((await degreeTab.textContent()).match(/\((\d+)\)/)?.[1]);
  await degreeTab.click();
  await expect(deadlineCards).toHaveCount(degreeCount);
});

test("family income selection triggers personalized net price on finance tab", async ({ page }) => {
  await seedProfile(page, {
    ...personas.enResearch.profile,
    familyIncome: "under_85k",
  });
  await page.goto("/university.html?id=harvard-usa-cambridge");
  await expect(page.locator("#detailCard")).toBeVisible();

  // Navigate to Costs & funding tab
  await page.click(".d-tab-btn[data-tab='tab-finance']");

  const netPriceCard = page.locator(".finance-net-price-card");
  await expect(netPriceCard).toBeVisible();
  await expect(netPriceCard).toContainText("needs review");
  await expect(netPriceCard).toContainText("Income alone cannot determine");
  await expect(netPriceCard).not.toContainText("$0");
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

test("admission track collapses secondary requirements and expands upon click", async ({ page }) => {
  await page.goto("/university.html?id=mit-usa-cambridge");
  await expect(page.locator("#detailCard")).toBeVisible();

  // Switch to admission tab
  await page.click(".d-tab-btn[data-tab='tab-admission']");

  const collapsible = page.locator(".track-collapsible-details").first();
  expect(await page.locator(".track-collapsible-details").count()).toBeGreaterThan(0);
  await expect(collapsible).not.toHaveAttribute("open");
  const summary = collapsible.locator(".track-collapsible-summary");
  await summary.click();
  await expect(collapsible).toHaveAttribute("open", "");
});
