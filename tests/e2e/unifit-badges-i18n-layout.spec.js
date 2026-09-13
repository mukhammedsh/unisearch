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
  test(`UniFit badge layout fits within card on ${locale.label}`, async ({ page }) => {
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
    const badgeBox = firstCard.locator(".uni-badge");
    await expect(badgeBox).toBeVisible();
    await expect(badgeBox).toHaveClass(/uni-badge--count-4/);
    await expect(firstCard.locator(".uni-badge .uni-pill")).toHaveCount(4);

    const overflow = await firstCard.evaluate((card) => {
      const box = card.querySelector(".uni-badge");
      if (!box) return { hasBox: false, horizontal: true, vertical: true };
      const b = box.getBoundingClientRect();
      const pills = Array.from(box.querySelectorAll(".uni-pill"));
      const eps = 1;
      const horizontal = pills.some((pill) => {
        const r = pill.getBoundingClientRect();
        return r.left < b.left - eps || r.right > b.right + eps;
      });
      const vertical = pills.some((pill) => {
        const r = pill.getBoundingClientRect();
        return r.top < b.top - eps || r.bottom > b.bottom + eps;
      });
      return { hasBox: true, horizontal, vertical };
    });

    expect(overflow.hasBox).toBeTruthy();
    expect(overflow.horizontal).toBeFalsy();
    expect(overflow.vertical).toBeFalsy();

    const whyToPriceGap = await firstCard.evaluate((card) => {
      const why = card.querySelector(".uni-why");
      const price = card.querySelector(".uni-price");
      if (!why || !price) return null;
      return price.getBoundingClientRect().top - why.getBoundingClientRect().bottom;
    });
    expect(whyToPriceGap).not.toBeNull();
    expect(whyToPriceGap).toBeLessThanOrEqual(20);

    const [firstCardBox, compactCardBox] = await Promise.all([
      firstCard.boundingBox(),
      compactCard.boundingBox(),
    ]);
    expect(firstCardBox).not.toBeNull();
    expect(compactCardBox).not.toBeNull();
    expect(firstCardBox.height).toBeCloseTo(compactCardBox.height, 3);
  });
}
