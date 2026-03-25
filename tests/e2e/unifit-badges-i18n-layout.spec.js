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
            total_cost_year_usd: 90000,
            financial_aid: { merit_based: true, need_based: true },
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
      ];
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(makeAiSortResponse(items)),
      });
    });

    await page.goto("/universities.html", { waitUntil: "domcontentloaded" });
    await expect(page.locator("#languageSelect")).toHaveValue(locale.value);

    const firstCard = page.locator(".uni-card").first();
    await expect(firstCard).toBeVisible();
    await expect(firstCard.locator(".uni-badge")).toHaveClass(/uni-badge--count-4/);
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
  });
}
