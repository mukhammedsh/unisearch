const { test, expect } = require("./helpers/coverage-test.cjs");

async function openUniversity(page, id, { language = "eng", theme = "light", width = 1280, query = "" } = {}) {
  await page.setViewportSize({ width, height: 900 });
  await page.addInitScript(({ language, theme }) => {
    localStorage.setItem("unisearch_ui_language_v1", language);
    localStorage.setItem("unisearch_theme", theme);
    localStorage.setItem("unisearch_universities_tour_seen_v1", "1");
  }, { language, theme });
  await page.goto(`/university.html?id=${id}${query}`);
  await expect(page.locator("body")).toHaveAttribute("data-page", "university");
  await expect(page.locator("#detailCard")).toHaveClass(/is-mounted/);
  await expect(page.locator("#admissionsContext")).toHaveAttribute("data-state", "ready");
  await expect(page.locator("#admissionsSearchSubmit")).toBeEnabled();
}

for (const item of [
  { id: "mit-usa-cambridge", route: "mit-first-year", language: "eng", theme: "light", width: 1280 },
  { id: "stanford-university-usa-ca", route: "undergraduate-shared-evidence:stanford-first-year", language: "rus", theme: "dark", width: 390 },
]) {
  test(`${item.id} reads and saves shared undergraduate admission without a major`, async ({ page }) => {
    await openUniversity(page, item.id, item);
    await page.locator('[data-tab="tab-admission"]').click();
    await expect(page.locator("#tab-admission")).toHaveClass(/active/);
    await page.locator(`[data-shared-route="${item.route}"]`).click();
    await expect(page.locator("#admissionsContext")).toHaveAttribute("data-state", "ready");
    await expect(page.locator("#admissionsRoute")).toHaveValue(item.route);
    await expect(page.locator("#detailRequirements [data-admissions-fact]").first()).toBeAttached();
    await expect(page.locator("#admissionsSaveChoice")).toBeEnabled();
    expect(new URL(page.url()).searchParams.get("admission_option")).toBe("");
    await page.locator("#admissionsSaveChoice").click();
    await page.reload();
    await expect(page.locator("#admissionsContext")).toHaveAttribute("data-state", "ready");
    await expect(page.locator("#admissionsRoute")).toHaveValue(item.route);
    await expect(page.locator("#detailRequirements [data-admissions-fact]").first()).toBeAttached();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}

test("Imperial opens the single course route directly and preserves an explicit empty URL override", async ({ page }, testInfo) => {
  await openUniversity(page, "imperial-college-london-uk", { language: "kaz", width: 390, theme: "dark" });
  await page.locator('[data-tab="tab-programs"]').click();
  await expect(page.locator("#tab-programs")).toHaveClass(/active/);
  await page.locator("#admissionsSearch").fill("Computing MEng");
  await page.locator("#admissionsSearchSubmit").click();
  const course = page.locator('[data-study-option="imperial-option-computing-meng"]');
  await expect(course).toBeVisible();
  await course.click();
  await expect(page.locator("#admissionsRoute")).toHaveValue("procedure-computing-meng");
  await expect(page.locator("#admissionsContext")).toHaveAttribute("data-state", "ready");
  await expect(page.locator("select#admissionsRoute")).toHaveCount(0);
  await expect(page.locator("#admissionsStudyRelationship [data-integrated-meng]")).toBeVisible();
  await page.locator("#admissionsViewRequirements").click();
  await expect(page.locator("#tab-admission")).toHaveClass(/active/);
  await expect(page.locator("#admissionsSaveChoice")).toBeEnabled();
  await page.locator("#admissionsContext").scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("imperial-direct-route-mobile-dark-kz.png") });
  await page.goBack();
  await expect(page.locator("#admissionsReferenceSummary")).toBeHidden();
  await page.goForward();
  await expect(page.locator("#admissionsRoute")).toHaveValue("procedure-computing-meng");
  const empty = new URL(page.url());
  empty.searchParams.set("admission_application_route", "");
  await page.goto(empty.href);
  await expect(page.locator("#admissionsContext")).toHaveAttribute("data-state", "ready");
  await expect(page.locator("#admissionsRoute")).toHaveValue("");
});

test("Stanford CS exposes real applicant situations while keeping shared policies within their route", async ({ page }, testInfo) => {
  await openUniversity(page, "stanford-university-usa-ca", { language: "rus", theme: "light", query: "&admission_option=stanford-option-cs-ms&admission_level=masters&admission_application_route=" });
  await page.locator('[data-tab="tab-admission"]').click();
  await expect(page.locator("#tab-admission")).toHaveClass(/active/);
  const entries = page.locator("[data-read-route]");
  await expect(entries).toHaveCount(5);
  await expect(page.locator('[data-read-route="directory-evidence:stanford-graduate-cs-ms"]')).toContainText(/внешние/);
  await expect(page.locator('[data-read-route="engineering-doerr-evidence:cs-coterm"]').locator("xpath=..").locator("xpath=..")).toContainText(/нынешних бакалавров Stanford/);
  await expect(page.locator('[data-read-route="engineering-doerr-evidence:external-graduate"]')).toHaveCount(0);
  await page.locator("#admissionsContext").scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("stanford-cs-applicant-situations-desktop-light-ru.png") });
  await page.locator('[data-read-route="directory-evidence:stanford-graduate-cs-ms"]').click();
  await expect(page.locator("#admissionsContext")).toHaveAttribute("data-state", "ready");
  await expect(page.locator("[data-route-audience]")).toContainText(/Внешние абитуриенты/);
  await expect(page.locator('[data-admissions-fact="engineering-doerr-evidence:graduate-entry-eligibility"]').first()).toBeAttached();
});

test("profile suggestions are removable and do not overwrite intentional public context", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("unisearch_profile", JSON.stringify({ _v: 2, studyLevel: "Bachelor", major: "Computer Science", applicantRoute: "first_year", intendedEntryCycle: "2027 entry", feeStatusContext: "self_reported_international_overseas" }));
  });
  await openUniversity(page, "imperial-college-london-uk", { query: "&admission_cycle=&admission_fee=unknown&admission_route=" });
  await page.locator('[data-tab="tab-programs"]').click();
  await expect(page.locator("#tab-programs")).toHaveClass(/active/);
  await expect(page.locator('[data-remove-suggestion="major"]')).toContainText("Computer Science");
  await expect(page.locator('[data-remove-suggestion="level"]')).toBeVisible();
  await expect(page.locator('[data-study-option="imperial-option-computing-meng"]')).toBeVisible();
  await expect(page.locator('[data-study-option="imperial-option-computing-beng"]')).toBeVisible();
  const filteredCount = await page.locator("#admissionsProgramCount").innerText();
  await expect(page.locator("#admissionsCycle")).toHaveValue("");
  await expect(page.locator("#admissionsApplicant")).toHaveValue("");
  await expect(page.locator("#admissionsFee")).toHaveValue("unknown");
  await page.locator('[data-remove-suggestion="major"]').click();
  await expect(page.locator("#admissionsSearchSubmit")).toBeEnabled();
  await expect(page.locator("#admissionsProgramCount")).not.toHaveText(filteredCount);
  await expect(page.locator("#admissionsStudyLevel")).toHaveValue("undergraduate");
  await page.locator("[data-show-all-programs]").click();
  await expect(page.locator("#admissionsSearchSubmit")).toBeEnabled();
  await expect(page.locator("#admissionsProfileSuggestions")).toBeHidden();
  await expect(page.locator("#admissionsStudyLevel")).toHaveValue("");
  await expect(page.locator("#admissionsProgramList > .program-card")).toHaveCount(8);
});
