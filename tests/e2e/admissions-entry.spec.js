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

test("requirements match reads the default first-year path at once and shows its score", async ({ page }) => {
  await page.route("**/admissions-context", async route => {
    const response = await route.fetch();
    const data = await response.json();
    if (data.selected_route) data.assessment = { chancePercent: 100, activeChoice: { details: { checks: [{ measurable: true, status: "met" }] } } };
    await route.fulfill({ response, json: data });
  });
  await openUniversity(page, "mit-usa-cambridge");
  await page.locator('[data-tab="tab-admission"]').click();
  const assessment = page.locator("#detailRequirements [data-requirements-match]");
  await expect(assessment).toBeVisible();
  // The tab reads the same default path as the Overview, without asking which path to check first.
  await expect(assessment).not.toContainText("Choose an application path");
  await expect(assessment).not.toContainText("Choose a program");
  await expect(page.locator("#admissionsRoute")).toHaveValue("mit-first-year");
  expect(new URL(page.url()).searchParams.get("admission_application_route")).toBeNull();
  await expect(assessment).toContainText("100%");
  await expect(assessment).toContainText("1 of 1");
  await expect(assessment).toContainText("not an admission probability");
  await expect(page.locator("#detailRequirements [data-requirements-match]")).toHaveCount(1);
});

for (const item of [
  { id: "mit-usa-cambridge", route: "mit-first-year", language: "eng", theme: "light", width: 1280 },
  { id: "stanford-university-usa-ca", route: "undergraduate-shared-evidence:stanford-first-year", language: "rus", theme: "dark", width: 390 },
]) {
  test(`${item.id} reads and saves shared undergraduate admission without a major`, async ({ page }) => {
    await openUniversity(page, item.id, item);
    await page.locator('[data-tab="tab-admission"]').click();
    await expect(page.locator("#tab-admission")).toHaveClass(/active/);
    // The shared first-year path is read by default, so it can be remembered without choosing it first.
    await expect(page.locator("#admissionsContext")).toHaveAttribute("data-state", "ready");
    await expect(page.locator("#admissionsRoute")).toHaveValue(item.route);
    await expect(page.locator("#detailRequirements [data-admissions-fact]").first()).toBeAttached();
    await expect(page.locator("#admissionsSaveChoice")).toBeEnabled();
    expect(new URL(page.url()).searchParams.get("admission_option") || "").toBe("");
    await page.locator("#admissionsSaveChoice").click();
    await page.reload();
    await expect(page.locator("#admissionsContext")).toHaveAttribute("data-state", "ready");
    await expect(page.locator("#admissionsRoute")).toHaveValue(item.route);
    await expect(page.locator("#detailRequirements [data-admissions-fact]").first()).toBeAttached();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}

test("Imperial reads a course with one application route directly, on selection and on a deep link without a route", async ({ page }, testInfo) => {
  await openUniversity(page, "imperial-college-london-uk", { language: "kaz", width: 390, theme: "dark" });
  await page.locator('[data-tab="tab-programs"]').click();
  await expect(page.locator("#tab-programs")).toHaveClass(/active/);
  await page.locator("#admissionsSearch").fill("Computing MEng");
  await page.locator("#admissionsSearchSubmit").click();
  const course = page.locator('[data-study-option="imperial-option-computing-meng"]');
  await expect(course).toBeVisible();
  await course.click();
  await page.locator('[data-select-study-option="imperial-option-computing-meng"]').click();
  await expect(page.locator("#admissionsContext")).toHaveAttribute("data-state", "ready");
  // The only route is selected like a manual choice: in the URL and the selection bar, but not saved.
  await expect(page.locator("#admissionsRoute")).toHaveValue("procedure-computing-meng");
  expect(new URL(page.url()).searchParams.get("admission_application_route")).toBe("procedure-computing-meng");
  await expect(page.locator("#tab-admission")).toHaveClass(/active/);
  await page.locator('[data-tab="tab-programs"]').click();
  await expect(page.locator("#admissionsStudyOverview [data-award-explanation]")).toBeVisible();
  await page.locator('[data-tab="tab-admission"]').click();
  await expect(page.locator("#tab-admission")).toHaveClass(/active/);
  await expect(page.locator("[data-route-options]")).toHaveCount(0);
  await expect(page.locator("#detailRequirements [data-admissions-key-facts]")).toBeVisible();
  await expect(page.locator("#admissionsSaveChoice")).toBeEnabled();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("unisearch_profile") || "{}").selectedAdmissionChoices?.["imperial-college-london-uk"])).toBeUndefined();
  await page.locator("#admissionsContext").scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("imperial-direct-route-mobile-dark-kz.png") });
  await page.goBack();
  await expect(page.locator("#admissionsRoute")).toHaveValue("");
  await page.goForward();
  await expect(page.locator("#admissionsRoute")).toHaveValue("procedure-computing-meng");
  const empty = new URL(page.url());
  empty.searchParams.set("admission_application_route", "");
  await page.goto(empty.href);
  await expect(page.locator("#admissionsContext")).toHaveAttribute("data-state", "ready");
  await expect(page.locator("#admissionsRoute")).toHaveValue("procedure-computing-meng");
});

test("mobile route selection reveals the updated context below the navigation", async ({ page }) => {
  const foundationRoute = "nu-a-route-regular-foundation-undergraduate";
  // A bachelor's program has several ways in (Foundation has one and opens it directly), so the reader chooses here.
  await openUniversity(page, "nazarbayev-university-kaz-astana", {
    language: "kaz", width: 390,
    query: "&admission_option=nu-a-study-bachelor-of-science-in-computer-science&admission_level=undergraduate&admission_application_route=#tab-admission",
  });
  await page.setViewportSize({ width: 390, height: 700 });
  await expect(page.locator("#tab-admission")).toHaveClass(/active/);
  await expect(page.locator("#admissionsRoute")).toHaveValue("");
  const choice = page.locator(`[data-read-route="${foundationRoute}"]`);
  await choice.scrollIntoViewIfNeeded();
  await choice.click();
  await expect(page.locator("#admissionsContext")).toHaveAttribute("data-state", "ready");
  await expect(page.locator("#admissionsRoute")).toHaveValue(foundationRoute);
  // The selection bar and the key facts that now open the tab are revealed below the navigation.
  await expect.poll(() => page.evaluate(() => {
    const nav = document.querySelector(".navbar").getBoundingClientRect();
    const selection = document.querySelector("#admissionsReferenceSummary").getBoundingClientRect();
    const heading = document.querySelector("#admissionsKeyFactsTitle").getBoundingClientRect();
    return selection.top >= nav.bottom && heading.top >= nav.bottom && heading.bottom <= innerHeight;
  })).toBe(true);
  await page.goBack();
  await expect(page.locator("#admissionsContext")).toHaveAttribute("data-state", "ready");
  await expect(page.locator("#admissionsRoute")).toHaveValue("");
  await page.goForward();
  await expect(page.locator("#admissionsContext")).toHaveAttribute("data-state", "ready");
  await expect(page.locator("#admissionsRoute")).toHaveValue(foundationRoute);
  await page.reload();
  await expect(page.locator("#admissionsContext")).toHaveAttribute("data-state", "ready");
  await expect(page.locator("#admissionsRoute")).toHaveValue(foundationRoute);
  // A deep link to a program with a single route and no route reads that route directly.
  await page.goto("/university.html?id=nazarbayev-university-kaz-astana&admission_option=nu-a-study-bachelor-in-nursing&admission_level=undergraduate&admission_application_route=#tab-admission");
  await expect(page.locator("#admissionsContext")).toHaveAttribute("data-state", "ready");
  await expect(page.locator("#admissionsRoute")).toHaveValue("nu-a-route-nursing");
  await expect.poll(() => new URL(page.url()).searchParams.get("admission_application_route")).toBe("nu-a-route-nursing");
  await expect(page.locator(".admissions-application-link")).toBeVisible();
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
    localStorage.setItem("unisearch_profile", JSON.stringify({ _v: 2, studyLevel: "Bachelor", major: "Computer Science", intendedEntryCycle: "2027 entry", feeStatusContext: "self_reported_international_overseas" }));
  });
  await openUniversity(page, "imperial-college-london-uk", { query: "&admission_cycle=&admission_fee=unknown&admission_route=" });
  await page.locator('[data-tab="tab-programs"]').click();
  await expect(page.locator("#tab-programs")).toHaveClass(/active/);
  await expect(page.locator('[data-remove-suggestion="major"]')).toContainText("Computer Science");
  await expect(page.locator('[data-remove-suggestion="level"]')).toBeVisible();
  const suggestionStyles = await page.evaluate(() => {
    const chip = getComputedStyle(document.querySelector('[data-remove-suggestion="major"]'));
    const showAll = getComputedStyle(document.querySelector("[data-show-all-programs]"));
    return {
      chipBg: chip.backgroundColor,
      chipShadow: chip.boxShadow,
      showAllBg: showAll.backgroundColor,
      showAllShadow: showAll.boxShadow,
    };
  });
  expect(suggestionStyles.chipBg).not.toBe("rgba(0, 0, 0, 0)");
  expect(suggestionStyles.chipShadow).toBe("none");
  expect(suggestionStyles.showAllBg).toBe("rgba(0, 0, 0, 0)");
  expect(suggestionStyles.showAllShadow).toBe("none");
  await expect(page.locator('[data-study-option="imperial-option-computing-meng"]')).toBeVisible();
  await expect(page.locator('[data-study-option="imperial-option-computing-beng"]')).toBeVisible();
  const filteredCount = await page.locator("#admissionsProgramCount").innerText();
  await expect(page.locator("#admissionsCycle")).toHaveValue("");
  await expect(page.locator("#admissionsApplicant")).toHaveCount(0);
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

test("an old link or saved choice naming a different applicant category does not conflict with the selected route", async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem("stale-category-seeded")) return;
    sessionStorage.setItem("stale-category-seeded", "1");
    localStorage.setItem("unisearch_profile", JSON.stringify({ _v: 2, selectedAdmissionChoices: { "imperial-college-london-uk": {
      studyOptionId: "imperial-option-computing-meng", applicationRouteId: "procedure-computing-meng", studyLevel: "undergraduate", applicantRoute: "transfer",
    } } }));
  });
  const requests = [];
  page.on("request", (request) => { if (request.url().endsWith("/admissions-context") && request.method() === "POST") requests.push(request.postDataJSON()); });
  await openUniversity(page, "imperial-college-london-uk", { query: "&admission_option=imperial-option-computing-meng&admission_application_route=procedure-computing-meng&admission_level=undergraduate&admission_route=graduate" });
  await expect(page.locator("#admissionsRoute")).toHaveValue("procedure-computing-meng");
  await expect(page.locator("#admissionsApplicant")).toHaveCount(0);
  await expect(page.locator("#admissionsContext [data-no-application-route], #admissionsContext .admissions-state")).toHaveCount(0);
  await expect(page.locator("#admissionsReferenceSummary")).toContainText("First-year applicant");
  await page.locator('[data-tab="tab-admission"]').click();
  await expect(page.locator("#detailRequirements [data-admissions-key-facts]")).toBeVisible();
  expect(requests.length).toBeGreaterThan(0);
  for (const body of requests) {
    expect(body.context).not.toHaveProperty("applicant_route");
    expect(body.profile).not.toHaveProperty("applicant_route");
    expect(body.profile.selectedAdmissionChoices?.["imperial-college-london-uk"]).toBeUndefined();
  }
  await page.locator("#admissionsReferenceSummary button").click();
  // The UK course asks for a fee status; its single published intake is read without an entry-year field.
  await expect(page.locator("#admissionsAdvanced > summary")).toHaveText("Fee status");
  await expect(page.locator("#admissionsContext")).toHaveAttribute("data-state", "ready");
  expect(new URL(page.url()).searchParams.has("admission_route")).toBe(false);
  await expect(page.locator("#admissionsSaveChoice")).toBeEnabled();
  await page.locator("#admissionsSaveChoice").click();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("unisearch_profile")).selectedAdmissionChoices["imperial-college-london-uk"]);
  expect(saved.applicationRouteId).toBe("procedure-computing-meng");
  expect(saved).not.toHaveProperty("applicantRoute");
});
