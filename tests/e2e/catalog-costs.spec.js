const { test, expect } = require("./helpers/coverage-test.cjs");
const { setNativeSelect } = require("./helpers/selectors");
const fs = require("node:fs");
const path = require("node:path");
const evidence = path.resolve(__dirname, "../../output/playwright/catalog-costs");

for (const item of [
  { language: "eng", width: 1280, theme: "light" },
  { language: "rus", width: 390, theme: "dark" },
  { language: "kaz", width: 390, theme: "light" },
]) {
  test(`catalog prices and filter basis in ${item.language}, ${item.width}px`, async ({ page }) => {
    await page.setViewportSize({ width: item.width, height: 900 });
    await page.addInitScript(item => {
      localStorage.setItem("unisearch_ui_language_v1", item.language);
      localStorage.setItem("unisearch_theme", item.theme);
      localStorage.setItem("unisearch_universities_tour_seen_v1", "1");
      localStorage.setItem("unisearch_settings_cache_v1", JSON.stringify([
        { key: "preferred_currency", value: "USD" }, { key: "currency_display_mode", value: "original" },
      ]));
    }, item);
    await page.goto("/index.html?q=MIT");
    await expect(page.locator("body")).toHaveAttribute("data-page", "universities");
    const card = page.locator('#universitiesList .uni-card[data-uni-id="mit-usa-cambridge"]');
    await expect(card).toBeVisible();
    await expect(card.locator('[data-cost-basis="annual_total"]')).toContainText(/92[\s,\u00a0]?760/);
    await expect(card.locator('[data-cost-basis="tuition"]')).toContainText(/66[\s,\u00a0]?720/);
    await expect(card).toContainText(/2026[‑-]2027/);
    await expect(page.locator("#costBasisSelect")).toHaveValue("annual_total");
    fs.mkdirSync(evidence, { recursive: true });
    await card.screenshot({ path: path.join(evidence, `${item.language}-${item.width}-card.png`) });

    await page.goto("/index.html?q=MIT&max_tuition=70000");
    await expect(page.locator("body")).toHaveAttribute("data-page", "universities");
    await expect(page.locator(".u-state-card--empty")).toBeVisible();
    await expect(card).toHaveCount(0);
    if (item.width <= 1024) await page.locator("#mobileFilterToggle").click();
    await setNativeSelect(page, "costBasisSelect", "tuition");
    if (item.width <= 1024) await page.locator("#mobileApplyFilters").click();
    await expect(card).toBeVisible();
    await expect(card.locator(".uni-cost-row").first()).toHaveAttribute("data-cost-basis", "tuition");
    await expect(page).toHaveURL(/cost_basis=tuition/);
    await page.reload();
    await expect(card).toBeVisible();
    await expect(page.locator("#costBasisSelect")).toHaveValue("tuition");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(item.width);
  });
}

test("Imperial tuition remains separate from an unavailable same-period full budget", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("unisearch_ui_language_v1", "eng");
    localStorage.setItem("unisearch_universities_tour_seen_v1", "1");
    localStorage.setItem("unisearch_settings_cache_v1", JSON.stringify([{ key: "currency_display_mode", value: "original" }]));
  });
  await page.goto("/index.html?q=Imperial&cost_basis=tuition");
  await expect(page.locator("body")).toHaveAttribute("data-page", "universities");
  const card = page.locator('#universitiesList .uni-card[data-uni-id="imperial-college-london-uk"]');
  await expect(card).toBeVisible();
  await expect(card.locator('[data-cost-basis="tuition"]')).toContainText(/10[\s,]?050/);
  await expect(card.locator('[data-cost-basis="annual_total"]')).toContainText("No comparable full budget");
  await expect(card).toContainText("Home/Overseas");
  await page.goto("/index.html?q=Imperial&max_tuition=90000&cost_basis=annual_total");
  await expect(page.locator("body")).toHaveAttribute("data-page", "universities");
  await expect(page.locator(".u-state-card--empty")).toBeVisible();
  await expect(card).toHaveCount(0);
});
