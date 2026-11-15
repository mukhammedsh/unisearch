const { test, expect } = require("./helpers/coverage-test.cjs");
const { markTourAsSeen } = require("./helpers/personas");
const { setNativeSelect } = require("./helpers/selectors");
const { expectNoStackedGapMargins } = require("./helpers/design");

const MIT_ID = "mit-usa-cambridge";
const IMPERIAL_ID = "imperial-college-london-uk";
const STANFORD_ID = "stanford-university-usa-ca";
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

const REVIEWED_IDS = [MIT_ID, IMPERIAL_ID, STANFORD_ID, "nazarbayev-university-kaz-astana"];
const LEGACY_PAIR = "ids=abai-kazakh-national-pedagogical-university-kaz-almaty,al-farabi-kazakh-national-university-kaz-almaty&choices=abai_kaznpu_unt::abai_kaznpu_unt::abai_kaznpu_unt_paid,kaznu_unt::kaznu_unt::kaznu_unt_paid";

async function waitForReviewedComparison(page) {
  await expect(page.locator("body")).toHaveAttribute("data-page", "compare");
  await expect(page.locator("[data-reviewed-comparison] .compare-reviewed__head")).toHaveCount(2);
  await expect(page.locator(".compare-reviewed__head[data-scope='loading']")).toHaveCount(0);
}

const savedChoice = (page, id) => page.evaluate((uid) => JSON.parse(localStorage.getItem("unisearch_profile") || "{}").selectedAdmissionChoices?.[uid], id);

// Chooses a program in a column's picker dialog; a program with several routes asks for the route in the same dialog.
async function pickProgram(page, id, { search, option, route = "", level = "" }) {
  await page.locator(`[data-compare-pick="${id}"]`).click();
  const dialog = page.locator("dialog.compare-picker[open]");
  await expect(dialog).toBeVisible();
  if (level) await dialog.locator(`[data-picker-level="${level}"]`).click();
  await dialog.locator("#comparePickerSearch").fill(search);
  await expect(dialog.locator("[data-picker-count]")).not.toBeEmpty();
  await dialog.locator(`[data-picker-option="${option}"]`).click();
  await expect.poll(async () => (await page.locator("dialog.compare-picker").count()) === 0
    || (await dialog.locator("[data-picker-route]").count()) > 0).toBe(true);
  if (await page.locator("dialog.compare-picker").count()) await dialog.locator(`[data-picker-route="${route}"]`).click();
  await expect(page.locator("dialog.compare-picker")).toHaveCount(0);
  await expect(page.locator(`.compare-reviewed__head[data-uni-id="${id}"]`)).toHaveAttribute("data-scope", "program");
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

test("spacing audit permits automatic alignment but rejects a fixed child margin", async ({ page }) => {
  await page.setContent('<main id="spacingProbe" style="display:flex;flex-direction:column;gap:12px;height:100px"><span style="margin-top:auto">Aligned content</span></main>');
  await expectNoStackedGapMargins(page, "#spacingProbe");
  await page.locator("#spacingProbe span").evaluate(element => { element.style.marginTop = "4px"; });
  await expect(expectNoStackedGapMargins(page, "#spacingProbe")).rejects.toThrow(/marginTop/);
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

      await expect(page.locator("#catalogLevelFilter .custom-select-trigger")).toBeVisible();
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
          control: getComputedStyle(document.querySelector("#catalogLevelFilter .custom-select-trigger")).backgroundColor,
          controlSurface: valueForToken("--surface-soft"),
        };
      });

      expect(colors.theme).toBe(theme);
      expect(colors.control).toBe(colors.controlSurface);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
      // shortcut: the checked-in baseline is Windows-only; add an OS capture before enabling Linux comparisons.
      if (process.platform === "win32") {
        await expect(page.locator("#catalogLevelFilter")).toHaveScreenshot(`catalog-level-${theme}-${viewport.name}.png`, {
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

  // A pair of rechecked universities opens its one-stage comparison directly.
  await expect(page).toHaveURL(/compare(?:\.html)?\?.*ids=/);
  await expect(page).not.toHaveURL(/stage=configure/);
  await waitForReviewedComparison(page);
  await expect(page.locator(".compare-config-panel, .compare-decision-support, .compare-tests")).toHaveCount(0);
  for (const section of ["admission", "cost", "university"]) {
    await expect(page.locator(`[data-compare-section="${section}"]`)).toBeVisible();
  }
  await expect(page.locator(`.compare-reviewed__head[data-uni-id="${MIT_ID}"]`)).toHaveAttribute("data-scope", "institution");
  await expect(page.locator(`.compare-reviewed__head[data-uni-id="${IMPERIAL_ID}"]`)).toHaveAttribute("data-scope", "choose");
  const resultsText = await page.locator("#compareResultsPane").textContent();
  expect(resultsText).not.toMatch(/(?:Ð|Рќ|вЂ)/);

  // Navigate back to catalog compare selection
  await page.locator("[data-action='back-to-catalog']").click();
  await expect(page).toHaveURL(/tab=compare/);
  await expect(page.locator("#universitiesCatalogPane")).toBeVisible();
  await expect(page.locator(".compare-tray")).toBeVisible();
  await expect(page.locator("#universitiesList .uni-card--compare-selected[aria-selected='true']")).toHaveCount(2);
});

test("catalog keeps a comparison pair within one data group", async ({ page }) => {
  await markTourAsSeen(page);
  await clearCompareState(page);
  await page.goto("/index.html?tab=compare");
  await waitForUniversitiesReady(page);

  const mitCard = page.locator(`#universitiesList .uni-card[data-uni-id="${MIT_ID}"]`).first();
  await mitCard.click();
  await expect(page.locator(".compare-tray__chip")).toHaveCount(1);
  // Any earlier-format card on the first page; the four rechecked universities are excluded by id.
  const legacyCard = page.locator(`#universitiesList .uni-card:not(.is-skeleton)${REVIEWED_IDS.map(id => `:not([data-uni-id="${id}"])`).join("")}`).first();
  await expect(legacyCard).toBeVisible();
  await expect(legacyCard).toHaveClass(/uni-card--compare-unavailable/);
  await expect(legacyCard.locator(".uni-details")).toHaveText("Not for this pair");
  await legacyCard.click();
  await expect(page.locator(".compare-tray__chip")).toHaveCount(1);
  await expect(page.locator(".compare-tray__note")).toContainText("this data isn't rechecked yet, while the pair has a university with rechecked data");
  await expect(page.locator(`#universitiesList .uni-card[data-uni-id="${IMPERIAL_ID}"]`).first()).not.toHaveClass(/uni-card--compare-unavailable/);

  // Removing the rechecked university frees the earlier-format one.
  await page.locator(".compare-tray__chip-remove").click();
  await expect(legacyCard).not.toHaveClass(/uni-card--compare-unavailable/);
  await legacyCard.click();
  await expect(page.locator(".compare-tray__chip")).toHaveCount(1);
  await expect(page.locator(".compare-tray__note")).toHaveCount(0);
  await expect(mitCard).toHaveClass(/uni-card--compare-unavailable/);
});

test("a mixed pair from an old link explains why it is not compared", async ({ page }) => {
  await markTourAsSeen(page);
  await clearCompareState(page);
  // A pair stored before the groups were separated reaches the comparison page as it was saved.
  await page.addInitScript(({ mit, oxford }) => localStorage.setItem("unisearch_compare_university_ids_v1", JSON.stringify([mit, oxford])), { mit: MIT_ID, oxford: OXFORD_ID });
  await page.goto(`/compare.html?lang=eng&ids=${MIT_ID},${OXFORD_ID}`);
  const mixed = page.locator("[data-compare-mixed]");
  await expect(mixed).toBeVisible();
  await expect(mixed.locator("h1")).toHaveText("These two universities can't be compared yet");
  await expect(mixed.locator(".compare-mixed__item")).toHaveCount(2);
  await expect(mixed.locator(`.compare-mixed__item[data-uni-id="${MIT_ID}"]`)).toContainText("Data rechecked");
  await expect(mixed.locator(`.compare-mixed__item[data-uni-id="${OXFORD_ID}"]`)).toContainText("Data not yet rechecked");
  await expect(page.locator(".compare-table, [data-reviewed-comparison]")).toHaveCount(0);
  await mixed.locator("[data-action='back-to-catalog']").click();
  await expect(page).toHaveURL(/tab=compare/);
  await expect(page.locator(".compare-tray__note")).toContainText("different data groups");
  await expect(page.locator("[data-action='open-compare']")).toBeDisabled();
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
      // Activate the card action; its center can contain an interactive ranking tooltip.
      await card.locator(".uni-card-link-overlay").press("Enter");
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

test("reviewed comparison opens on shared facts and saves a program chosen in each column", async ({ page }) => {
  await markTourAsSeen(page);
  await clearCompareState(page);
  await page.goto(`/compare.html?lang=eng&stage=configure&ids=${MIT_ID},${IMPERIAL_ID}`);
  await waitForReviewedComparison(page);
  // An older configure link opens the one-stage comparison.
  await expect(page).not.toHaveURL(/stage=configure/);
  const mitHead = page.locator(`.compare-reviewed__head[data-uni-id="${MIT_ID}"]`);
  await expect(mitHead).toContainText("First year, one shared application");
  await expect(page.locator('[data-compare-row="cost"] dd').nth(1)).toContainText("Depends on the program");
  expect(await savedChoice(page, MIT_ID)).toBeUndefined();

  await pickProgram(page, IMPERIAL_ID, { search: "Computing", option: "imperial-option-computing-meng", level: "undergraduate" });
  await expect.poll(() => savedChoice(page, IMPERIAL_ID)).toMatchObject({ studyOptionId: "imperial-option-computing-meng", applicationRouteId: "procedure-computing-meng" });
  // The applicant compares in their own currency: the published pound price is converted to the setting (USD by default).
  await expect(page.locator('[data-compare-row="cost"] dd').nth(1)).toContainText(/≈ \$[\d,]+/);
  await expect(page.locator('[data-compare-row="cost"] dd').nth(1)).not.toContainText("£");
  await expect(page.locator('[data-compare-row="route"] dd').nth(1)).toContainText("UCAS");
  await pickProgram(page, MIT_ID, { search: "Computer Science and Engineering", option: "mit-course-6-3-bachelor", route: "mit-first-year" });
  await expect.poll(() => savedChoice(page, MIT_ID)).toMatchObject({ studyOptionId: "mit-course-6-3-bachelor", applicationRouteId: "mit-first-year" });

  await page.evaluate(() => localStorage.setItem("unisearch_settings_cache_v1", JSON.stringify([
    { key: "preferred_currency", value: "KZT" }, { key: "currency_display_mode", value: "preferred" },
  ])));
  await page.reload();
  await waitForReviewedComparison(page);
  await expect(mitHead.locator(".compare-reviewed__scope-title")).toContainText("Computer Science and Engineering");
  await expect(page.locator(`.compare-reviewed__head[data-uni-id="${IMPERIAL_ID}"] .compare-reviewed__scope-meta`)).toContainText("MEng");
  // A different preferred currency converts both columns to it.
  await expect(page.locator('[data-compare-row="cost"] dd').nth(1)).toContainText("₸");
  await expect(page.locator('[data-compare-row="cost"] dd').nth(0)).toContainText("₸");
});

test("choosing the shared first year again clears a saved program", async ({ page }) => {
  await markTourAsSeen(page);
  await clearCompareState(page);
  await seedReviewedContexts(page);
  await page.goto(`/compare.html?lang=eng&ids=${MIT_ID},${STANFORD_ID}`);
  await waitForReviewedComparison(page);
  const mitHead = page.locator(`.compare-reviewed__head[data-uni-id="${MIT_ID}"]`);
  await expect(mitHead).toHaveAttribute("data-scope", "program");
  await page.locator(`[data-compare-pick="${MIT_ID}"]`).click();
  const dialog = page.locator("dialog.compare-picker[open]");
  await expect(dialog.locator(`[data-picker-option="mit-course-6-3-bachelor"]`)).toHaveAttribute("aria-current", "true");
  await dialog.locator("[data-picker-shared]").click();
  await expect(page.locator("dialog.compare-picker")).toHaveCount(0);
  await expect(mitHead).toHaveAttribute("data-scope", "institution");
  await expect.poll(() => savedChoice(page, MIT_ID)).toBeUndefined();
  const deadline = page.locator('[data-compare-row="deadline"] dd').first();
  await expect(deadline).not.toContainText("Depends on the program");
  await expect(deadline.locator("a")).toHaveAttribute("href", /admission_application_route=mit-first-year/);
});

test("reviewed comparison keeps current choices compact and route labels localized", async ({ page }) => {
  await markTourAsSeen(page);
  await clearCompareState(page, "rus");
  await seedReviewedContexts(page);
  await page.goto(`/compare.html?lang=rus&ids=${MIT_ID},${IMPERIAL_ID}`);
  await waitForReviewedComparison(page);

  const route = page.locator('[data-compare-row="route"] dd');
  await expect(route.nth(1)).toContainText("Выбор программы через UCAS");
  await expect(page.locator("[data-reviewed-comparison]")).not.toContainText("ucas_course_choice");
  await expect(page.locator("[data-reviewed-comparison]")).not.toContainText("MIT undergraduate admission");

  await page.locator(`[data-compare-pick="${IMPERIAL_ID}"]`).click();
  const programChoice = page.locator("dialog.compare-picker[open] .compare-picker__option").first();
  await expect(programChoice).toBeVisible();
  const style = await programChoice.evaluate(element => ({
    appearance: getComputedStyle(element).appearance,
    borderWidth: getComputedStyle(element).borderWidth,
  }));
  expect(style).toEqual({ appearance: "none", borderWidth: "0px" });
  await page.keyboard.press("Escape");
  await expect(page.locator("dialog.compare-picker")).toHaveCount(0);
  await expect(page.locator(`[data-compare-pick="${IMPERIAL_ID}"]`)).toBeFocused();
});

test("comparison keeps MIT institution-wide and Stanford CS graduate contexts independent", async ({ page }) => {
  await markTourAsSeen(page);
  await clearCompareState(page);
  await page.goto(`/compare.html?lang=eng&ids=${MIT_ID},${STANFORD_ID}`);
  await waitForReviewedComparison(page);
  await pickProgram(page, STANFORD_ID, { search: "Computer Science", option: "stanford-option-cs-ms", route: "directory-evidence:stanford-graduate-cs-ms", level: "masters" });
  await expect(page.locator(`.compare-reviewed__head[data-uni-id="${MIT_ID}"]`)).toContainText("First year, one shared application");
  await expect(page.locator(`.compare-reviewed__head[data-uni-id="${STANFORD_ID}"]`)).toContainText("Computer Science (MS)");
  const route = page.locator('[data-compare-row="route"] dd');
  await expect(route.nth(0)).toContainText("No program chosen");
  await expect(route.nth(1)).toContainText("Computer Science MS — external applicants");
  await expect(page.locator("[data-reviewed-comparison]")).not.toContainText("directory-evidence:stanford-graduate-cs-ms");
});

test("reviewed comparison keeps MIT institutional tests separate from Imperial course requirements", async ({ page }) => {
  await markTourAsSeen(page);
  await clearCompareState(page);
  await seedReviewedContexts(page);
  await page.goto(`/compare.html?lang=eng&ids=${MIT_ID},${IMPERIAL_ID}`);
  await waitForReviewedComparison(page);
  const needs = page.locator('[data-compare-row="needs"] dd');
  await expect(needs.nth(0)).toContainText(/SAT or ACT|ACT or SAT/);
  await expect(needs.nth(1)).not.toContainText(/SAT or ACT/);
  await expect(needs.nth(1).locator("a")).toHaveAttribute("href", /admission_option=imperial-option-computing-meng.*#tab-admission/);
  await expect(page.locator("[data-reviewed-comparison]")).not.toContainText(/1,450|1,550/);
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
  await waitForReviewedComparison(page);
  await expect(page.locator(".compare-reviewed__head .compare-reviewed__identity-text strong")).toHaveText([
    "Massachusetts Institute of Technology",
    "Imperial College London",
  ]);
  await expect(page.locator("[data-reviewed-comparison]")).not.toContainText("Abai");
  const mitScope = page.locator(`.compare-reviewed__head[data-uni-id="${MIT_ID}"] .compare-reviewed__scope`);
  await expect(mitScope).toContainText("Computer Science and Engineering");
  await expect(page.locator("[data-reviewed-comparison]")).not.toContainText("mit_regular");
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

test("compare rework: diff toggle, neutral rows, and track switcher", async ({ page }) => {
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

  // 3. Open an earlier-format pair: the diff toggle, track switcher and decision signals belong to that comparison.
  await page.goto(`/compare.html?lang=eng&${LEGACY_PAIR}`);

  // 4. Informational ranks and program volume do not declare a winner
  await expect(page.locator("tr[data-row-section='overview'] .compare-cell--best")).toHaveCount(0);
  await expect(page.locator("tr[data-row-section='programs'] .compare-cell--best")).toHaveCount(0);

  // 5. Verify the university cards do not show raw university IDs
  const cards = page.locator(".compare-uni-card");
  await expect(cards).toHaveCount(2);
  const cardText = (await cards.allInnerTexts()).join(" ");
  expect(cardText).not.toContain("abai-kazakh-national-pedagogical-university-kaz-almaty");
  expect(cardText).not.toContain("al-farabi-kazakh-national-university-kaz-almaty");

  // 6. Verify track switcher
  await page.locator('[data-action="back-to-tracks"]').click();
  await expect(page.locator(".compare-config-panel")).toBeVisible();
  await page.locator('[data-action="build-compare-results"]').click();

  // 7. Verify diff-only toggle
  const diffToggle = page.locator(".compare-diff-toggle");
  await expect(diffToggle).toBeVisible();
  await expect(page.locator(".compare-tests .compare-table-wrap")).not.toHaveClass(/is-diff-only/);
  await diffToggle.click();
  await expect(page.locator(".compare-tests .compare-table-wrap")).toHaveClass(/is-diff-only/);
  await diffToggle.click();
  await expect(page.locator(".compare-tests .compare-table-wrap")).not.toHaveClass(/is-diff-only/);

  // 8. Verify neutral decision-support themes and paired evidence
  await expect(page.locator(".compare-decision-theme").first()).toBeVisible();
  await expect(page.locator(".compare-decision-status").first()).toBeVisible();
  await expect(page.locator(".compare-overview, .compare-conclusion, .compare-key-differences")).toHaveCount(0);
});

test("dedicated compare page keeps navbar controls on the right, hides catalog controls, and renders action in single line", async ({ page }) => {
  await markTourAsSeen(page);
  await clearCompareState(page);

  await page.goto(`/compare.html?lang=eng&${LEGACY_PAIR}`);
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

