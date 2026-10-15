const { test, expect } = require("./helpers/coverage-test.cjs");
const { expectNoStackedGapMargins } = require("./helpers/design");

const cases = [
  { theme: "light", width: 1440, height: 1000 },
  { theme: "dark", width: 1440, height: 1000 },
  { theme: "light", width: 360, height: 760 },
  { theme: "dark", width: 360, height: 760 },
];

async function openDetailPage(page, { theme, width, height, universityId = "astana-it-university-kaz-astana" }) {
  await page.setViewportSize({ width, height });
  await page.addInitScript((nextTheme) => {
    localStorage.setItem("unisearch_ui_language_v1", "eng");
    localStorage.setItem("unisearch_theme", nextTheme);
  }, theme);
  await page.goto(`/university.html?id=${universityId}`);
  await expect(page.locator("#detailCard")).toBeVisible();
  await expect(page.locator("#detailName")).not.toHaveText("University Name");
  await page.waitForLoadState("networkidle");
}

test("reviewed and standard university covers share the same height", async ({ page }) => {
  for (const viewport of [
    { name: "desktop", width: 1440, height: 900 },
    { name: "phone", width: 390, height: 844 },
  ]) {
    const coverHeights = {};
    for (const universityId of ["mit-usa-cambridge", "university-of-oxford-uk-oxford"]) {
      await openDetailPage(page, {
        theme: "light",
        width: viewport.width,
        height: viewport.height,
        universityId,
      });

      const cover = page.locator("#detailCover");
      coverHeights[universityId] = await cover.evaluate((element) => element.getBoundingClientRect().height);
      await page.mouse.move(viewport.width - 1, viewport.height - 1);
      // shortcut: the checked-in baseline is Windows-only; add an OS capture before enabling Linux comparisons.
      if (process.platform === "win32") {
        await expect(cover).toHaveScreenshot(`${universityId}-${viewport.name}.png`, {
          animations: "disabled",
          caret: "hide",
          maxDiffPixels: 8,
        });
      }
    }

    expect(coverHeights["mit-usa-cambridge"]).toBeGreaterThan(0);
    expect(coverHeights["mit-usa-cambridge"]).toBe(coverHeights["university-of-oxford-uk-oxford"]);
  }
});

test("detail focus ring meets non-text contrast in both themes", async ({ page }) => {
  for (const theme of ["light", "dark"]) {
    await openDetailPage(page, { theme, width: 1280, height: 900 });
    await page.keyboard.press("Tab");
    const contrast = await page.locator(".d-tab-btn").first().evaluate((element) => {
      const parse = (color) => color.match(/[\d.]+/g).slice(0, 3).map(Number);
      const luminance = (color) => parse(color).map((value) => {
        const channel = value / 255;
        return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
      }).reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
      const probe = document.createElement("span");
      probe.style.color = "var(--focus-ring)";
      probe.style.backgroundColor = "var(--surface-soft)";
      document.body.appendChild(probe);
      const probeStyle = getComputedStyle(probe);
      const [lighter, darker] = [luminance(probeStyle.color), luminance(probeStyle.backgroundColor)].sort((a, b) => b - a);
      probe.remove();
      element.focus();
      return {
        ratio: (lighter + 0.05) / (darker + 0.05),
        outline: getComputedStyle(element).outlineColor,
        focusVisible: element.matches(":focus-visible"),
      };
    });
    expect(contrast.ratio).toBeGreaterThanOrEqual(3);
    expect(contrast.outline).not.toBe("rgba(0, 0, 0, 0)");
    expect(contrast.focusVisible).toBe(true);
  }
});

test("active study-level text meets contrast in dark mode", async ({ page }) => {
  await openDetailPage(page, { theme: "dark", width: 1280, height: 900 });
  const ratio = await page.evaluate(() => {
    const button = document.createElement("button");
    button.className = "track-select-btn is-active";
    button.textContent = "Undergraduate";
    document.body.appendChild(button);
    const style = getComputedStyle(button);
    const channels = (color) => color.match(/[\d.]+/g).slice(0, 3).map(Number);
    const luminance = (color) => channels(color).map((value) => {
      const channel = value / 255;
      return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    }).reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
    const [lighter, darker] = [luminance(style.color), luminance(style.backgroundColor)].sort((a, b) => b - a);
    button.remove();
    return (lighter + 0.05) / (darker + 0.05);
  });
  expect(ratio).toBeGreaterThanOrEqual(4.5);
});

test("detail loading fade-in is disabled for reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openDetailPage(page, { theme: "light", width: 1280, height: 900 });
  const loading = page.locator(".d-loading");
  const style = await loading.evaluate((element) => {
    element.classList.add("is-visible");
    const computed = getComputedStyle(element);
    return { animationName: computed.animationName, opacity: computed.opacity };
  });
  expect(style).toEqual({ animationName: "none", opacity: "1" });
});

for (const scenario of cases) {
  test(`university detail keeps 2026 design invariants (${scenario.theme}, ${scenario.width}px)`, async ({ page }) => {
    await openDetailPage(page, scenario);

    const metrics = await page.evaluate(() => {
      const doc = document.documentElement;
      const scrolling = document.scrollingElement || doc;
      const card = document.querySelector(".d-card");
      const cover = document.querySelector(".d-cover");
      const logo = document.querySelector("#detailLogo");
      const activeTab = document.querySelector(".d-tab-btn.active");
      const back = document.querySelector(".d-cover-back");
      const visibleLinks = Array.from(document.querySelectorAll(".d-site-link")).filter(
        (el) => el instanceof HTMLElement && el.offsetParent !== null
      );

      const cardStyle = card ? getComputedStyle(card) : null;
      const coverStyle = cover ? getComputedStyle(cover) : null;
      const logoStyle = logo ? getComputedStyle(logo) : null;
      const activeTabStyle = activeTab ? getComputedStyle(activeTab) : null;
      const backStyle = back ? getComputedStyle(back) : null;
      const linkStyles = visibleLinks.map((el) => getComputedStyle(el));

      return {
        scrollWidth: scrolling ? scrolling.scrollWidth : 0,
        clientWidth: scrolling ? scrolling.clientWidth : 0,
        cardRadius: cardStyle ? parseFloat(cardStyle.borderTopLeftRadius) : 0,
        coverRadius: coverStyle ? parseFloat(coverStyle.borderTopLeftRadius) : 0,
        logoOverflow: logoStyle ? logoStyle.overflow : "",
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
    expect(metrics.logoOverflow).toBe("hidden");
    expect(metrics.activeTabBackground).toBe("rgba(0, 0, 0, 0)");
    expect(metrics.activeTabRadius).toBe(0);
    expect(metrics.backBackground).not.toBe("rgba(0, 0, 0, 0)");
    expect(metrics.backRadius).toBeGreaterThanOrEqual(14);
    for (const background of metrics.linkBackgrounds) {
      expect(background).not.toBe("rgba(0, 0, 0, 0)");
    }

    await page.click(".d-tab-btn[data-tab='tab-admission']");
    await expect(page.locator("#tab-admission")).toHaveClass(/active/);
    await expectNoStackedGapMargins(page, "#tab-admission");

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
    await expectNoStackedGapMargins(page, "#tab-finance");

    const financePanelRadius = await page.evaluate(() => {
      const financePanel = document.querySelector("#tab-finance .finance-box");
      const financePanelStyle = financePanel ? getComputedStyle(financePanel) : null;
      return financePanelStyle ? parseFloat(financePanelStyle.borderTopLeftRadius) : -1;
    });

    expect(financePanelRadius).toBe(0);
  });
}
