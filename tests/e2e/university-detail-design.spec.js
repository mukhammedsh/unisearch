const { test, expect } = require("@playwright/test");

const cases = [
  { theme: "light", width: 1440, height: 1000 },
  { theme: "dark", width: 1440, height: 1000 },
  { theme: "light", width: 360, height: 760 },
  { theme: "dark", width: 360, height: 760 },
];

async function openDetailPage(page, { theme, width, height }) {
  await page.setViewportSize({ width, height });
  await page.addInitScript((nextTheme) => {
    localStorage.setItem("unisearch_theme", nextTheme);
  }, theme);
  await page.goto("/university.html?id=astana-it-university-kaz-astana");
  await expect(page.locator("#detailCard")).toBeVisible();
  await expect(page.locator("#detailName")).not.toHaveText("University Name");
  await page.waitForLoadState("networkidle");
}

for (const scenario of cases) {
  test(`university detail keeps 2026 design invariants (${scenario.theme}, ${scenario.width}px)`, async ({ page }) => {
    await openDetailPage(page, scenario);

    const metrics = await page.evaluate(() => {
      const doc = document.documentElement;
      const scrolling = document.scrollingElement || doc;
      const card = document.querySelector(".d-card");
      const cover = document.querySelector(".d-cover");
      const activeTab = document.querySelector(".d-tab-btn.active");
      const back = document.querySelector(".d-back");
      const visibleLinks = Array.from(document.querySelectorAll(".d-site-link")).filter(
        (el) => el instanceof HTMLElement && el.offsetParent !== null
      );

      const cardStyle = card ? getComputedStyle(card) : null;
      const coverStyle = cover ? getComputedStyle(cover) : null;
      const activeTabStyle = activeTab ? getComputedStyle(activeTab) : null;
      const backStyle = back ? getComputedStyle(back) : null;
      const linkStyles = visibleLinks.map((el) => getComputedStyle(el));

      return {
        scrollWidth: scrolling ? scrolling.scrollWidth : 0,
        clientWidth: scrolling ? scrolling.clientWidth : 0,
        cardRadius: cardStyle ? parseFloat(cardStyle.borderTopLeftRadius) : 0,
        coverRadius: coverStyle ? parseFloat(coverStyle.borderTopLeftRadius) : 0,
        activeTabBackground: activeTabStyle ? activeTabStyle.backgroundColor : "",
        activeTabRadius: activeTabStyle ? parseFloat(activeTabStyle.borderTopLeftRadius) : -1,
        backBackground: backStyle ? backStyle.backgroundColor : "",
        backRadius: backStyle ? parseFloat(backStyle.borderTopLeftRadius) : 0,
        linkBackgrounds: linkStyles.map((style) => style.backgroundColor),
      };
    });

    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
    expect(metrics.cardRadius).toBeGreaterThanOrEqual(scenario.width <= 380 ? 18 : 20);
    expect(metrics.coverRadius).toBeGreaterThanOrEqual(scenario.width <= 380 ? 18 : 20);
    expect(metrics.activeTabBackground).toBe("rgba(0, 0, 0, 0)");
    expect(metrics.activeTabRadius).toBe(0);
    expect(metrics.backBackground).toBe("rgba(0, 0, 0, 0)");
    expect(metrics.backRadius).toBeGreaterThanOrEqual(14);
    for (const background of metrics.linkBackgrounds) {
      expect(background).toBe("rgba(0, 0, 0, 0)");
    }

    await page.click(".d-tab-btn[data-tab='tab-admission']");
    await expect(page.locator("#tab-admission")).toHaveClass(/active/);

    const admissionSurfaces = await page.evaluate(() => {
      const visibleCards = Array.from(document.querySelectorAll("#tab-admission .admission-category-card")).filter(
        (el) => el instanceof HTMLElement && el.offsetParent !== null
      );
      const visibleFundingOptions = Array.from(document.querySelectorAll("#tab-admission .admission-funding-option")).filter(
        (el) => el instanceof HTMLElement && el.offsetParent !== null
      );
      const firstCardStyle = visibleCards[0] ? getComputedStyle(visibleCards[0]) : null;
      const firstFundingOptionStyle = visibleFundingOptions[0] ? getComputedStyle(visibleFundingOptions[0]) : null;
      const admissionPanel = document.querySelector("#tab-admission .d-box");
      const admissionPanelStyle = admissionPanel ? getComputedStyle(admissionPanel) : null;
      const chanceWrap = document.querySelector("#tab-admission .chance-percent-wrap");
      const chanceWrapStyle = chanceWrap ? getComputedStyle(chanceWrap) : null;

      return {
        cardCount: visibleCards.length,
        panelRadius: admissionPanelStyle ? parseFloat(admissionPanelStyle.borderTopLeftRadius) : -1,
        chanceDirection: chanceWrapStyle ? chanceWrapStyle.flexDirection : "",
        cardRadius: firstCardStyle ? parseFloat(firstCardStyle.borderTopLeftRadius) : 0,
        cardBackgroundImage: firstCardStyle ? firstCardStyle.backgroundImage : "",
        fundingBackgroundImage: firstFundingOptionStyle ? firstFundingOptionStyle.backgroundImage : "none",
      };
    });

    expect(admissionSurfaces.cardCount).toBeGreaterThan(0);
    expect(admissionSurfaces.panelRadius).toBe(0);
    expect(admissionSurfaces.chanceDirection).toBe(scenario.width <= 640 ? "row" : "column");
    expect(admissionSurfaces.cardRadius).toBeGreaterThanOrEqual(16);
    expect(admissionSurfaces.cardBackgroundImage).toBe("none");
    expect(admissionSurfaces.fundingBackgroundImage).toBe("none");

    await page.click(".d-tab-btn[data-tab='tab-finance']");
    await expect(page.locator("#tab-finance")).toHaveClass(/active/);

    const financePanelRadius = await page.evaluate(() => {
      const financePanel = document.querySelector("#tab-finance .finance-box");
      const financePanelStyle = financePanel ? getComputedStyle(financePanel) : null;
      return financePanelStyle ? parseFloat(financePanelStyle.borderTopLeftRadius) : -1;
    });

    expect(financePanelRadius).toBe(0);
  });
}
