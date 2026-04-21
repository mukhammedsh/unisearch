const { test, expect } = require("@playwright/test");
const { markTourAsSeen } = require("./helpers/personas");

async function clearCompareState(page) {
  await page.addInitScript(() => {
    localStorage.removeItem("unisearch_compare_university_ids_v1");
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
  await expect(page.locator("[data-action='open-compare']")).toBeEnabled();
  await page.locator("[data-action='open-compare']").click();

  await expect(page).toHaveURL(/tab=compare/);
  await expect(page).toHaveURL(/compare=results/);
  await expect(page.locator("#compareResultsPane")).toBeVisible();
  await expect(page.locator(".compare-key-differences")).toBeVisible();
  await expect(page.locator(".compare-reason-group")).toHaveCount(2);
  await expect(page.locator(".compare-overview")).toBeVisible();
  await expect(page.locator(".compare-tests")).toBeVisible();
  await expect(page.locator("#compareResultsPane")).toContainText("Key differences");
  await expect(page.locator("#compareResultsPane")).toContainText("Tests and characteristics");
});
