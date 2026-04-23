const { test, expect } = require("@playwright/test");
const { markTourAsSeen } = require("./helpers/personas");

async function clearCompareState(page) {
  await page.addInitScript(() => {
    localStorage.removeItem("unisearch_compare_university_ids_v1");
    localStorage.removeItem("unisearch_compare_admission_choices_v1");
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

  const cards = page.locator("#universitiesList .uni-card");
  await expect(cards.first()).toBeVisible();
  await cards.nth(0).click();
  await cards.nth(1).click();

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
  await expect(page).toHaveURL(/tracks=/);
  const continueCompareButton = page.locator("[data-action='build-compare-results']").first();
  await expect(continueCompareButton).toBeEnabled();
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.evaluate(() => { window.scrollTo(0, document.body.scrollHeight); });
  // The scroll might not occur if the screen is too tall to overflow
  await expect.poll(() => page.evaluate(() => window.scrollY || document.body.scrollHeight <= window.innerHeight)).toBeTruthy();
  await continueCompareButton.click();
  await expect(page).toHaveURL(/compare=results/);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(2);
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
  await page.addInitScript(() => {
    localStorage.removeItem("unisearch_compare_admission_choices_v1");
    localStorage.setItem("unisearch_compare_university_ids_v1", JSON.stringify([
      "mit-usa-cambridge",
      "imperial-college-london-uk",
    ]));
  });

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
