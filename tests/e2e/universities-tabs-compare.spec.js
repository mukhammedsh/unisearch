const { test, expect } = require("./helpers/coverage-test.cjs");
const { markTourAsSeen } = require("./helpers/personas");
const { setNativeSelect } = require("./helpers/selectors");
const { expectNoStackedGapMargins } = require("./helpers/design");

const MIT_ID = "mit-usa-cambridge";
const IMPERIAL_ID = "imperial-college-london-uk";
const OXFORD_ID = "university-of-oxford-uk-oxford";
const HARVARD_ID = "harvard-usa-cambridge";
let compareSeed = 0;

async function clearCompareState(page, language = "eng") {
  await page.addInitScript(({ nextLanguage, seed }) => {
    const key = `unisearch_compare_test_seed_${seed}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    localStorage.setItem("unisearch_ui_language_v1", nextLanguage);
    localStorage.removeItem("unisearch_compare_university_ids_v1");
    localStorage.removeItem("unisearch_compare_admission_choices_v1");
    localStorage.removeItem("unisearch_filters");
    localStorage.removeItem("unisearch_profile");
    localStorage.removeItem("unisearch_detail_cache_v3");
  }, { nextLanguage: language, seed: ++compareSeed });
}

async function waitForUniversitiesReady(page) {
  await expect(page.locator("body")).toHaveAttribute("data-page", "universities");
  await expect(page.locator("#universitiesList .uni-card:not(.is-skeleton)").first()).toBeVisible();
}

async function seedReviewedContexts(page) {
  await page.addInitScript(({ mit, imperial }) => {
    localStorage.setItem("unisearch_profile", JSON.stringify({ _v: 2, selectedAdmissionChoices: {
      [mit]: { studyOptionId: "mit-course-6-3-bachelor", applicationRouteId: "mit-first-year", studyLevel: "undergraduate", applicantRoute: "first_year", intendedEntryCycle: "Fall 2027 entry", feeStatusContext: "unknown" },
      [imperial]: { studyOptionId: "imperial-option-computing-meng", applicationRouteId: "procedure-computing-meng", studyLevel: "undergraduate", applicantRoute: "first_year", intendedEntryCycle: "2027 entry", feeStatusContext: "unknown" },
    } }));
  }, { mit: MIT_ID, imperial: IMPERIAL_ID });
}

async function chooseReviewedContext(page, id, search, option, route, cycle) {
  const chooser = page.locator(`#compare-options-${id}`);
  await expect(chooser.locator("[data-compare-context-form]")).toBeVisible();
  await chooser.locator("[data-compare-search-form] input[type=search]").fill(search);
  await setNativeSelect(page, `compare-filter_level-${id}`, "undergraduate");
  await chooser.locator("[data-compare-search-form] button[type=submit]").click();
  await chooser.locator(`[data-study-option="${option}"]`).click();
  const select = chooser.locator('select[data-context-field="application_route_id"]');
  await expect(select).toBeEnabled();
  await expect(select).toHaveValue("");
  const wrapper = select.locator("xpath=..");
  await wrapper.locator(".custom-select-trigger").click();
  await wrapper.locator(`.custom-option[data-value="${route}"]`).click();
  await setNativeSelect(page, `compare-applicant_route-${id}`, "first_year");
  await chooser.locator(`#compare-cycle-${id}`).fill(cycle);
  await chooser.locator("[data-compare-context-form] button[type=submit]").click();
  await expect.poll(() => page.evaluate((uid) => JSON.parse(localStorage.getItem("unisearch_profile") || "{}").selectedAdmissionChoices?.[uid], id)).toMatchObject({
    studyOptionId: option, applicationRouteId: route, intendedEntryCycle: cycle,
  });
}

test("empty comparison action uses token spacing and stays centered", async ({ page }) => {
  await clearCompareState(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/compare.html");

  await expect(page.locator("body")).toHaveAttribute("data-page", "compare");
  const emptyState = page.locator(".compare-results-empty");
  await expect(emptyState).toBeVisible();
  const spacing = await emptyState.evaluate((element) => {
    const copy = element.querySelector(".compare-results-empty__copy");
    const actions = element.querySelector(".compare-results-actions--centered");
    const root = getComputedStyle(document.documentElement);
    return {
      actionAlignment: getComputedStyle(actions).justifyContent,
      actionMargin: getComputedStyle(actions).marginTop,
      outerGap: getComputedStyle(element).rowGap,
      outerGapToken: root.getPropertyValue("--space-8").trim(),
      copyGap: getComputedStyle(copy).rowGap,
      copyGapToken: root.getPropertyValue("--space-3").trim(),
    };
  });

  expect(spacing.actionAlignment).toBe("center");
  expect(spacing.actionMargin).toBe("0px");
  expect(spacing.outerGap).toBe(spacing.outerGapToken);
  expect(spacing.copyGap).toBe(spacing.copyGapToken);
});

test("catalog layout has no stacked gap and child margins", async ({ page }) => {
  await markTourAsSeen(page);
  await clearCompareState(page);
  await page.goto("/index.html");
  await waitForUniversitiesReady(page);

  await expectNoStackedGapMargins(page, "#universitiesCatalogPane");
});

test("catalog level selector stays clear across themes and desktop/phone layouts", async ({ page }) => {
  for (const theme of ["light", "dark"]) {
    for (const viewport of [
      { name: "desktop", width: 1440, height: 900 },
      { name: "phone", width: 390, height: 844 },
    ]) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await markTourAsSeen(page);
      await clearCompareState(page);
      await page.addInitScript((nextTheme) => localStorage.setItem("unisearch_theme", nextTheme), theme);
      await page.goto("/index.html");
      await waitForUniversitiesReady(page);

      const colors = await page.evaluate(() => {
        const valueForToken = (token) => {
          const probe = document.createElement("div");
          probe.style.backgroundColor = `var(${token})`;
          document.body.append(probe);
          const value = getComputedStyle(probe).backgroundColor;
          probe.remove();
          return value;
        };
        return {
          theme: document.documentElement.dataset.theme,
          group: getComputedStyle(document.querySelector("#catalogLevelSegmented")).backgroundColor,
          groupSurface: valueForToken("--surface-soft"),
          active: getComputedStyle(document.querySelector(".catalog-level-btn.is-active")).backgroundColor,
          activeSurface: valueForToken("--surface-solid"),
        };
      });

      expect(colors.theme).toBe(theme);
      expect(colors.group).toBe(colors.groupSurface);
      expect(colors.active).toBe(colors.activeSurface);
      // shortcut: the checked-in baseline is Windows-only; add an OS capture before enabling Linux comparisons.
      if (process.platform === "win32") {
        await expect(page.locator("#catalogLevelSegmented")).toHaveScreenshot(`catalog-level-${theme}-${viewport.name}.png`, {
          animations: "disabled",
          caret: "hide",
        });
      }
    }
  }
});

test("catalog comparison mode navigates to the dedicated compare page", async ({ page }) => {
  await markTourAsSeen(page);
  await clearCompareState(page);

  await page.goto("/index.html");
  await waitForUniversitiesReady(page);
  const metricsMargins = await page.locator("#universitiesList .uni-metrics").evaluateAll((elements) =>
    elements.map((element) => getComputedStyle(element).marginTop)
  );
  expect(metricsMargins.length).toBeGreaterThan(0);
  expect(metricsMargins.every((margin) => margin === "0px")).toBe(true);
  await expect(page.locator("[data-universities-tab]")).toHaveCount(0);
  await expect(page.locator("#compareModeBtn")).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator("#universitiesList [data-card-action='compare']")).toHaveCount(0);

  await page.locator("#compareModeBtn").click();
  await expect(page).toHaveURL(/tab=compare/);
  await expect(page.locator("#compareModeBtn")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#compareModeLabel")).toHaveText("Compare mode");
  await expect(page.locator("#compareModeCancel")).toHaveCount(0);
  await expect(page.locator("#universitiesCatalogPane")).toBeVisible();
  await expect(page.locator("#qInput")).toHaveAttribute("placeholder", "Search university...");
  await expect(page.locator("#universitiesList [data-card-action='compare']")).toHaveCount(0);

  await page.locator("#compareModeBtn").click();
  await expect(page).not.toHaveURL(/tab=compare/);
  await expect(page.locator("#compareModeBtn")).toHaveAttribute("aria-pressed", "false");
  await page.locator("#compareModeBtn").click();
  await expect(page).toHaveURL(/tab=compare/);
  await expect(page.locator("#universitiesCatalogPane")).toBeVisible();

  const mitCard = page.locator(`#universitiesList .uni-card[data-uni-id="${MIT_ID}"]`).first();
  const imperialCard = page.locator(`#universitiesList .uni-card[data-uni-id="${IMPERIAL_ID}"]`).first();
  await expect(mitCard).toBeVisible();
  await expect(imperialCard).toBeVisible();
  await mitCard.click();
  await imperialCard.click();

  await expect(page.locator(".compare-tray")).toBeVisible();
  await expect(page.locator(".compare-tray__chip")).toHaveCount(2);
  await expect(page.locator("[data-action='open-compare']")).toBeEnabled();
  await page.locator("[data-action='open-compare']").click();

  // Navigates to dedicated compare page in configure stage
  await expect(page).toHaveURL(/compare(?:\.html)?\?.*ids=/);
  await expect(page.locator("body")).toHaveAttribute("data-page", "compare");
  await expect(page.locator("#compareResultsPane")).toBeVisible();

  // Verify configure stage is opened first
  await expect(page.locator(".compare-config-column")).toHaveCount(2);
  const configureColumns = page.locator(".compare-config-column");
  for (let index = 0; index < 2; index += 1) {
    await expect(configureColumns.nth(index).locator("[data-compare-context-form]")).toBeVisible();
    await expect(configureColumns.nth(index).locator('select[data-context-field="application_route_id"]')).toHaveValue("");
  }
  await expect(page.locator(".compare-config-chance .chance-panel")).toHaveCount(0);
  await expect(page.locator(".compare-config-subtitle")).toHaveText("Compare universities now, or choose a study option and application route to view applicable admissions facts.");
  const configureText = await page.locator("#compareResultsPane").textContent();
  expect(configureText).not.toMatch(/(?:Ð|Рќ|вЂ)/);

  // Click continue to go to results
  const continueCompareButton = page.locator("[data-action='build-compare-results']").first();
  await expect(continueCompareButton).toBeEnabled();
  await continueCompareButton.click();

  // Verify results view rendered on compare page
  await expect(page.locator(".compare-decision-support")).toBeVisible();
  await expect(page.locator(".compare-decision-theme")).toHaveCount(1);
  await expect(page.locator(".compare-decision-side")).toHaveCount(2);
  await expect(page.locator(".compare-uni-card")).toHaveCount(2);
  await expect(page.locator(".compare-table thead th")).toHaveCount(3);
  await expect(page.locator(".compare-tests")).toBeVisible();
  await expect(page.locator("#compareResultsPane")).toContainText("What matters for your choice");
  await expect(page.locator("#compareResultsPane")).toContainText("Tests and characteristics");

  // Navigate back to tracks from results
  await page.locator("[data-action='back-to-tracks']").click();
  await expect(page.locator(".compare-config-panel")).toBeVisible();

  // Navigate back to catalog compare selection
  await page.locator("[data-action='back-to-catalog']").click();
  await expect(page).toHaveURL(/tab=compare/);
  await expect(page.locator("#universitiesCatalogPane")).toBeVisible();
  await expect(page.locator(".compare-tray")).toBeVisible();
  await expect(page.locator("#universitiesList .uni-card--compare-selected[aria-selected='true']")).toHaveCount(2);
});

test("compare mode keeps exactly two universities and shows tray after client route", async ({ page }) => {
  await markTourAsSeen(page);
  await page.addInitScript(({ mitId, imperialId }) => {
    localStorage.removeItem("unisearch_compare_admission_choices_v1");
    localStorage.setItem("unisearch_compare_university_ids_v1", JSON.stringify([
      mitId,
      imperialId,
    ]));
  }, { mitId: MIT_ID, imperialId: IMPERIAL_ID });

  await page.goto("/index.html");
  await waitForUniversitiesReady(page);
  await page.locator("#compareModeBtn").click();

  await expect(page.locator(".compare-tray")).toBeVisible();
  await expect(page.locator(".compare-tray__chip")).toHaveCount(2);
  await expect(page.locator("[data-action='open-compare']")).toBeEnabled();

  const cards = page.locator("#universitiesList .uni-card:not(.is-skeleton)");
  await expect(cards.nth(2)).toBeVisible();
  await cards.nth(2).click();

  await expect(page.locator("#universitiesList .uni-card--compare-selected[aria-selected='true']")).toHaveCount(2);
  await expect.poll(async () => page.evaluate(() =>
    JSON.parse(localStorage.getItem("unisearch_compare_university_ids_v1") || "[]").length
  )).toBe(2);
});

test("selected comparison cards keep a compact localized status at desktop and mobile widths", async ({ page }) => {
  await markTourAsSeen(page);

  for (const { language, compareLabel, selectedLabel } of [
    { language: "eng", compareLabel: "Compare", selectedLabel: "Selected" },
    { language: "rus", compareLabel: "Сравнить", selectedLabel: "Выбрано" },
  ]) {
    for (const viewport of [
      { width: 1280, height: 800 },
      { width: 320, height: 568 },
    ]) {
      await clearCompareState(page, language);
      await page.setViewportSize(viewport);
      await page.goto(`/index.html?lang=${language}&tab=compare`);
      await waitForUniversitiesReady(page);
      const compareModeButton = page.locator("#compareModeBtn");
      await expect(compareModeButton).toBeVisible();
      await expect(page.locator("#compareModeBtn")).toHaveAttribute("aria-pressed", "true");

      const card = page.locator(`#universitiesList .uni-card[data-uni-id="${MIT_ID}"]`).first();
      await expect(card).toBeVisible();
      await expect(card.locator(".uni-details")).toHaveText(`${compareLabel}→`);
      await card.click();
      await expect(card).toHaveClass(/uni-card--compare-selected/);
      await expect(card.locator(".uni-details")).toHaveText(`${selectedLabel}→`);
      await expect(card.locator(".uni-details")).not.toContainText("for comparison");
      await expect(card.locator(".uni-details")).not.toContainText("для сравнения");

      const layout = await card.evaluate((element) => {
        const footer = element.querySelector(".uni-footer");
        const details = element.querySelector(".uni-details");
        const footerBox = footer.getBoundingClientRect();
        const detailsBox = details.getBoundingClientRect();
        return {
          footerFitsCard: footerBox.right <= element.getBoundingClientRect().right + 1,
          detailsFitsFooter: detailsBox.right <= footerBox.right + 1,
        };
      });
      expect(layout.footerFitsCard).toBe(true);
      expect(layout.detailsFitsFooter).toBe(true);
    }
  }
});

test("Oxford and Harvard comparison explains scope, aid, and missing personal evidence without a universal winner", async ({ page }) => {
  await markTourAsSeen(page);

  for (const [language, title, incomparable, harvardRate] of [
    ["eng", "What matters for your choice", "Not directly comparable", "4.18%"],
    ["rus", "Что важно для вашего выбора", "Нельзя сравнить напрямую", "4,18%"],
  ]) {
    await page.addInitScript((nextLanguage) => {
      localStorage.setItem("unisearch_ui_language_v1", nextLanguage);
      localStorage.setItem("unisearch_compare_university_ids_v1", JSON.stringify([
        "university-of-oxford-uk-oxford",
        "harvard-usa-cambridge",
      ]));
      localStorage.removeItem("unisearch_profile");
    }, language);
    await page.goto(`/compare.html?ids=${OXFORD_ID},${HARVARD_ID}&choices=university_of_oxford_uk_oxford_computer_science_undergraduate::university-of-oxford-uk-oxford_a_level::university-of-oxford-uk-oxford_a_level,harvard_college::harvard_college::harvard_college`);

    const support = page.locator(".compare-decision-support");
    await expect(support).toBeVisible();
    await expect(support).toContainText(title);
    const admissions = support.locator(".compare-decision-theme[data-theme-key='admissions']");
    await expect(admissions).toContainText("7%");
    await expect(admissions).toContainText(harvardRate);
    await expect(admissions).toContainText(incomparable);
    await expect(admissions.locator(".compare-decision-source a")).toHaveCount(2);
    await expect(support).not.toContainText(/Higher rank|Oxford is better|Оксфорд лучше/);
    await expect(support).not.toContainText("0%");

    const finance = support.locator(".compare-decision-theme[data-theme-key='finance']");
    await expect(finance.locator(".compare-decision-source a")).toHaveCount(3);
    await expect(finance).toContainText(/Need-based|По финансовой потребности/);

    const academic = support.locator(".compare-decision-theme[data-theme-key='academics']");
    await expect(academic).toContainText("#4");
    await expect(academic).toContainText("#5");
    await expect(academic).not.toContainText(/Comparable advantage|Сопоставимое преимущество/);
  }
});

test("compare configuration requires two explicit reviewed contexts and persists each independently", async ({ page }) => {
  await markTourAsSeen(page);
  await clearCompareState(page);
  await page.addInitScript(() => {
    localStorage.setItem("unisearch_ui_language_v1", "eng");
  });

  await page.goto("/compare.html?lang=eng&stage=configure&ids=mit-usa-cambridge,imperial-college-london-uk");
  await expect(page.locator("body")).toHaveAttribute("data-page", "compare");
  await expect(page.locator(".compare-config-column")).toHaveCount(2);
  const optionalContext = "Compare universities now, or choose a study option and application route to view applicable admissions facts.";
  await expect(page.locator(".compare-config-subtitle")).toHaveText(optionalContext);
  await expect(page.getByText(optionalContext, { exact: true })).toHaveCount(1);
  await expect(page.locator(".compare-config-column__status")).toHaveCount(0);

  const mitColumn = page.locator(".compare-config-column", { hasText: "Massachusetts Institute of Technology" });
  await expect(mitColumn.locator(".admissions-context__note")).toHaveText("Reviewed study and admissions catalog");
  await expect(mitColumn).not.toContainText("SAT: 1550");
  await chooseReviewedContext(page, MIT_ID, "Computer Science and Engineering", "mit-course-6-3-bachelor", "mit-first-year", "Fall 2027 entry");
  await chooseReviewedContext(page, IMPERIAL_ID, "Computing", "imperial-option-computing-meng", "procedure-computing-meng", "2027 entry");
  await page.locator('[data-action="build-compare-results"]').click();
  await expect(page.locator(".compare-table")).toBeVisible();
  const studyModeRow = page.locator(".compare-table tbody tr").filter({ hasText: "Study mode" });
  await expect(studyModeRow).toHaveCount(1);
  await expect(studyModeRow).toContainText("Not specified");
  await expect(studyModeRow).not.toContainText("not_stated");
  await expect(page.locator(`[data-reviewed-context="${MIT_ID}"] [data-admissions-fact="ug-sat-act-presence"]`)).toBeVisible();
  await expect(page.locator(`[data-reviewed-context="${IMPERIAL_ID}"] [data-admissions-fact="imperial-computing-meng-admission"]`)).toBeVisible();
  await page.reload();
  await expect(page.locator(`[data-reviewed-context="${MIT_ID}"] .admissions-context__summary`)).toContainText("Fall 2027 entry");
  await expect(page.locator(`[data-reviewed-context="${IMPERIAL_ID}"] .admissions-context__summary`)).toContainText("2027 entry");
});

test("reviewed comparison keeps MIT institutional tests separate from Imperial course requirements", async ({ page }) => {
  await markTourAsSeen(page);
  await clearCompareState(page);
  await page.addInitScript(() => {
    localStorage.setItem("unisearch_ui_language_v1", "eng");
  });

  await seedReviewedContexts(page);
  await page.goto(`/compare.html?lang=eng&ids=${MIT_ID},${IMPERIAL_ID}`);
  const mit = page.locator(`[data-reviewed-context="${MIT_ID}"]`);
  const imperial = page.locator(`[data-reviewed-context="${IMPERIAL_ID}"]`);
  const mitTest = mit.locator('[data-admissions-fact="ug-sat-act-presence"]');
  await expect(mitTest).toBeVisible();
  await mitTest.locator("summary").click();
  await expect(mitTest).toContainText(/SAT.*ACT|ACT.*SAT/i);
  await expect(mitTest.locator('a[href*="mitadmissions.org"]')).not.toHaveCount(0);
  const course = imperial.locator('[data-admissions-fact="imperial-computing-meng-admission"]');
  await expect(course).toBeVisible();
  await course.locator("summary").click();
  await expect(course).toContainText("TMUA");
  await expect(course.locator('a[href*="imperial.ac.uk"]')).not.toHaveCount(0);
  await expect(mit.locator('[data-admissions-fact="imperial-computing-meng-admission"]')).toHaveCount(0);
  await expect(imperial.locator('[data-admissions-fact="ug-sat-act-presence"]')).toHaveCount(0);
  await expect(mit).toContainText("No requirements-match percentage is available");
  await expect(imperial).toContainText("No requirements-match percentage is available");
  await expect(page.locator(".compare-table")).not.toContainText(/1,450|1,550/);
});

test("compare deep link IDs override stale selection while old reviewed pointers cannot override canonical profile context", async ({ page }) => {
  await markTourAsSeen(page);
  await page.addInitScript(() => {
    localStorage.setItem("unisearch_compare_university_ids_v1", JSON.stringify([
      "abai-kazakh-national-pedagogical-university-kaz-almaty",
      "al-farabi-kazakh-national-university-kaz-almaty",
    ]));
    localStorage.setItem("unisearch_compare_admission_choices_v1", JSON.stringify({
      "abai-kazakh-national-pedagogical-university-kaz-almaty": { choiceKey: "abai_kaznpu_unt::abai_kaznpu_unt::abai_kaznpu_unt_paid" },
      "al-farabi-kazakh-national-university-kaz-almaty": { choiceKey: "kaznu_unt::kaznu_unt::kaznu_unt_paid" },
    }));
  });
  await seedReviewedContexts(page);

  await page.goto("/compare.html?lang=eng&ids=mit-usa-cambridge,imperial-college-london-uk&choices=mit_regular::mit_regular::mit_regular,imperial_eng::imperial_sat::imperial_sat");
  await expect(page.locator(".compare-table")).toBeVisible();
  await expect(page.locator(".compare-uni-card")).toContainText([
    "Massachusetts Institute of Technology",
    "Imperial College London",
  ]);
  await expect(page.locator(".compare-uni-card")).not.toContainText(["Abai"]);
  await expect(page.locator(`[data-reviewed-context="${MIT_ID}"] .admissions-context__summary`)).toContainText("Computer Science and Engineering");
  await expect(page.locator(`[data-reviewed-context="${MIT_ID}"] .admissions-context__summary`)).not.toContainText("mit_regular");
});

test("compare results count localized bachelor programs in Russian", async ({ page }) => {
  await markTourAsSeen(page);
  await clearCompareState(page);
  await page.addInitScript(() => {
    localStorage.setItem("unisearch_ui_language_v1", "rus");
  });

  await page.goto("/compare.html?lang=rus&ids=abai-kazakh-national-pedagogical-university-kaz-almaty,al-farabi-kazakh-national-university-kaz-almaty&choices=abai_kaznpu_unt::abai_kaznpu_unt::abai_kaznpu_unt_paid,kaznu_unt::kaznu_unt::kaznu_unt_paid");
  const programRow = page.locator(".compare-table tbody tr", { hasText: "Бакалаврские программы" });
  await expect(programRow).toBeVisible();
  const rowText = await programRow.textContent();
  expect(rowText).not.toMatch(/Бакалаврские программы\s*0\s*0/);
  expect(rowText).toMatch(/[1-9]/);

  const table = page.locator(".compare-table");
  await expect(table).not.toContainText("Official Aggregated");
  await expect(table).not.toContainText("Official");
  await expect(table).toContainText("Официальный источник");
});

test("compare rework: diff toggle, neutral rows, and reviewed context controls", async ({ page }) => {
  await markTourAsSeen(page);
  await seedReviewedContexts(page);
  await page.goto(`/university.html?id=${MIT_ID}`);
  await page.evaluate(() => {
    localStorage.setItem("unisearch_ui_language_v1", "eng");
    localStorage.setItem("unisearch_compare_university_ids_v1", JSON.stringify(["mit-usa-cambridge"]));
    localStorage.removeItem("unisearch_compare_admission_choices_v1");
  });
  await page.reload();

  // 1. Ensure detail page does not have compare button
  await expect(page.locator("#detailCompareBtn")).toHaveCount(0);

  // 2. Open comparison in catalog
  await page.goto("/index.html?tab=compare");
  const tray = page.locator(".compare-tray");
  await expect(tray).toBeVisible();
  const removeBtn = page.locator(".compare-tray__chip-remove").first();
  await expect(removeBtn).toBeVisible();
  await removeBtn.click();
  await expect.poll(async () => page.evaluate(() =>
    JSON.parse(localStorage.getItem("unisearch_compare_university_ids_v1") || "[]").length
  )).toBe(0);

  // 3. Open compare page with 2 universities
  await page.goto(`/compare.html?lang=eng&ids=${MIT_ID},${IMPERIAL_ID}&choices=mit_regular::mit_regular::mit_regular,imperial_eng::imperial_sat::imperial_sat`);

  // 4. Informational ranks and program volume do not declare a winner
  await expect(page.locator("tr[data-row-section='overview'] .compare-cell--best")).toHaveCount(0);
  await expect(page.locator("tr[data-row-section='programs'] .compare-cell--best")).toHaveCount(0);

  // 5. Verify programs row does not contain raw university IDs and has human-readable content
  const programRow = page.locator("[data-reviewed-context] .admissions-context__summary");
  await expect(programRow).toHaveCount(2);
  const rowText = (await programRow.allInnerTexts()).join(" ");
  expect(rowText).not.toContain("mit-usa-cambridge");
  expect(rowText).not.toContain("imperial-college-london-uk");

  // 6. Verify track switcher
  await expect(page.locator("[data-reviewed-context]")).toHaveCount(2);
  await page.locator('[data-action="back-to-tracks"]').click();
  await expect(page.locator(`#compare-options-${MIT_ID} select[data-context-field="application_route_id"]`)).toHaveValue("mit-first-year");
  await expect(page.locator(`#compare-options-${IMPERIAL_ID} select[data-context-field="application_route_id"]`)).toHaveValue("procedure-computing-meng");
  await page.locator('[data-action="build-compare-results"]').click();

  // 7. Verify diff-only toggle
  const diffToggle = page.locator(".compare-diff-toggle");
  await expect(diffToggle).toBeVisible();
  await expect(page.locator(".compare-table-wrap")).not.toHaveClass(/is-diff-only/);
  await diffToggle.click();
  await expect(page.locator(".compare-table-wrap")).toHaveClass(/is-diff-only/);
  await diffToggle.click();
  await expect(page.locator(".compare-table-wrap")).not.toHaveClass(/is-diff-only/);

  // 8. Verify neutral decision-support themes and paired evidence
  await expect(page.locator(".compare-decision-theme")).toHaveCount(1);
  await expect(page.locator(".compare-decision-side")).toHaveCount(2);
  await expect(page.locator(".compare-decision-status").first()).toBeVisible();
  await expect(page.locator(".compare-overview, .compare-conclusion, .compare-key-differences")).toHaveCount(0);
});

test("dedicated compare page keeps navbar controls on the right, hides catalog controls, and renders action in single line", async ({ page }) => {
  await markTourAsSeen(page);
  await clearCompareState(page);

  await page.goto(`/compare.html?lang=eng&ids=${MIT_ID},${IMPERIAL_ID}`);
  await expect(page.locator("body")).toHaveAttribute("data-page", "compare");

  // Navbar right actions stay on the right side
  const navRight = page.locator(".navbar-right");
  await expect(navRight).toBeVisible();
  const navRightBox = await navRight.boundingBox();
  const viewportSize = page.viewportSize();
  expect(navRightBox.x + navRightBox.width).toBeGreaterThan(viewportSize.width * 0.75);

  // Catalog controls are not present; the redesigned navbar keeps search visible.
  await expect(page.locator(".u-section-bar")).toHaveCount(0);
  await expect(page.locator("#totalCount")).toHaveCount(0);
  await expect(page.locator("#universitySearch")).toBeVisible();

  // Back to tracks button is rendered in a single line (nowrap, inline-flex)
  const backBtn = page.locator("[data-action='back-to-tracks']");
  await expect(backBtn).toBeVisible();
  const isNowrap = await backBtn.evaluate((el) => window.getComputedStyle(el).whiteSpace === "nowrap");
  expect(isNowrap).toBe(true);

  // Share and change-tracks buttons in header are removed
  await expect(page.locator("[data-action='share-compare']")).toHaveCount(0);
  await expect(page.locator("[data-action='change-tracks']")).toHaveCount(0);

  // Navigate back to tracks, then back to catalog
  await backBtn.click();
  await expect(page.locator(".compare-config-panel")).toBeVisible();
  await page.locator("[data-action='back-to-catalog']").click();
  await expect(page).toHaveURL(/tab=compare/);
});

test("global rank sort reorders catalog by rank and displays rank tooltip with verification details", async ({ page }) => {
  await markTourAsSeen(page);
  await clearCompareState(page);

  await page.goto("/index.html");
  await expect(page.locator("#universitiesList .uni-card:not(.is-skeleton)").first()).toBeVisible();

  // 1. Select Global Rank sort mode
  await setNativeSelect(page, "sortSelect", "rank_asc");
  await expect(page).toHaveURL(/sort=rank_asc/);

  // 2. Wait for sorted list to render; MIT (#1) should be first
  const firstCard = page.locator("#universitiesList .uni-card:not(.is-skeleton)").first();
  await expect(firstCard).toBeVisible();
  await expect(firstCard.locator(".uni-title")).toContainText("Massachusetts Institute of Technology");

  // 3. Verify rank badge displays #1 and tooltip contains verification info
  const rankMetric = firstCard.locator(".uni-metric--rank");
  await expect(rankMetric).toBeVisible();
  await expect(rankMetric).toContainText("#1");
  const rankTooltip = firstCard.locator(".uni-metric-tooltip__content");
  await expect(rankTooltip).not.toBeVisible();

  // 4. Click on the rank metric to toggle verification tooltip open and closed
  await rankMetric.click();
  await expect(rankTooltip).toBeVisible();
  const tooltipText = await rankTooltip.innerText();
  expect(tooltipText).toContain("QS World University Rankings 2026");
  expect(tooltipText).toContain("Official ranking");

  await rankMetric.click();
  await expect(rankTooltip).not.toBeVisible();

  // 5. Clicking card navigates to university detail page
  await firstCard.locator(".uni-card-link-overlay").click();
  await expect(page).toHaveURL(/university\.html\?.*id=mit-usa-cambridge/);
});

test("toggling compare selection mode does not trigger additional network fetches when catalog is already loaded", async ({ page }) => {
  await markTourAsSeen(page);
  await clearCompareState(page);

  await page.goto("/index.html");
  await expect(page.locator("#universitiesList .uni-card:not(.is-skeleton)").first()).toBeVisible();

  let universityFetchCount = 0;
  page.on("request", (request) => {
    if (request.url().includes("/api/universities") || request.url().includes("/universities/ai-sort")) {
      universityFetchCount++;
    }
  });

  // Toggle compare mode ON
  await page.locator("#compareModeBtn").click();
  await expect(page.locator("#compareModeBtn")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("body")).toHaveClass(/universities-compare-mode/);

  // Toggle compare mode OFF
  await page.locator("#compareModeBtn").click();
  await expect(page.locator("#compareModeBtn")).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator("body")).not.toHaveClass(/universities-compare-mode/);

  expect(universityFetchCount).toBe(0);
});

