const { test, expect } = require("./helpers/coverage-test.cjs");
const { openAdmissionSelectionEditor } = require("./helpers/selectors");

// Live rates can arrive after the page has rendered (for example while the API wakes up). They must not rebuild a
// university page the reader is already working in.
test("live rates that arrive late keep an open admissions editor open", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("unisearch_ui_language_v1", "eng");
    localStorage.setItem("unisearch_universities_tour_seen_v1", "1");
  });
  let releaseRates;
  const ratesGate = new Promise((resolve) => { releaseRates = resolve; });
  await page.route("**/currency/rates", async (route) => {
    await ratesGate;
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ rates: { USD: 1, KZT: 470 }, date: "2026-11-16", source: "test" }) });
  });

  await page.goto("/university.html?id=mit-usa-cambridge&admission_option=&admission_application_route=mit-first-year&admission_level=undergraduate&admission_cycle=&admission_fee=unknown#tab-admission");
  await expect(page.locator("body")).toHaveAttribute("data-page", "university");
  await expect(page.locator("#detailCard")).toHaveClass(/is-mounted/);
  await expect(page.locator("#admissionsContext")).toHaveAttribute("data-state", "ready");
  await openAdmissionSelectionEditor(page);

  await page.evaluate(() => {
    window.__lateRatesSeen = false;
    window.addEventListener("currencyRatesUpdated", () => { window.__lateRatesSeen = true; }, { once: true });
  });
  releaseRates();
  await page.waitForFunction(() => window.__lateRatesSeen === true);
  // Give a rebuild, if one were triggered, time to replace the editor.
  await page.waitForTimeout(500);
  await expect(page.locator("#admissionsSelectionEditor")).toBeVisible();
  await expect(page.locator("#admissionsContext")).toHaveAttribute("data-state", "ready");
});
