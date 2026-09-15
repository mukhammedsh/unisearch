const { test, expect } = require("@playwright/test");
const { personas, seedProfile, markTourAsSeen } = require("./helpers/personas");

function makeAiSortResponse(items) {
  return {
    items,
    total: items.length,
    page: 1,
    limit: items.length,
    warnings: [],
  };
}

const locales = [
  { value: "eng", label: "English" },
  { value: "rus", label: "Russian" },
];

for (const locale of locales) {
  test(`UniFit status icons fit within the image on ${locale.label}`, async ({ page }) => {
    await markTourAsSeen(page);
    await seedProfile(page, personas.enResearch.profile);
    await page.addInitScript((lang) => {
      localStorage.setItem("unisearch_ui_language_v1", lang);
    }, locale.value);

    await page.route("**/universities/ai-sort", async (route) => {
      const items = [
        {
          id: "mit-usa-cambridge",
          name: "Badge Layout University",
          rank: 11,
          location: { country: "USA", city: "Boston" },
          finance: {
            total_cost_year_usd: 90000
          },
          academics: { acceptance_rate_percent: 19 },
          matchData: {
            finalPrice: 90000,
            preferenceMismatch: 0.08, // vibe tag
            selectedChanceType: "grant",
            grantChance: 82, // finance tag
            generalChance: 30,
            conditional: true, // conditional tag
            conditionalRequirements: 1,
            aidAny: true, // over budget + aid tag
          },
        },
        {
          id: "compact-layout-university",
          name: "Compact Layout University",
          rank: 25,
          location: { country: "USA", city: "Boston" },
          finance: {
            total_cost_year_usd: 50000,
          },
          academics: { acceptance_rate_percent: 25 },
          matchData: {
            finalPrice: 50000,
            preferenceMismatch: 0.2,
          },
        },
      ];
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(makeAiSortResponse(items)),
      });
    });

    await page.goto("/index.html", { waitUntil: "domcontentloaded" });
    await expect(page.locator("#languageSelect")).toHaveValue(locale.value);

    const firstCard = page.locator('.uni-card[data-uni-id="mit-usa-cambridge"]');
    const compactCard = page.locator('.uni-card[data-uni-id="compact-layout-university"]');
    await expect(firstCard).toBeVisible();
    await expect(compactCard).toBeVisible();
    const statuses = firstCard.locator(".uni-card-statuses");
    await expect(statuses).toBeVisible();
    await expect(firstCard.locator(".uni-status-trigger")).toHaveCount(4);

    const overflow = await firstCard.evaluate((card) => {
      const box = card.querySelector(".uni-media");
      if (!box) return { hasBox: false, horizontal: true, vertical: true };
      const b = box.getBoundingClientRect();
      const statuses = Array.from(card.querySelectorAll(".uni-status-trigger"));
      const eps = 1;
      const horizontal = statuses.some((status) => {
        const r = status.getBoundingClientRect();
        return r.left < b.left - eps || r.right > b.right + eps;
      });
      const vertical = statuses.some((status) => {
        const r = status.getBoundingClientRect();
        return r.top < b.top - eps || r.bottom > b.bottom + eps;
      });
      return { hasBox: true, horizontal, vertical };
    });

    expect(overflow.hasBox).toBeTruthy();
    expect(overflow.horizontal).toBeFalsy();
    expect(overflow.vertical).toBeFalsy();

    const firstStatus = firstCard.locator(".uni-status-trigger").first();
    await firstStatus.hover();
    await expect(firstCard.locator(".uni-status-tooltip__content").first()).toBeVisible();
    const catalogUrl = page.url();
    await firstStatus.click();
    await expect(page).toHaveURL(catalogUrl);
    const firstTooltip = firstCard.locator(".uni-status-tooltip__content").first();
    await expect(firstTooltip).toBeVisible();
    await expect(firstTooltip).toHaveCSS("z-index", "1200");
    await expect(firstTooltip.locator(".uni-status-tooltip__title")).toBeVisible();
    await expect(firstTooltip.locator(".uni-status-tooltip__text")).toBeVisible();
    const firstAriaLabel = await firstStatus.getAttribute("aria-label");
    expect(firstAriaLabel).toMatch(/: /);

    await firstStatus.click();
    await expect(firstTooltip).not.toBeVisible();
    await firstStatus.click();
    await expect(firstTooltip).toBeVisible();
    await firstStatus.click();
    await expect(firstTooltip).not.toBeVisible();
    expect(await firstCard.evaluate((card) => getComputedStyle(card).overflow)).toBe("visible");
    expect(await firstCard.locator(".uni-media").evaluate((media) => media.contains(media.parentElement?.querySelector(".uni-card-statuses")))).toBeFalsy();

    await page.evaluate(() => document.documentElement.setAttribute("data-theme", "light"));
    const lightStatusColor = await firstStatus.evaluate((status) => {
      const styles = getComputedStyle(status);
      return [styles.backgroundColor, styles.borderColor, styles.color];
    });
    await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
    const darkStatusColor = await firstStatus.evaluate((status) => {
      const styles = getComputedStyle(status);
      return [styles.backgroundColor, styles.borderColor, styles.color];
    });
    expect(darkStatusColor).toEqual(lightStatusColor);

    await page.evaluate(() => document.documentElement.setAttribute("data-theme", "light"));
    await firstStatus.hover();
    const lightHoverBorder = await firstStatus.evaluate((status) => getComputedStyle(status).borderColor);
    await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
    await firstStatus.hover();
    const darkHoverBorder = await firstStatus.evaluate((status) => getComputedStyle(status).borderColor);
    expect(darkHoverBorder).toEqual(lightHoverBorder);
    expect(darkHoverBorder).toBe("rgb(17, 24, 39)");

    const [firstCardBox, compactCardBox] = await Promise.all([
      firstCard.boundingBox(),
      compactCard.boundingBox(),
    ]);
    expect(firstCardBox).not.toBeNull();
    expect(compactCardBox).not.toBeNull();
    expect(firstCardBox.height).toBeCloseTo(compactCardBox.height, 3);

    await page.setViewportSize({ width: 375, height: 800 });
    await expect(firstCard).toBeVisible();
    const mobileOverflow = await firstCard.evaluate((card) => {
      const box = card.querySelector(".uni-media");
      if (!box) return { hasBox: false, horizontal: true, vertical: true };
      const b = box.getBoundingClientRect();
      const statuses = Array.from(card.querySelectorAll(".uni-status-trigger"));
      const eps = 1;
      return {
        hasBox: true,
        horizontal: statuses.some((status) => {
          const r = status.getBoundingClientRect();
          return r.left < b.left - eps || r.right > b.right + eps;
        }),
        vertical: statuses.some((status) => {
          const r = status.getBoundingClientRect();
          return r.top < b.top - eps || r.bottom > b.bottom + eps;
        }),
      };
    });
    expect(mobileOverflow.hasBox).toBeTruthy();
    expect(mobileOverflow.horizontal).toBeFalsy();
    expect(mobileOverflow.vertical).toBeFalsy();

    const mobileStatus = firstCard.locator(".uni-status-trigger").first();
    const mobileTooltip = firstCard.locator(".uni-status-tooltip__content").first();
    await mobileStatus.click();
    await expect(mobileTooltip).toBeVisible();
    await mobileStatus.click();
    await expect(mobileTooltip).not.toBeVisible();
  });
}
