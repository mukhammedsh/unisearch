const { test, expect } = require("@playwright/test");
const { markTourAsSeen } = require("./helpers/personas");

const MIT_ID = "mit-usa-cambridge";
const IMPERIAL_ID = "imperial-college-london-uk";

async function clearCompareState(page) {
  await page.addInitScript(() => {
    localStorage.setItem("unisearch_ui_language_v1", "eng");
    localStorage.removeItem("unisearch_compare_university_ids_v1");
    localStorage.removeItem("unisearch_compare_admission_choices_v1");
    localStorage.removeItem("unisearch_filters");
    localStorage.removeItem("unisearch_profile");
    localStorage.removeItem("unisearch_detail_cache_v3");
  });
}

test("universities tabs host ranking and comparison results in one workspace", async ({ page }) => {
  await markTourAsSeen(page);
  await clearCompareState(page);

  await page.goto("/universities.html?tab=ranking");
  await expect(page.locator('[data-universities-tab="ranking"]')).toHaveClass(/is-active/);
  await expect(page.locator("#universitiesRankingPane")).toBeVisible();
  await expect(page.locator("#rankingList .rank-card").first()).toBeVisible();

  await page.locator('[data-universities-tab="catalog"]').click();
  await expect(page.locator("#universitiesList .uni-card").first()).toBeVisible();
  await expect(page.locator("#universitiesList [data-card-action='compare']")).toHaveCount(0);

  await page.locator('[data-universities-tab="compare"]').click();
  await expect(page).toHaveURL(/tab=compare/);
  await expect(page.locator('[data-universities-tab="compare"]')).toHaveClass(/is-active/);
  await expect(page.locator("#universitiesCatalogPane")).toBeVisible();

  const mitCard = page.locator(`#universitiesList .uni-card[data-uni-id="${MIT_ID}"]`).first();
  const imperialCard = page.locator(`#universitiesList .uni-card[data-uni-id="${IMPERIAL_ID}"]`).first();
  await expect(mitCard).toBeVisible();
  await expect(imperialCard).toBeVisible();
  await mitCard.click();
  await imperialCard.click();

  await expect(page.locator(".compare-tray")).toBeVisible();
  await expect(page.locator(".compare-tray__slot")).toHaveCount(2);
  await expect(page.locator(".compare-tray")).toContainText("Comparison pair is ready");
  await expect(page.locator("[data-action='open-compare']")).toBeEnabled();
  await page.locator("[data-action='open-compare']").click();

  await expect(page).toHaveURL(/tab=compare/);
  await expect(page).toHaveURL(/compare=configure/);
  await expect(page.locator("#compareResultsPane")).toBeVisible();
  await expect(page.locator(".compare-config-column")).toHaveCount(2);
  await expect(page.locator(".compare-config-column .track-select-btn.is-active")).toHaveCount(2);
  await expect(page.locator(".compare-config-chance .chance-panel")).toHaveCount(2);
  await expect(page.locator(".compare-track-chance").first()).toBeVisible();
  await expect(page.locator(".track-stats-title--avg .track-stats-chance")).toHaveCount(0);
  await expect(page.locator("#compareResultsPane")).toContainText("UniChance");
  const configureText = await page.locator("#compareResultsPane").textContent();
  expect(configureText).not.toMatch(/(?:Ð|Рќ|вЂ)/);
  await expect(page).toHaveURL(/choices=/);
  const continueCompareButton = page.locator("[data-action='build-compare-results']").first();
  await expect(continueCompareButton).toBeEnabled();
  const configureCanScroll = await page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight + 4);
  let configureScrolled = false;
  if (configureCanScroll) {
    await page.evaluate(() => { window.scrollTo(0, document.documentElement.scrollHeight); });
    const scrollY = await page.evaluate(() => window.scrollY);
    configureScrolled = scrollY > 0;
  }
  await continueCompareButton.click();
  await expect(page).toHaveURL(/compare=results/);
  if (configureScrolled) {
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(2);
  }
  await expect(page.locator(".compare-key-differences")).toBeVisible();
  await expect(page.locator(".compare-reason-group")).toHaveCount(2);
  await expect(page.locator(".compare-uni-card")).toHaveCount(2);
  await expect(page.locator(".compare-uni-card [data-action='remove-compare-result']")).toHaveCount(0);
  await expect(page.locator(".compare-table thead th")).toHaveCount(3);
  await expect(page.locator(".compare-overview")).toBeVisible();
  await expect(page.locator(".compare-tests")).toBeVisible();
  await expect(page.locator("#compareResultsPane")).toContainText("Key differences");
  await expect(page.locator("#compareResultsPane")).toContainText("Tests and characteristics");

  await page.locator("[data-action='back-to-compare-select']").click();
  await expect(page).toHaveURL(/compare=select/);
  await expect(page.locator("#universitiesCatalogPane")).toBeVisible();
  await expect(page.locator(".compare-tray")).toBeVisible();
  await expect(page.locator("#universitiesList [data-card-action='compare'][aria-pressed='true']")).toHaveCount(2);
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
  await page.locator('[data-link="universities"]').click();
  await expect(page).toHaveURL(/universities/);
  await page.locator('[data-universities-tab="compare"]').click();

  await expect(page.locator(".compare-tray")).toBeVisible();
  await expect(page.locator(".compare-tray__slot")).toHaveCount(2);
  await expect(page.locator("[data-action='open-compare']")).toBeEnabled();

  const cards = page.locator("#universitiesList .uni-card:not(.is-skeleton)");
  await expect(cards.nth(2)).toBeVisible();
  await cards.nth(2).click();

  await expect(page.locator("#universitiesList [data-card-action='compare'][aria-pressed='true']")).toHaveCount(2);
  await expect.poll(async () => page.evaluate(() =>
    JSON.parse(localStorage.getItem("unisearch_compare_university_ids_v1") || "[]").length
  )).toBe(2);
});

test("compare configure cards expose admission requirements before continuing", async ({ page }) => {
  await markTourAsSeen(page);
  await clearCompareState(page);
  await page.addInitScript(() => {
    localStorage.setItem("unisearch_ui_language_v1", "eng");
  });

  await page.goto("/universities.html?lang=eng&tab=compare&compare=configure&ids=mit-usa-cambridge,imperial-college-london-uk");
  await expect(page.locator(".compare-config-column")).toHaveCount(2);

  const mitColumn = page.locator(".compare-config-column", { hasText: "Massachusetts Institute of Technology" });
  await expect(mitColumn).toContainText("Academic minimums");
  await expect(mitColumn).toContainText("SAT 1500");
  await expect(mitColumn).toContainText("GPA 98");
  await expect(mitColumn).toContainText("SAT median 1,550");
  await expect(mitColumn).toContainText("IELTS Academic 7.5");

  const imperialGrant = page.locator(".compare-config-column", { hasText: "Imperial College London" })
    .locator(".admission-option-card--grant");
  await expect(imperialGrant).toContainText("Funding-specific requirements");
  await expect(imperialGrant).toContainText("GPA 98");
  await expect(imperialGrant).toContainText("standard 92");
});

test("compare results split admission decision rows", async ({ page }) => {
  await markTourAsSeen(page);
  await clearCompareState(page);
  await page.addInitScript(() => {
    localStorage.setItem("unisearch_ui_language_v1", "eng");
  });

  await page.goto("/universities.html?lang=eng&tab=compare&compare=configure&ids=mit-usa-cambridge,imperial-college-london-uk&choices=mit_regular::mit_regular::mit_regular,imperial_eng::imperial_eng::imperial_eng-grant-president-s-scholarship");
  await expect(page.locator(".compare-config-column")).toHaveCount(2);

  await page.locator("[data-action='build-compare-results']").click();
  await expect(page).toHaveURL(/compare=results/);
  const table = page.locator(".compare-table");
  await expect(table).toContainText("Selected route");
  await expect(table).toContainText("Academic minimums");
  await expect(table).toContainText("Admitted score context");
  await expect(table).toContainText("Funding-specific requirements");
  await expect(table).toContainText("Language proof");
  await expect(table).toContainText("Documents / interview / portfolio");
  await expect(table).toContainText("IELTS Listening language minimum");
  await expect(table).toContainText("GPA 98");
  await expect(table).toContainText("standard 92");
});

test("compare deep link ids and choices override stale localStorage", async ({ page }) => {
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

  await page.goto("/universities.html?lang=eng&tab=compare&compare=configure&ids=mit-usa-cambridge,imperial-college-london-uk&choices=mit_regular::mit_regular::mit_regular,imperial_eng::imperial_eng::imperial_eng");
  await expect(page.locator(".compare-config-column")).toHaveCount(2);
  await expect(page.locator("#compareResultsPane")).toContainText("Massachusetts Institute of Technology");
  await expect(page.locator("#compareResultsPane")).toContainText("Imperial College London");
  await expect(page.locator("#compareResultsPane")).not.toContainText("Abai");

  await page.locator("[data-action='build-compare-results']").click();
  await expect(page).toHaveURL(/compare=results/);
  await expect(page.locator(".compare-table")).toBeVisible();
  await expect(page.locator(".compare-uni-card")).toContainText([
    "Massachusetts Institute of Technology",
    "Imperial College London",
  ]);
});

test("compare results count localized bachelor programs in Russian", async ({ page }) => {
  await markTourAsSeen(page);
  await clearCompareState(page);
  await page.addInitScript(() => {
    localStorage.setItem("unisearch_ui_language_v1", "rus");
  });

  await page.goto("/universities.html?lang=rus&tab=compare&compare=configure&ids=abai-kazakh-national-pedagogical-university-kaz-almaty,al-farabi-kazakh-national-university-kaz-almaty&choices=abai_kaznpu_unt::abai_kaznpu_unt::abai_kaznpu_unt_paid,kaznu_unt::kaznu_unt::kaznu_unt_paid");
  await expect(page.locator(".compare-config-column")).toHaveCount(2);
  await expect(page.locator("#compareResultsPane")).toContainText("Лучший вариант");
  await expect(page.locator("#compareResultsPane")).not.toContainText("Best choice");

  await page.locator("[data-action='build-compare-results']").click();
  await expect(page).toHaveURL(/compare=results/);
  const programRow = page.locator(".compare-table tbody tr", { hasText: "Бакалаврские программы" });
  await expect(programRow).toBeVisible();
  const rowText = await programRow.textContent();
  expect(rowText).not.toMatch(/Бакалаврские программы\s*0\s*0/);
  expect(rowText).toMatch(/[1-9]/);
});
