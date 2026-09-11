const { test, expect } = require("@playwright/test");
const { markTourAsSeen } = require("./helpers/personas");

async function switchLanguage(page, value) {
  await page.evaluate((lang) => {
    const select = document.getElementById("languageSelect");
    if (!select) return;
    select.value = lang;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
}

test.describe("Settings Modal — Multi-Currency Controls", () => {
  test.beforeEach(async ({ page }) => {
    await markTourAsSeen(page);
  });

  test("Pricing section renders with default options and handles light/dark themes and en/ru localization", async ({ page }) => {
    await page.goto("/index.html");

    // Open settings modal
    const settingsBtn = page.locator("#settingsBtn");
    await expect(settingsBtn).toBeVisible();
    await settingsBtn.click();

    const modal = page.locator("#settingsModal");
    await expect(modal).toHaveClass(/is-open/);

    // Section title
    const pricingTitle = modal.locator(".settings-section-title");
    await expect(pricingTitle).toBeVisible();
    await expect(pricingTitle).toHaveText("Pricing");

    // Preferred currency custom trigger and select
    const currencySelect = modal.locator('[data-setting-input="preferred_currency"]');
    await expect(currencySelect).toBeAttached();
    await expect(currencySelect).toHaveValue("USD");

    const currencyTrigger = modal.locator('[data-setting-key="preferred_currency"] .custom-select-trigger');
    await expect(currencyTrigger).toBeVisible();

    // Price display mode custom trigger and select
    const displaySelect = modal.locator('[data-setting-input="currency_display_mode"]');
    await expect(displaySelect).toBeAttached();
    await expect(displaySelect).toHaveValue("preferred");

    const displayTrigger = modal.locator('[data-setting-key="currency_display_mode"] .custom-select-trigger');
    await expect(displayTrigger).toBeVisible();

    // Verify 6 regional optgroups exist in the select
    const optgroups = await currencySelect.locator("optgroup").all();
    expect(optgroups.length).toBe(6);
    const optgroupLabels = await Promise.all(optgroups.map((g) => g.getAttribute("label")));
    expect(optgroupLabels).toEqual([
      "Central Asia & CIS",
      "Europe",
      "Americas",
      "Asia-Pacific",
      "Middle East & Africa",
      "Other currencies",
    ]);

    // Verify currencies count and presence of key regional currencies
    const options = await currencySelect.locator("option").all();
    const values = await Promise.all(options.map((opt) => opt.getAttribute("value")));
    expect(values.length).toBe(166);
    expect(values).toContain("USD");
    expect(values).toContain("EUR");
    expect(values).toContain("GBP");
    expect(values).toContain("KZT");
    expect(values).toContain("UZS");
    expect(values).toContain("KGS");
    expect(values).toContain("TRY");
    expect(values).toContain("AED");

    // Verify option label in English contains full name first
    const uzsOptionEn = currencySelect.locator('option[value="UZS"]');
    await expect(uzsOptionEn).toHaveText("Uzbekistani Som (UZS, soʻm)");

    // --- THEME VERIFICATION (LIGHT / DARK) ---
    // In light theme:
    const lightBg = await currencyTrigger.evaluate((el) => window.getComputedStyle(el).backgroundColor);
    const lightColor = await currencyTrigger.evaluate((el) => window.getComputedStyle(el).color);
    expect(lightBg).not.toBe("");
    expect(lightColor).not.toBe("");

    // Toggle theme to dark
    await page.evaluate(() => document.getElementById("themeToggleBtn")?.click());
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

    // In dark theme: verify trigger adapts to dark theme
    const darkBg = await currencyTrigger.evaluate((el) => window.getComputedStyle(el).backgroundColor);
    const darkColor = await currencyTrigger.evaluate((el) => window.getComputedStyle(el).color);
    expect(darkBg).not.toBe(lightBg);
    expect(darkColor).not.toBe(lightColor);

    // Toggle back to light
    await page.evaluate(() => document.getElementById("themeToggleBtn")?.click());
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

    // --- LOCALIZATION VERIFICATION (ENG / RU) ---
    // Switch to Russian
    await switchLanguage(page, "rus");

    await expect(pricingTitle).toHaveText("Цены");
    const currencyTitleRu = modal.locator('[data-setting-key="preferred_currency"] .settings-copy h3');
    await expect(currencyTitleRu).toHaveText("Предпочитаемая валюта");

    const displayTitleRu = modal.locator('[data-setting-key="currency_display_mode"] .settings-copy h3');
    await expect(displayTitleRu).toHaveText("Отображение цен");

    // Verify optgroup labels in Russian
    const optgroupLabelsRu = await Promise.all(
      (await currencySelect.locator("optgroup").all()).map((g) => g.getAttribute("label"))
    );
    expect(optgroupLabelsRu).toEqual([
      "Центральная Азия и СНГ",
      "Европа",
      "Северная и Южная Америка",
      "Азиатско-Тихоокеанский регион",
      "Ближний Восток и Африка",
      "Другие валюты",
    ]);

    // Verify currency option labels in Russian
    await expect(currencySelect.locator('option[value="UZS"]')).toHaveText("Узбекский сум (UZS, soʻm)");
    await expect(currencySelect.locator('option[value="KZT"]')).toHaveText("Казахстанский тенге (KZT, ₸)");

    // Verify option labels in Russian
    const displayOptionsRu = await displaySelect.locator("option").all();
    const displayTextsRu = await Promise.all(displayOptionsRu.map((opt) => opt.textContent()));
    expect(displayTextsRu[0].trim()).toBe("В предпочитаемой валюте");
    expect(displayTextsRu[1].trim()).toBe("Оба (предпочитаемая + оригинальная)");
    expect(displayTextsRu[2].trim()).toBe("В оригинальной валюте");

    // Switch back to English
    await switchLanguage(page, "eng");
    await expect(pricingTitle).toHaveText("Pricing");

    // --- INTERACTION AND PERSISTENCE ---
    // Select UZS via custom dropdown
    await currencyTrigger.click();
    const uzsOption = modal.locator('[data-setting-key="preferred_currency"] .custom-option[data-value="UZS"]');
    await expect(uzsOption).toBeVisible();
    await uzsOption.click();

    // Select "both" via custom dropdown
    await displayTrigger.click();
    const bothOption = modal.locator('[data-setting-key="currency_display_mode"] .custom-option[data-value="both"]');
    await expect(bothOption).toBeVisible();
    await bothOption.click();

    // Toast should show
    const toast = page.locator("#toast-container .toast").first();
    await expect(toast).toBeVisible();

    // Close settings modal
    const closeBtn = page.locator("#settingsCloseBtn");
    await closeBtn.click();
    await expect(modal).not.toHaveClass(/is-open/);

    // Reload page and check persistence
    await page.reload();

    const settingsBtnAfter = page.locator("#settingsBtn");
    await expect(settingsBtnAfter).toBeVisible();
    await settingsBtnAfter.click();
    await expect(modal).toHaveClass(/is-open/);

    const currencySelectAfter = modal.locator('[data-setting-input="preferred_currency"]');
    await expect(currencySelectAfter).toHaveValue("UZS");

    const displaySelectAfter = modal.locator('[data-setting-input="currency_display_mode"]');
    await expect(displaySelectAfter).toHaveValue("both");
  });

  test("Settings modal responsive layout on mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/index.html");

    const settingsBtn = page.locator("#settingsBtn");
    await expect(settingsBtn).toBeVisible();
    await settingsBtn.click();

    const modal = page.locator("#settingsModal");
    await expect(modal).toHaveClass(/is-open/);

    const currencyWrapper = modal.locator('[data-setting-key="preferred_currency"] .custom-select-wrapper');
    await expect(currencyWrapper).toBeVisible();

    // On mobile, custom select wrapper should take full width of row
    const box = await currencyWrapper.boundingBox();
    expect(box.width).toBeGreaterThan(250);
  });

  test("Custom select supports typeahead keyboard navigation", async ({ page }) => {
    await page.goto("/index.html");

    // Open settings modal
    await page.click("#settingsBtn");
    const modal = page.locator("#settingsModal");
    await expect(modal).toHaveClass(/is-open/);

    const currencyTrigger = modal.locator('[data-setting-key="preferred_currency"] .custom-select-trigger');
    await expect(currencyTrigger).toBeVisible();
    await currencyTrigger.focus();

    // Press 'k' -> immediately jumps to Kazakhstani Tenge
    await page.keyboard.press("k");
    const currencySelect = modal.locator('[data-setting-input="preferred_currency"]');
    await expect(currencySelect).toHaveValue("KZT");
    await expect(currencyTrigger).toContainText("Kazakhstani Tenge (KZT, ₸)");

    // Wait for buffer to reset before starting a new search
    await page.waitForTimeout(900);

    // Press 'u', then 'z' within 800ms -> matches Uzbekistani Som
    await page.keyboard.press("u");
    await page.keyboard.press("z");
    await expect(currencySelect).toHaveValue("UZS");
    await expect(currencyTrigger).toContainText("Uzbekistani Som (UZS, soʻm)");
  });
});
