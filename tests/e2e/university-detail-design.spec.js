const { test, expect } = require("./helpers/coverage-test.cjs");
const { expectNoStackedGapMargins } = require("./helpers/design");

const cases = [
  { theme: "light", width: 1440, height: 1000 },
  { theme: "dark", width: 1440, height: 1000 },
  { theme: "light", width: 360, height: 760 },
  { theme: "dark", width: 360, height: 760 },
];

async function openDetailPage(page, { theme, width, height, universityId = "astana-it-university-kaz-astana", language = "eng" }) {
  await page.setViewportSize({ width, height });
  await page.addInitScript(({ nextTheme, nextLanguage }) => {
    localStorage.setItem("unisearch_ui_language_v1", nextLanguage);
    localStorage.setItem("unisearch_theme", nextTheme);
  }, { nextTheme: theme, nextLanguage: language });
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
          // Subpixel vector AA on the frosted back arrow varies by ~23px (<0.04% of the cover) across parallel runs.
          maxDiffPixels: 50,
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
      const activeTab = document.querySelector(".d-tab-btn.active");
      const back = document.querySelector(".d-cover-back");
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
    await expect(page.locator("#detailLogo")).toHaveCount(0);
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
      const visibleStatsBoxes = Array.from(document.querySelectorAll("#tab-admission .track-stats-box")).filter(
        (el) => el instanceof HTMLElement && el.offsetParent !== null
      );
      const visibleFundingOptions = Array.from(document.querySelectorAll("#tab-admission .admission-funding-option")).filter(
        (el) => el instanceof HTMLElement && el.offsetParent !== null
      );
      const visibleExamGroups = Array.from(document.querySelectorAll("#tab-admission .track-exam-group")).filter(
        (el) => el instanceof HTMLElement && el.offsetParent !== null
      );
      const firstCardStyle = visibleCards[0] ? getComputedStyle(visibleCards[0]) : null;
      const firstStatsBoxStyle = visibleStatsBoxes[0] ? getComputedStyle(visibleStatsBoxes[0]) : null;
      const firstFundingOptionStyle = visibleFundingOptions[0] ? getComputedStyle(visibleFundingOptions[0]) : null;
      const firstExamGroupStyle = visibleExamGroups[0] ? getComputedStyle(visibleExamGroups[0]) : null;
      const admissionPanel = document.querySelector("#tab-admission .d-box");
      const admissionPanelStyle = admissionPanel ? getComputedStyle(admissionPanel) : null;

      return {
        cardCount: visibleCards.length,
        statsBoxCount: visibleStatsBoxes.length,
        fundingOptionCount: visibleFundingOptions.length,
        examGroupCount: visibleExamGroups.length,
        panelRadius: admissionPanelStyle ? parseFloat(admissionPanelStyle.borderTopLeftRadius) : -1,
        cardRadius: firstCardStyle ? parseFloat(firstCardStyle.borderTopLeftRadius) : -1,
        cardBackground: firstCardStyle ? firstCardStyle.backgroundColor : "",
        cardBackgroundImage: firstCardStyle ? firstCardStyle.backgroundImage : "",
        statsBoxRadius: firstStatsBoxStyle ? parseFloat(firstStatsBoxStyle.borderTopLeftRadius) : -1,
        statsBoxBackground: firstStatsBoxStyle ? firstStatsBoxStyle.backgroundColor : "",
        fundingOptionRadius: firstFundingOptionStyle ? parseFloat(firstFundingOptionStyle.borderTopLeftRadius) : -1,
        fundingOptionBackground: firstFundingOptionStyle ? firstFundingOptionStyle.backgroundColor : "",
        fundingBackgroundImage: firstFundingOptionStyle ? firstFundingOptionStyle.backgroundImage : "none",
        examGroupRadius: firstExamGroupStyle ? parseFloat(firstExamGroupStyle.borderTopLeftRadius) : -1,
        examGroupBackground: firstExamGroupStyle ? firstExamGroupStyle.backgroundColor : "",
      };
    });

    expect(admissionSurfaces.cardCount).toBeGreaterThan(0);
    expect(admissionSurfaces.panelRadius).toBe(0);
    expect(admissionSurfaces.cardRadius).toBe(0);
    expect(admissionSurfaces.cardBackground).toBe("rgba(0, 0, 0, 0)");
    expect(admissionSurfaces.cardBackgroundImage).toBe("none");
    if (admissionSurfaces.statsBoxCount > 0) {
      expect(admissionSurfaces.statsBoxRadius).toBeGreaterThanOrEqual(12);
      expect(admissionSurfaces.statsBoxBackground).not.toBe("rgba(0, 0, 0, 0)");
    }
    if (admissionSurfaces.fundingOptionCount > 0) {
      expect(admissionSurfaces.fundingOptionRadius).toBeGreaterThanOrEqual(12);
      expect(admissionSurfaces.fundingOptionBackground).not.toBe("rgba(0, 0, 0, 0)");
    }
    expect(admissionSurfaces.fundingBackgroundImage).toBe("none");
    if (admissionSurfaces.examGroupCount > 0) {
      expect(admissionSurfaces.examGroupRadius).toBe(0);
      expect(admissionSurfaces.examGroupBackground).toBe("rgba(0, 0, 0, 0)");
    }

    const fundingLayout = await page.evaluate(() => {
      const probe = document.createElement("span");
      probe.style.color = "var(--text)";
      document.body.appendChild(probe);
      const primaryTextColor = getComputedStyle(probe).color;
      probe.remove();

      const options = Array.from(document.querySelectorAll("#tab-admission .admission-funding-option")).filter(
        (el) => el instanceof HTMLElement && el.offsetParent !== null
      );
      const headers = [];
      const metaGroups = [];
      const metaTags = [];

      for (const option of options) {
        const header = option.querySelector(".admission-funding-option-header");
        const title = header?.querySelector(".admission-funding-option-title");
        const side = header?.querySelector(".admission-funding-option-side");
        if (header && title && side) {
          const headerRect = header.getBoundingClientRect();
          const titleRect = title.getBoundingClientRect();
          const sideRect = side.getBoundingClientRect();
          const main = option.querySelector(".admission-funding-option-main");
          const mainRect = main && main.offsetParent !== null ? main.getBoundingClientRect() : null;
          const strong = title.querySelector("strong");
          const strongStyle = strong ? getComputedStyle(strong) : null;
          headers.push({
            horizontalGap: sideRect.left - titleRect.right,
            verticalGap: sideRect.top - titleRect.bottom,
            mainTopGap: mainRect ? mainRect.top - headerRect.bottom : null,
            titleColorMatchesPrimary: strongStyle ? strongStyle.color === primaryTextColor : true,
            titleFontWeight: strongStyle ? Number(strongStyle.fontWeight) : 0,
          });
        }

        const meta = option.querySelector(".admission-option-meta");
        if (meta && meta.offsetParent !== null) {
          const tags = Array.from(meta.querySelectorAll(".tag"));
          if (tags.length >= 2) {
            const pairGaps = [];
            for (let i = 0; i < tags.length - 1; i++) {
              const prevRect = tags[i].getBoundingClientRect();
              const nextRect = tags[i + 1].getBoundingClientRect();
              pairGaps.push({
                horizontalGap: nextRect.left - prevRect.right,
                verticalGap: nextRect.top - prevRect.bottom,
              });
            }
            metaGroups.push({
              columnGap: parseFloat(getComputedStyle(meta).columnGap) || 0,
              pairGaps,
            });
          }

          for (const tag of tags) {
            const small = tag.querySelector("small");
            const valueSpan = tag.querySelector("span");
            if (small && valueSpan) {
              const smallRect = small.getBoundingClientRect();
              const spanRect = valueSpan.getBoundingClientRect();
              metaTags.push({
                horizontalGap: spanRect.left - smallRect.right,
                verticalGap: spanRect.top - smallRect.bottom,
                smallFontSize: parseFloat(getComputedStyle(small).fontSize) || 0,
              });
            }
          }
        }
      }

      return { headers, metaGroups, metaTags };
    });

    expect(fundingLayout.headers.length).toBeGreaterThan(0);
    expect(fundingLayout.metaTags.length).toBeGreaterThan(0);
    for (const header of fundingLayout.headers) {
      expect(header.horizontalGap >= 8 || header.verticalGap >= 8).toBe(true);
      if (header.mainTopGap !== null) {
        expect(header.mainTopGap).toBeGreaterThanOrEqual(8);
      }
      expect(header.titleColorMatchesPrimary).toBe(true);
      expect(header.titleFontWeight).toBeLessThanOrEqual(600);
    }
    for (const tag of fundingLayout.metaTags) {
      expect(tag.horizontalGap >= 4 || tag.verticalGap >= 0).toBe(true);
      expect(tag.smallFontSize).toBeGreaterThanOrEqual(11);
    }
    for (const group of fundingLayout.metaGroups) {
      expect(group.columnGap).toBeGreaterThanOrEqual(6);
      for (const pair of group.pairGaps) {
        expect(pair.horizontalGap >= 4 || pair.verticalGap >= 4).toBe(true);
      }
    }

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

test("every reviewed tab ends with one bottom inset and no empty spacer rows", async ({ page }) => {
  for (const { width, height } of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    await openDetailPage(page, { theme: "light", width, height, universityId: "mit-usa-cambridge" });
    const state = page.locator("#detailState");
    if (await state.evaluate((element) => !element.textContent.trim())) await expect(state).toBeHidden();

    for (const tab of ["tab-general", "tab-programs", "tab-admission", "tab-deadlines", "tab-finance"]) {
      await page.locator(`[data-tab="${tab}"]`).click();
      await expect(page.locator(`#${tab}`)).toHaveClass(/active/);
      await page.waitForLoadState("networkidle");
      const inset = await page.locator("#detailCard .d-tab-content").evaluate((content) => {
        const leaves = [...content.querySelectorAll("*")]
          .filter((element) => !element.closest("svg, button, a, select") || element.matches("button, a, select"))
          .filter((element) => (element.children.length === 0 || element.matches("button, a, select")) && element.getClientRects().length > 0 && element.getBoundingClientRect().height > 0);
        const lastBottom = Math.max(...leaves.map((element) => element.getBoundingClientRect().bottom));
        return { bottom: Math.round(content.getBoundingClientRect().bottom - lastBottom), padding: Number.parseFloat(getComputedStyle(content).paddingBottom) };
      });
      // The tab container owns the bottom inset; nested sections must not add their own padding or margins under it.
      expect(inset.bottom, `${tab} at ${width}px`).toBeLessThanOrEqual(inset.padding + 1);
    }
  }
});

test("dark-mode nested controls inside soft cards step upward without a 1px ring", async ({ page }) => {
  await openDetailPage(page, {
    theme: "dark",
    width: 1280,
    height: 900,
    universityId: "imperial-college-london-uk",
  });
  await expect(page.locator("#detailCard")).toHaveClass(/is-mounted/);

  const measureControl = async (buttonLocator, containerSelector) => {
    await expect(buttonLocator).toBeVisible();
    const rest = await buttonLocator.evaluate((button, selector) => {
      const luminance = (color) => {
        const [r, g, b] = color.match(/[\d.]+/g).slice(0, 3).map((v) => {
          const c = Number(v) / 255;
          return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };
      const container = button.closest(selector);
      const buttonStyle = getComputedStyle(button);
      const containerStyle = getComputedStyle(container);
      const [lighter, darker] = [luminance(buttonStyle.color), luminance(buttonStyle.backgroundColor)].sort((a, b) => b - a);
      return {
        boxShadow: buttonStyle.boxShadow,
        buttonLuminance: luminance(buttonStyle.backgroundColor),
        containerLuminance: luminance(containerStyle.backgroundColor),
        contrastRatio: (lighter + 0.05) / (darker + 0.05),
      };
    }, containerSelector);

    expect(rest.boxShadow).not.toContain("0px 0px 0px 1px");
    expect(rest.buttonLuminance).toBeGreaterThan(rest.containerLuminance);
    expect(rest.contrastRatio).toBeGreaterThanOrEqual(4.5);

    await buttonLocator.hover();
    await expect.poll(() => buttonLocator.evaluate((button) => {
      const [r, g, b] = getComputedStyle(button).backgroundColor.match(/[\d.]+/g).slice(0, 3).map((v) => {
        const c = Number(v) / 255;
        return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    })).toBeGreaterThan(rest.buttonLuminance);
  };

  await measureControl(
    page.locator("#tab-general .overview-summary__levels > .overview-summary__link").first(),
    ".overview-summary__card"
  );

  await page.locator('[data-tab="tab-programs"]').click();
  await expect(page.locator("#tab-programs")).toHaveClass(/active/);
  await measureControl(
    page.locator("#tab-programs .program-card__admission-action").first(),
    ".program-card"
  );
});

test("university tabs align with the header on desktop and avoid an empty left gutter on mobile", async ({ page }) => {
  await openDetailPage(page, {
    theme: "dark",
    width: 1280,
    height: 900,
    universityId: "mit-usa-cambridge",
    language: "rus",
  });
  await expect(page.locator("#detailCard")).toHaveClass(/is-mounted/);

  const nav = page.locator(".d-tabs-nav");
  await expect(nav).not.toHaveAttribute("data-scrollable", "");
  const desktopDelta = await page.evaluate(() => {
    const titleRect = document.querySelector("#detailName").getBoundingClientRect();
    const iconRect = document.querySelector("#tab-btn-general .icon").getBoundingClientRect();
    return Math.abs(iconRect.left - titleRect.left);
  });
  expect(desktopDelta).toBeLessThanOrEqual(2);

  await openDetailPage(page, {
    theme: "dark",
    width: 390,
    height: 844,
    universityId: "mit-usa-cambridge",
    language: "rus",
  });
  await expect(page.locator("#detailCard")).toHaveClass(/is-mounted/);
  await expect(nav).toHaveAttribute("data-scrollable", "");
  await expect(page.locator("[data-tabs-previous]")).toBeDisabled();

  const mobileDelta = await page.evaluate(() => {
    const titleRect = document.querySelector("#detailName").getBoundingClientRect();
    const iconRect = document.querySelector("#tab-btn-general .icon").getBoundingClientRect();
    return Math.abs(iconRect.left - titleRect.left);
  });
  expect(mobileDelta).toBeLessThanOrEqual(2);

  await page.locator("[data-tabs-next]").click();
  await expect.poll(() => page.locator(".d-tabs").evaluate((node) => node.scrollLeft)).toBeGreaterThan(0);
  await expect(page.locator("[data-tabs-previous]")).toBeEnabled();
});
