const { test, expect } = require("@playwright/test");
const { setNativeSelect } = require("./helpers/selectors");

function contextUrl({ university, option, route, level, applicant, cycle }) {
  const params = new URLSearchParams({
    id: university,
    admission_option: option,
    admission_application_route: route,
    admission_level: level,
    admission_fee: "unknown",
    admission_route: applicant,
    admission_cycle: cycle,
  });
  return `/university.html?${params.toString()}`;
}

async function openContext(page, context) {
  await page.addInitScript(() => {
    localStorage.setItem("unisearch_ui_language_v1", "eng");
    localStorage.setItem("unisearch_theme", "light");
    localStorage.setItem("unisearch_universities_tour_seen_v1", "1");
  });
  const responsePromise = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname === `/universities/${context.university}/admissions-context` && response.request().method() === "POST";
  });
  await page.goto(contextUrl(context));
  await expect(page.locator("body")).toHaveAttribute("data-page", "university");
  await expect(page.locator("#detailCard")).toHaveClass(/is-mounted/);
  await expect(page.locator("#admissionsContext")).toHaveAttribute("data-state", "ready");
  const response = await responsePromise;
  expect(response.status()).toBe(200);
  return response.json();
}

async function openTab(page, tab) {
  await page.locator(`.d-tab-btn[data-tab="tab-${tab}"]`).click();
  await expect(page.locator(`#tab-${tab}`)).toHaveClass(/active/);
}

async function setProgramSelection(page, universityId, studyLevel, programId, programName) {
  await page.evaluate(({ universityId: id, studyLevel: level, programId: selectedId, programName: selectedName }) => {
    localStorage.setItem("unisearch_profile", JSON.stringify({
      _v: 2,
      studyLevel: level,
      major: selectedName,
      selectedAdmissionChoices: { [id]: { choiceKey: "program-coverage-test", programId: selectedId, programName: selectedName } },
    }));
  }, { universityId, studyLevel, programId, programName });
}

test("MIT study-level filters remain usable at a 390px viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/university.html?id=mit-usa-cambridge");
  await expect(page.locator("#detailCard")).toHaveClass(/is-mounted/);
  await openTab(page, "programs");

  const level = page.locator("#admissionsStudyLevel");
  await expect(level.locator("xpath=..").locator(".custom-select-trigger")).toBeVisible();
  await setNativeSelect(page, "admissionsStudyLevel", "undergraduate");
  await page.locator("#admissionsSearch").fill("Computer Science and Engineering");
  const responsePromise = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname === "/universities/mit-usa-cambridge/study-options"
      && url.searchParams.get("study_level") === "undergraduate"
      && url.searchParams.get("search") === "Computer Science and Engineering";
  });
  await page.locator("#admissionsSearchSubmit").click();
  const response = await responsePromise;
  expect(response.status()).toBe(200);
  const results = await response.json();
  expect(results.items.map((item) => item.id)).toContain("mit-course-6-3-bachelor");
  await expect(page.locator('#admissionsProgramList [data-study-option="mit-course-6-3-bachelor"]')).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test("Stanford MD and Computer Science tuition retain their actual route and published periods", async ({ page }) => {
  const md = await openContext(page, {
    university: "stanford-university-usa-ca",
    option: "stanford-option-med-md",
    route: "professional-evidence:med_md_admission",
    level: "professional",
    applicant: "graduate",
    cycle: "Fall 2027 entry",
  });
  expect(md.selected_option.id).toBe("stanford-option-med-md");
  expect(md.selected_route.id).toBe("professional-evidence:med_md_admission");
  const mdTuition = md.facts.find((fact) => fact.id === "professional-evidence:med_md_award_cost");
  expect(mdTuition.scope.option_ids).toContain("stanford-option-med-md");
  expect(mdTuition.scope.route_ids).toContain("professional-evidence:med_md_admission");
  expect(mdTuition.scope.cycle).toBe("2026-27 academic year");
  await openTab(page, "finance");
  const mdCost = page.locator('#tab-finance [data-admissions-fact="professional-evidence:med_md_award_cost"]');
  await expect(mdCost).toBeVisible();
  await expect(mdCost).toContainText(/2026[-\u2011]27/);
  await expect(mdCost).toContainText("USD 24,034 per quarter");

  const cs = await openContext(page, {
    university: "stanford-university-usa-ca",
    option: "stanford-option-cs-ms",
    route: "engineering-doerr-evidence:external-graduate",
    level: "masters",
    applicant: "graduate",
    cycle: "2027-28 entry",
  });
  expect(cs.selected_option.id).toBe("stanford-option-cs-ms");
  expect(cs.selected_route.id).toBe("engineering-doerr-evidence:external-graduate");
  const publishedTuition = cs.facts.find((fact) => fact.id === "engineering-doerr-evidence:engineering-2026-27-historical-tuition");
  expect(publishedTuition.scope.option_ids).toContain("stanford-option-cs-ms");
  expect(publishedTuition.scope.cycle).toBe("2026-27 tuition year");
  expect(publishedTuition.value.currency).toBe("USD");
  expect(publishedTuition.value.graduate_engineering_quarterly_tuition).toEqual({ "8-10_units": 15100, "11-18_units": 23239 });
  const currentCostUnknown = cs.unknowns.find((fact) => fact.id === "engineering-doerr-evidence:engineering-2027-cost-unpublished");
  expect(currentCostUnknown.reason).toContain("2027-28 Engineering prices are not published");
  expect(cs.history.unknown_ids).toContain("engineering-doerr-evidence:tuition-and-funding-details");

  await openTab(page, "finance");
  const csCost = page.locator('#tab-finance [data-admissions-fact="engineering-doerr-evidence:engineering-2026-27-historical-tuition"]');
  await expect(csCost).toBeVisible();
  await expect(csCost).toContainText(/2026[-\u2011]27/);
  await expect(csCost).toContainText(/15,?100/);
  await expect(csCost).toContainText(/23,?239/);
  await expect(csCost).toContainText(/historical context only, not published 2027[-\u2011]28 tuition/);
  await openTab(page, "admission");
  const unknowns = page.locator("#detailRequirements details.admissions-catalog__unknowns");
  await expect(unknowns).toBeVisible();
  await unknowns.locator(":scope > summary").click();
  await expect(unknowns.locator(".admissions-catalog__unknown").filter({ hasText: /2027[-\u2011]28 Engineering prices are not published/ })).toHaveCount(1);
  await openTab(page, "general");
  const history = page.locator("#admissionsUniversityInfo .admissions-catalog > details").filter({ hasText: /Historical records/ });
  await expect(history).toBeVisible();
  await history.locator(":scope > summary").click();
  await expect(history.locator(".admissions-catalog__unknown")).not.toHaveCount(0);
  await expect(history).toContainText(/2027[-\u2011]28 tuition and individual future offer amounts remain unavailable/);
});

test("MIT application dates and Imperial award deadlines stay in their own source scopes", async ({ page }) => {
  const mit = await openContext(page, {
    university: "mit-usa-cambridge",
    option: "mit-course-6-3-bachelor",
    route: "mit-first-year",
    level: "undergraduate",
    applicant: "first_year",
    cycle: "Fall 2027 entry",
  });
  expect(mit.selected_option.id).toBe("mit-course-6-3-bachelor");
  expect(mit.selected_route.id).toBe("mit-first-year");
  const applicationDate = mit.facts.find((fact) => fact.id === "mit-first-year-application-deadline");
  expect(applicationDate).toBeTruthy();
  expect(applicationDate.value).toContain("January 4");
  await openTab(page, "deadlines");
  await expect(page.locator('#tab-deadlines [data-admissions-fact="mit-first-year-application-deadline"]')).toContainText("January 4");

  const imperial = await openContext(page, {
    university: "imperial-college-london-uk",
    option: "imperial-civil-environmental-phd",
    route: "procedure-civil-environmental-phd",
    level: "doctoral",
    applicant: "graduate",
    cycle: "2027 entry",
  });
  expect(imperial.selected_option.id).toBe("imperial-civil-environmental-phd");
  expect(imperial.selected_route.id).toBe("procedure-civil-environmental-phd");
  const courseProcess = imperial.facts.find((fact) => fact.id === "imperial-doctoral-process");
  expect(courseProcess).toBeTruthy();
  const awardTerms = imperial.facts.find((fact) => fact.id === "imperial-civil-scholarship-scheme-conditions");
  expect(awardTerms.scope.option_ids).toContain("imperial-civil-environmental-phd");
  expect(awardTerms.value.deadlines_by_round["1"]).toBe("2026-11-02");
  expect(imperial.fact_groups.deadlines || []).not.toContain("imperial-civil-scholarship-scheme-conditions");

  await openTab(page, "deadlines");
  await expect(page.locator("#detailDeadlines")).toContainText("No source records are catalogued");
  await expect(page.locator("#detailDeadlines")).not.toContainText("2026-11-02");
  await openTab(page, "finance");
  const funding = page.locator('#tab-finance [data-admissions-fact="imperial-civil-scholarship-scheme-conditions"]');
  await expect(funding).toBeVisible();
  await expect(funding).toContainText(/2026[-\u2011]11[-\u2011]02/);
});

test("Harvard saved program names resolve unique concentrations but leave split legacy routes unselected", async ({ page }) => {
  const universityId = "harvard-usa-cambridge";
  await page.goto(`/university.html?id=${universityId}`);
  await expect(page.locator("#detailCard")).toBeVisible();
  await expect(page.locator("#detailName")).not.toBeEmpty();

  await setProgramSelection(page, universityId, "Bachelor", "Computer Science", "Computer Science");
  await page.reload();
  await expect(page.locator("#detailCard")).toBeVisible();
  await page.locator('.d-tab-btn[data-tab="tab-programs"]').click();
  await expect(page.locator("#tab-programs")).toHaveClass(/active/);
  await expect(page.locator("#detailQualificationGuidance .qualification-guidance__meta").filter({ hasText: /^Program:/ })).toContainText("Computer Science");

  for (const legacyName of ["Architecture (MArch)", "Public Health (MPH)"]) {
    await setProgramSelection(page, universityId, "Master", legacyName, legacyName);
    await page.reload();
    await expect(page.locator("#detailCard")).toBeVisible();
    await page.locator('.d-tab-btn[data-tab="tab-programs"]').click();
    await expect(page.locator("#tab-programs")).toHaveClass(/active/);
    const coverage = page.locator("#detailPrograms .program-coverage");
    await expect(coverage).toContainText("Select a specific program");
    await expect(coverage.locator(".program-coverage__program")).toHaveCount(0);
    await expect(page.locator("#detailQualificationGuidance .qualification-guidance__meta").filter({ hasText: /^Program:/ })).toHaveCount(0);
  }
});

test("Oxford qualification guidance flags Kazakhstan Attestat in English and Russian on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    localStorage.setItem("unisearch_profile", JSON.stringify({
      studyLevel: "Bachelor",
      applicantRoute: "first_year",
      countryOfEducation: "KZ",
      educationCredential: "other",
      educationCredentialOther: "Attestat/Svidetel' stvo o Srednem Obrazovanii (Certificate of Secondary Education)",
      intendedEntryCycle: "2027 Fall",
    }));
  });
  await page.goto("/university.html?id=university-of-oxford-uk-oxford");
  await expect(page.locator("#detailCard")).toBeVisible();
  await expect(page.locator("#detailName")).not.toBeEmpty();
  await page.locator('.d-tab-btn[data-tab="tab-programs"]').click();
  await expect(page.locator("#tab-programs")).toHaveClass(/active/);

  const guidance = page.locator("#detailQualificationGuidance .qualification-guidance__result");
  await expect(guidance.locator(".qualification-guidance__status")).toContainText("Explicitly not accepted");
  await expect(guidance).toContainText("Kazakhstan's Attestat");
  await expect(guidance.locator(".qualification-guidance__source")).toHaveAttribute("href", /^https:\/\/www\.ox\.ac\.uk\//);

  await page.evaluate(() => {
    const language = document.getElementById("languageSelect");
    language.value = "rus";
    language.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.waitForFunction(() => {
    const language = document.getElementById("languageSelect");
    return language?.value === "rus" && language.dataset.loading !== "1" && !language.disabled;
  });
  await expect(guidance.locator(".qualification-guidance__status")).toContainText("Официально указана как не принимаемая");
  await expect(guidance).toContainText("аттестат Казахстана");
  await expect(guidance.locator(".qualification-guidance__source")).toHaveAttribute("href", /^https:\/\/www\.ox\.ac\.uk\//);
});
