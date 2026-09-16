const { test, expect } = require("@playwright/test");
const { personas, seedProfile } = require("./helpers/personas");

test.describe("UniChance Calculator Validation", () => {
  test("anonymous user sees an unavailable personal chance", async ({ page }) => {
    // 1. Open Nazarbayev University page without a filled profile
    await page.goto("/university.html?id=nazarbayev-university-kaz-astana");
    await expect(page.locator("#detailCard")).toBeVisible();

    // 2. Click the "Admission" tab
    await page.click(".d-tab-btn[data-tab='tab-admission']");

    // 3. Missing profile evidence is not represented as a fabricated 0%.
    const chancePercent = page.locator(".chance-percent");
    await expect(chancePercent).toContainText("?");
    await expect(chancePercent).toHaveClass(/chance-low/);
  });

  test("user with strong profile sees positive admission chances and high chance badges", async ({ page }) => {
    // 1. Set strong profile (ruStemGrant: SAT 1490, IELTS 7.5, GPA 3.84)
    await seedProfile(page, personas.ruStemGrant.profile);

    // 2. Open Nazarbayev University page
    await page.goto("/university.html?id=nazarbayev-university-kaz-astana");
    await page.waitForSelector("#detailCard", { state: "visible", timeout: 15000 });

    // 3. Click the "Admission" tab
    await page.click(".d-tab-btn[data-tab='tab-admission']");

    // 4. Empty profile warning should not be visible
    const warning = page.locator(".chance-warning");
    await expect(warning).not.toBeVisible();

    // 5. Should display high chance percentage (>= 45%)
    const chancePercent = page.locator(".chance-percent");
    await expect(chancePercent).toBeVisible();
    const percentText = await chancePercent.textContent();
    const percentNum = parseInt(percentText.replace("%", "").trim(), 10);
    expect(percentNum).toBeGreaterThanOrEqual(45);

    // 6. Ensure the badge has the appropriate tone class
    const toneClass = await chancePercent.getAttribute("class");
    expect(toneClass).toMatch(/chance-high|chance-good|chance-medium/);
  });
});
