const { test, expect } = require("./helpers/coverage-test.cjs");
const fs = require("node:fs/promises");

const IMPERIAL = "imperial-college-london-uk";
const MIT = "mit-usa-cambridge";
const STANFORD = "stanford-university-usa-ca";

function contextUrl(university, option, route, level = "undergraduate", tab = "admission") {
  const query = new URLSearchParams({ id: university, admission_option: option, admission_application_route: route,
    admission_level: level, admission_route: level === "undergraduate" ? "first_year" : "graduate",
    admission_cycle: "2027 entry", admission_fee: "unknown" });
  return `/university.html?${query}#tab-${tab}`;
}

async function prepare(page, { language = "eng", width = 1280, theme = "light" } = {}) {
  await page.setViewportSize({ width, height: 900 });
  await page.addInitScript(({ language, theme, mit }) => {
    if (sessionStorage.getItem("imperial-completion-seeded")) return;
    sessionStorage.setItem("imperial-completion-seeded", "1");
    localStorage.setItem("unisearch_ui_language_v1", language);
    localStorage.setItem("unisearch_theme", theme);
    localStorage.setItem("unisearch_universities_tour_seen_v1", "1");
    localStorage.setItem("unisearch_profile", JSON.stringify({ _v: 2, selectedAdmissionChoices: {
      [mit]: { studyOptionId: "mit-course-6-3-bachelor", applicationRouteId: "mit-first-year", studyLevel: "undergraduate",
        applicantRoute: "first_year", intendedEntryCycle: "2027 entry", feeStatusContext: "unknown" },
    } }));
  }, { language, theme, mit: MIT });
}

async function ready(page, tab) {
  await expect(page.locator("body")).toHaveAttribute("data-page", "university");
  await expect(page.locator("#detailCard")).toHaveClass(/is-mounted/);
  await expect(page.locator("#admissionsContext")).toHaveAttribute("data-state", "ready");
  await expect(page.locator(`#tab-${tab}`)).toHaveClass(/active/);
}

async function month(page, target) {
  const calendar = page.locator("#detailDeadlines .deadline-calendar");
  await expect(calendar).toBeVisible();
  for (let step = 0; step < 18; step++) {
    const current = await calendar.locator("[data-calendar-month-key]").getAttribute("data-calendar-month-key");
    if (current === target) return calendar;
    const direction = current < target ? "next" : "previous";
    const button = calendar.locator(`[data-calendar-month="${direction}"]`);
    await button.focus();
    await button.press("Enter");
    await expect(calendar.locator("[data-calendar-month-key]")).not.toHaveAttribute("data-calendar-month-key", current);
    await expect(calendar.locator(`[data-calendar-month="${direction}"]`)).toBeFocused();
  }
  throw new Error(`Calendar did not reach ${target}`);
}

for (const presentation of [{ language: "eng", width: 1280, theme: "light" }, { language: "rus", width: 390, theme: "dark" }, { language: "kaz", width: 320, theme: "light" }]) {
  test(`saved Imperial choice, precise ICS and concise comparison ${presentation.language} ${presentation.width}`, async ({ page }, testInfo) => {
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await prepare(page, presentation);
    await page.goto(contextUrl(IMPERIAL, "imperial-option-computing-meng", "procedure-computing-meng"));
    await ready(page, "admission");
    await expect(page.locator("#admissionsSaveChoice")).toBeEnabled();
    await page.locator("#admissionsSaveChoice").click();
    await expect.poll(() => page.evaluate(id => JSON.parse(localStorage.getItem("unisearch_profile")).selectedAdmissionChoices[id]?.studyOptionId, IMPERIAL)).toBe("imperial-option-computing-meng");
    await page.locator("#detailSaveBtn").click();
    await expect(page.locator("#detailSaveBtn")).toHaveAttribute("aria-pressed", "true");
    await page.locator('[data-tab="tab-deadlines"]').click();
    await ready(page, "deadlines");
    const calendar = await month(page, "2027-01");
    await calendar.locator('[data-calendar-day="2027-01-13"]').click();
    const event = calendar.locator(".deadline-calendar__details li").filter({ hasText: "18:00" });
    await expect(event).toContainText("Europe/London");
    const download = page.waitForEvent("download");
    await event.locator("[data-calendar-export]").click();
    const content = await fs.readFile(await (await download).path(), "utf8");
    expect(content).toContain("DTSTART:20270113T180000Z");
    expect(content.replace(/\r\n /g, "")).toContain("https://www.imperial.ac.uk/study/apply/undergraduate/process/deadlines/");
    expect(content).toContain("2027");
    await page.screenshot({ path: testInfo.outputPath("calendar.png"), fullPage: false });

    await page.evaluate(ids => localStorage.setItem("unisearch_compare_university_ids_v1", JSON.stringify(ids)), [IMPERIAL, MIT]);
    await page.goto("/compare.html");
    await expect(page.locator("body")).toHaveAttribute("data-page", "compare");
    await page.locator('[data-action="build-compare-results"], [data-reviewed-comparison]').first().waitFor();
    const build = page.locator('[data-action="build-compare-results"]');
    if (await build.count()) {
      await expect(build).toBeEnabled();
      await build.click();
    }
    const summary = page.locator("[data-reviewed-comparison]");
    await expect(summary).toBeVisible();
    await expect(summary).toContainText("GBP");
    await expect(summary).toContainText("USD");
    await expect(summary.locator('a[href*="imperial-college-london-uk"][href$="#tab-finance"]')).toHaveCount(1);
    await expect(page.locator(".compare-source-details").first()).not.toHaveAttribute("open", "");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    if (presentation.width < 768) {
      const geometry = await summary.locator(".compare-table-wrap").evaluate(wrap => {
        wrap.scrollLeft = wrap.scrollWidth;
        const label = wrap.querySelector("tbody th").getBoundingClientRect();
        const value = wrap.querySelector("tbody td:last-child").getBoundingClientRect();
        return { labelRight: label.right, valueLeft: value.left, valueRight: value.right, wrapRight: wrap.getBoundingClientRect().right };
      });
      expect(geometry.valueLeft).toBeGreaterThanOrEqual(geometry.labelRight - 1);
      expect(geometry.valueRight).toBeLessThanOrEqual(geometry.wrapRight + 1);
    }
    await summary.scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath("comparison.png"), fullPage: false });
    await summary.locator('a[href*="imperial-college-london-uk"][href$="#tab-finance"]').click();
    await ready(page, "finance");
    await expect(page.locator("#admissionsRoute")).toHaveValue("procedure-computing-meng");
    await page.reload();
    await ready(page, "finance");
    expect(errors).toEqual([]);
  });
}

test("MSc scholarship consideration and PhD rounds keep separate calendars", async ({ page }) => {
  await prepare(page);
  await page.goto(contextUrl(IMPERIAL, "imperial-option-computing", "procedure-computing", "masters", "deadlines"));
  await ready(page, "deadlines");
  const calendar = await month(page, "2027-04");
  await calendar.locator('[data-calendar-day="2027-04-28"]').click();
  await expect(calendar.locator(".deadline-calendar__details")).toContainText("Admissions cutoff for scholarship consideration");
  await page.goto(contextUrl(IMPERIAL, "imperial-computing-phd", "procedure-computing-phd", "doctoral", "deadlines"));
  await ready(page, "deadlines");
  const phd = await month(page, "2026-12");
  await phd.locator('[data-calendar-day="2026-12-01"]').click();
  await expect(phd.locator(".deadline-calendar__details")).toContainText("Application");
  await expect(phd.locator(".deadline-calendar__details")).not.toContainText("Imperial Inspires");
  const download = page.waitForEvent("download");
  await phd.locator("[data-calendar-export]").first().click();
  expect(await fs.readFile(await (await download).path(), "utf8")).toContain("DTSTART;VALUE=DATE:20261201");
});

test("MBA funding exclusions and joint RCA partial fee remain explicit", async ({ page }) => {
  await prepare(page);
  for (const [slug, price] of [["full-time-mba", "81,000"], ["global-mba", "60,500"]]) {
    await page.goto(contextUrl(IMPERIAL, `imperial-option-${slug}`, `procedure-${slug}`, "masters", "finance"));
    await ready(page, "finance");
    await expect(page.locator('[data-funding-availability="excluded_by_published_course_rules"]')).toContainText("excluded from this scholarship");
    await expect(page.locator("#detailFinance [data-course-tuition]")).toContainText(price);
  }
  await page.goto(contextUrl(IMPERIAL, "imperial-option-innovation-design-engineering", "procedure-innovation-design-engineering", "masters", "finance"));
  await ready(page, "finance");
  await expect(page.locator("#detailFinance [data-course-tuition]")).toContainText("20,350 first year");
  await expect(page.locator("#detailFinance [data-course-tuition]")).toContainText("Second year: TBC");
  await page.locator('[data-tab="tab-deadlines"]').click();
  const calendar = await month(page, "2027-01");
  await calendar.locator('[data-calendar-day="2027-01-08"]').click();
  await expect(calendar.locator(".deadline-calendar__details")).toContainText("12:00");
  const download = page.waitForEvent("download");
  await calendar.locator("[data-calendar-export]").click();
  expect(await fs.readFile(await (await download).path(), "utf8")).toContain("DTSTART:20270108T120000Z");
});

test("MIT yearless windows stay in references while Stanford CS exports its exact sourced date", async ({ page }) => {
  await prepare(page);
  await page.goto(contextUrl(MIT, "mit-course-6-3-bachelor", "mit-first-year", "undergraduate", "deadlines"));
  await ready(page, "deadlines");
  await expect(page.locator("#detailDeadlines [data-calendar-export]")).toHaveCount(0);
  await page.goto(contextUrl(STANFORD, "stanford-option-cs-ms", "engineering-doerr-evidence:external-graduate", "masters", "deadlines"));
  await ready(page, "deadlines");
  const calendar = await month(page, "2026-12");
  await calendar.locator('[data-calendar-day="2026-12-08"]').click();
  await expect(calendar.locator("[data-calendar-export]")).toBeEnabled();
  await expect(calendar.locator(".deadline-calendar__details a")).toHaveAttribute("href", /^https:\/\/(?:[a-z0-9-]+\.)*stanford\.edu(?:[/?#]|$)/i);
});
