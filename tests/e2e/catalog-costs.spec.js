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
    await expect(card.locator('[data-cost-basis="tuition"]')).toHaveCount(0);
    const tooltip = card.locator('.uni-cost-tooltip [role="tooltip"]');
    await expect(tooltip).toBeHidden();
    await card.locator('.uni-cost-trigger').click();
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toContainText(/2026[‑-]2027/);
    await card.locator('.uni-cost-trigger').click();
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
    await expect(card.locator(".uni-price")).toHaveAttribute("data-cost-basis", "tuition");
    await expect(card.locator(".uni-price-val")).toContainText(/66[\s,\u00a0]?720/);
    await expect(card.locator('[data-cost-basis="annual_total"]')).toHaveCount(0);
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
  await expect(card.locator('[data-cost-basis="annual_total"]')).toHaveCount(0);
  await card.locator('.uni-cost-trigger').click();
  await expect(card.locator('.uni-cost-tooltip [role="tooltip"]')).toContainText("Home fee");
  await expect(card.locator('.uni-cost-tooltip [role="tooltip"]')).toContainText("Overseas fee");
  await page.goto("/index.html?q=Imperial&cost_basis=annual_total");
  await expect(card.locator('.uni-price-val')).toHaveText("Price unavailable");
  await card.locator('.uni-cost-trigger').click();
  await expect(card.locator('.uni-cost-tooltip [role="tooltip"]')).toContainText("No comparable full budget");
  await page.goto("/index.html?q=Imperial&max_tuition=90000&cost_basis=annual_total");
  await expect(page.locator("body")).toHaveAttribute("data-page", "universities");
  await expect(page.locator(".u-state-card--empty")).toBeVisible();
  await expect(card).toHaveCount(0);
});

test("catalog price cards respect the declared fee category and label a dated reference", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("unisearch_ui_language_v1", "eng");
    localStorage.setItem("unisearch_universities_tour_seen_v1", "1");
    localStorage.setItem("unisearch_profile", JSON.stringify({
      _v: 2, major: "Computer Science", studyLevel: "undergraduate",
      feeStatusContext: "self_reported_international_overseas", intendedEntryCycle: "Fall 2027 entry",
    }));
    localStorage.setItem("unisearch_settings_cache_v1", JSON.stringify([{ key: "currency_display_mode", value: "original" }]));
  });
  await page.goto("/index.html?q=Imperial&cost_basis=tuition&study_level=undergraduate");
  await expect(page.locator("body")).toHaveAttribute("data-page", "universities");
  const imperial = page.locator('#universitiesList .uni-card[data-uni-id="imperial-college-london-uk"]');
  const imperialTuition = imperial.locator('[data-cost-basis="tuition"]');
  await expect(imperialTuition).toContainText(/£[\d,]+ – £[\d,]+/);
  await expect(imperial).toContainText("Overseas fee");
  await expect(imperial).toContainText("Undergraduate");
  await expect(imperial).not.toContainText("Master");
  await expect(imperial).not.toContainText("Home fee");
  await expect(imperial.locator('[data-cost-basis="annual_total"]')).toHaveCount(0);

  await page.goto("/index.html?q=MIT&cost_basis=annual_total");
  const mit = page.locator('#universitiesList .uni-card[data-uni-id="mit-usa-cambridge"]');
  await expect(mit).toBeVisible();
  await expect(mit).toContainText("Cycle unconfirmed");
  await expect(mit).toContainText(/2026[‑-]2027/);
  await expect(mit).toContainText("Undergraduate");
});

test.describe("compact dual-currency price", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test("keeps one price basis and opens its explanation by tap and keyboard", async ({ page }, testInfo) => {
    await page.addInitScript(() => {
      localStorage.setItem("unisearch_ui_language_v1", "rus");
      localStorage.setItem("unisearch_theme", "dark");
      localStorage.setItem("unisearch_universities_tour_seen_v1", "1");
      localStorage.setItem("unisearch_settings_cache_v1", JSON.stringify([
        { key: "preferred_currency", value: "KZT" }, { key: "currency_display_mode", value: "both" },
      ]));
    });
    await page.route("**/currency/rates", route => route.fulfill({ contentType: "application/json", body: JSON.stringify({ rates: { USD: 1, KZT: 450 }, date: "2026-10-22", source: "test" }) }));
    await page.goto("/index.html?q=MIT&cost_basis=tuition");
    await expect(page.locator("body")).toHaveAttribute("data-page", "universities");
    const card = page.locator('#universitiesList .uni-card[data-uni-id="mit-usa-cambridge"]');
    const price = card.locator('.uni-price--catalog');
    const trigger = price.locator('.uni-cost-trigger');
    const tooltip = price.locator('[role="tooltip"]');
    await expect(price).toHaveAttribute('data-cost-basis', 'tuition');
    await expect(price.locator('.uni-price-val')).toContainText('₸');
    await expect(price.locator('.uni-cost-secondary')).toHaveText('($66,720)');
    await expect(tooltip).toBeHidden();
    expect(await price.evaluate(element => element.getBoundingClientRect().height)).toBeLessThanOrEqual(100);
    await page.screenshot({ path: testInfo.outputPath('compact-two-currencies-mobile.png') });
    await trigger.tap();
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toContainText(/2026[‑-]2027/);
    await expect(tooltip).toContainText('Проживание и другие расходы');
    const bounds = await tooltip.boundingBox();
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(390);
    await trigger.tap();
    await expect(tooltip).toBeHidden();
    await trigger.focus();
    await page.keyboard.press('Enter');
    await expect(tooltip).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(tooltip).toBeHidden();
    await expect(trigger).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  });
});

test.describe("mobile price filter help", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test("stays compact and opens by touch and keyboard", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("unisearch_ui_language_v1", "rus");
      localStorage.setItem("unisearch_theme", "dark");
      localStorage.setItem("unisearch_universities_tour_seen_v1", "1");
    });
    await page.goto("/index.html");
    await expect(page.locator("body")).toHaveAttribute("data-page", "universities");
    const details = page.locator("details.catalog-cost-help");
    const summary = details.locator("summary");
    const fullHelp = details.locator("p");
    await page.locator("#mobileFilterToggle").click();
    await expect(summary).toBeVisible();
    await expect(summary).toContainText("Ценовой предел скрывает вузы без цены");
    await expect(fullHelp).toBeHidden();
    await summary.tap();
    await expect(fullHelp).toBeVisible();
    await summary.tap();
    await expect(fullHelp).toBeHidden();
    await summary.focus();
    await page.keyboard.press("Enter");
    await expect(fullHelp).toBeVisible();
  });
});
