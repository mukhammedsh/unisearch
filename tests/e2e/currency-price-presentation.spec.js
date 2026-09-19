const { test, expect } = require("@playwright/test");
const { markTourAsSeen } = require("./helpers/personas");

const KAZNMU_ID = "asfendiyarov-kazakh-national-medical-university-kaz-almaty";
const SDU_ID = "suleyman-demirel-university-kaz-kaskelen";
const SETTINGS_CACHE_KEY = "unisearch_settings_cache_v1";

async function setPriceDisplay(page, displayMode) {
  await page.addInitScript(({ settingsKey, mode }) => {
    localStorage.setItem(settingsKey, JSON.stringify([
      { key: "preferred_currency", value: "USD" },
      { key: "currency_display_mode", value: mode },
    ]));
  }, { settingsKey: SETTINGS_CACHE_KEY, mode: displayMode });
}

async function useStableKztRate(page) {
  await page.route("**/currency/rates", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        rates: { USD: 1, KZT: 450 },
        date: "2026-09-14",
        source: "test",
        filter_limits: {
          default: { min: 0, max: 100000, step: 100 },
          USD: { min: 0, max: 100000, step: 100 },
          KZT: { min: 0, max: 45000000, step: 50000 },
        },
      }),
    });
  });
}

test.describe("Currency price presentation", () => {
  test("uses a compact estimate in catalog cards and an exact conversion on the detail page", async ({ page }) => {
    await markTourAsSeen(page);
    await setPriceDisplay(page, "preferred");
    await useStableKztRate(page);

    await page.goto("/index.html");

    const card = page.locator(`#universitiesList .uni-card[data-uni-id="${KAZNMU_ID}"]`);
    await expect(card).toBeVisible();
    await expect(card).toContainText("≈ $4,200");

    await page.goto(`/university.html?id=${KAZNMU_ID}`);
    await expect(page.locator("#detailCard")).toBeVisible();
    await expect(page.locator("#detailPrice")).toContainText("≈ $4,222");
    await expect(page.locator(".finance-option-total__value").first()).toContainText("≈ $4,222");
    await expect(page.locator(".cost-legend-single").first()).toContainText("≈ $4,222");
  });

  test("retains the exact source amount when both price currencies are enabled", async ({ page }) => {
    await markTourAsSeen(page);
    await setPriceDisplay(page, "both");
    await useStableKztRate(page);

    await page.goto(`/university.html?id=${KAZNMU_ID}`);
    await expect(page.locator("#detailCard")).toBeVisible();
    await expect(page.locator("#detailPrice")).toContainText("≈ $4,222 (1,900,000 ₸)");
    await expect(page.locator(".finance-option-total__value").first()).toContainText("≈ $4,222 (1,900,000 ₸)");
    await expect(page.locator(".cost-legend-single").first()).toContainText("≈ $4,222 (1,900,000 ₸)");
  });

  test("keeps SDU's enrollment fee outside the annual tuition price", async ({ page }) => {
    await markTourAsSeen(page);
    await setPriceDisplay(page, "original");

    await page.goto(`/university.html?id=${SDU_ID}`);
    await expect(page.locator("#detailCard")).toBeVisible();
    await expect(page.locator("#detailPrice")).toContainText("1,980,000 ₸");

    await page.click(".d-tab-btn[data-tab='tab-finance']");
    const oneTimeCosts = page.locator(".finance-one-time-costs");
    await expect(oneTimeCosts).toBeVisible();
    await expect(oneTimeCosts).toContainText("60,000 ₸");
    await expect(oneTimeCosts).toContainText("Paid once upon enrollment");
    await expect(oneTimeCosts).toContainText("Also required for grant holders");
  });
});
