const { test, expect } = require("@playwright/test");
const { personas, seedProfile } = require("./helpers/personas");
const { mockAllExpensiveEndpoints } = require("./helpers/mocks");

const viewports = [
  { name: "narrow", width: 320, height: 568 },
  { name: "mobile", width: 390, height: 844 },
  { name: "tablet", width: 820, height: 1180 },
];

async function readHorizontalMetrics(page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const scrolling = document.scrollingElement || doc;
    return {
      viewportWidth: window.innerWidth,
      docClientWidth: doc ? doc.clientWidth : 0,
      docScrollWidth: doc ? doc.scrollWidth : 0,
      scrollClientWidth: scrolling ? scrolling.clientWidth : 0,
      scrollWidth: scrolling ? scrolling.scrollWidth : 0,
    };
  });
}

async function expectNoHorizontalOverflow(page, label) {
  const m = await readHorizontalMetrics(page);
  expect(
    m.scrollWidth,
    `${label}: scrolling root overflows (${JSON.stringify(m)})`
  ).toBeLessThanOrEqual(m.scrollClientWidth + 1);
}

async function expectNavbarControlsInsideViewport(page, label) {
  const metrics = await page.evaluate(() => {
    const selectors = [
      "#universitySearch",
      ".navbar-right .custom-select-trigger",
      "#settingsBtn",
      "#profileBtn",
    ];
    return selectors
      .map((selector) => {
        const el = document.querySelector(selector);
        if (!el) return null;
        const style = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        if (style.display === "none" || style.visibility === "hidden") return null;
        return {
          selector,
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
          viewportWidth: window.innerWidth,
        };
      })
      .filter(Boolean);
  });

  for (const m of metrics) {
    expect(m.left, `${label}: ${m.selector} starts outside viewport (${JSON.stringify(m)})`).toBeGreaterThanOrEqual(0);
    expect(m.right, `${label}: ${m.selector} ends outside viewport (${JSON.stringify(m)})`).toBeLessThanOrEqual(m.viewportWidth + 1);
  }
}

test("comparison setup keeps admission controls aligned without page overflow", async ({ page }) => {
  await mockAllExpensiveEndpoints(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/compare.html?stage=configure&ids=university-of-oxford-uk-oxford,harvard-usa-cambridge");

  const options = page.locator(".compare-config-options").first();
  const programSelector = options.locator(".admission-program-selector");
  const categoryList = options.locator(".admission-category-list");
  await expect(programSelector).toBeVisible();
  await expect(categoryList).toBeVisible();
  await programSelector.getByRole("button", { name: "Computer Science", exact: true }).click();
  await expect(categoryList).toBeVisible();

  const desktopLayout = await page.evaluate(() => {
    const selector = document.querySelector(".compare-config-options .admission-program-selector");
    const categoryList = document.querySelector(".compare-config-options .admission-category-list");
    if (!selector || !categoryList) return null;
    return {
      categoryListMarginTop: window.getComputedStyle(categoryList).marginTop,
      columnBorderWidth: window.getComputedStyle(document.querySelector(".compare-config-column")).borderTopWidth,
      selectorMarginTop: window.getComputedStyle(selector).marginTop,
      selectorScrollWidth: selector.scrollWidth,
      selectorClientWidth: selector.clientWidth,
      statsBoxBorderWidth: window.getComputedStyle(document.querySelector(".compare-config-options .track-stats-box")).borderTopWidth,
      fundingOptionBorderLeftWidth: window.getComputedStyle(document.querySelector(".compare-config-options .admission-funding-option")).borderLeftWidth,
      fundingOptionBorderTopWidth: window.getComputedStyle(document.querySelector(".compare-config-options .admission-funding-option")).borderTopWidth,
      fundingOptionRadius: window.getComputedStyle(document.querySelector(".compare-config-options .admission-funding-option")).borderTopLeftRadius,
      fundingOptionFlexWrap: window.getComputedStyle(document.querySelector(".compare-config-options .admission-funding-option")).flexWrap,
      fundingOptionMainFlex: window.getComputedStyle(document.querySelector(".compare-config-options .admission-funding-option-main")).flex,
    };
  });
  expect(desktopLayout).not.toBeNull();
  expect(desktopLayout.categoryListMarginTop).toBe("0px");
  expect(desktopLayout.columnBorderWidth).toBe("0px");
  expect(desktopLayout.selectorMarginTop).toBe("0px");
  expect(desktopLayout.selectorScrollWidth).toBeLessThanOrEqual(desktopLayout.selectorClientWidth + 1);
  expect(desktopLayout.statsBoxBorderWidth).toBe("0px");
  expect(desktopLayout.fundingOptionBorderLeftWidth).toBe("0px");
  expect(desktopLayout.fundingOptionBorderTopWidth).toBe("1px");
  expect(desktopLayout.fundingOptionRadius).toBe("0px");
  expect(desktopLayout.fundingOptionFlexWrap).toBe("nowrap");
  expect(desktopLayout.fundingOptionMainFlex).toBe("0 0 auto");

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".compare-config-panel")).toBeVisible();
  await expect(page.locator(".compare-config-column")).toHaveCount(2);
  const columns = await page.locator(".compare-config-panel").evaluate((element) => window.getComputedStyle(element).gridTemplateColumns);
  expect(columns).not.toMatch(/\s/);
  await expectNoHorizontalOverflow(page, "comparison setup mobile");
});

for (const viewport of viewports) {
  test(`no horizontal overflow on key pages (${viewport.name})`, async ({ page }) => {
    await mockAllExpensiveEndpoints(page);
    await seedProfile(page, personas.enResearch.profile);
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    });

    await page.goto("/index.html");
    await expect(page.locator(".u-layout")).toBeVisible();
    await expectNoHorizontalOverflow(page, `index ${viewport.name}`);
    await expectNavbarControlsInsideViewport(page, `index ${viewport.name}`);

    await page.goto("/index.html");
    await expect(page.locator(".u-layout")).toBeVisible();
    await page.waitForLoadState("networkidle");
    await expectNoHorizontalOverflow(page, `universities ${viewport.name}`);
    await expectNavbarControlsInsideViewport(page, `universities ${viewport.name}`);

    if (viewport.width <= 980) {
      const filterBtn = page.locator("#mobileFilterToggle");
      await expect(filterBtn).toBeVisible();
      await filterBtn.click();
      await expect(page.locator("#uSidebar")).toHaveClass(/is-open/);
      await expectNoHorizontalOverflow(page, `universities filters ${viewport.name}`);
      await page.locator("#closeMobileFilters").click();
      await expect(page.locator("#uSidebar")).not.toHaveClass(/is-open/);
    }

    await page.goto("/compare.html?stage=configure&ids=mit-usa-cambridge,imperial-college-london-uk");
    await expect(page.locator("#compareResultsPane")).toBeVisible();
    await expect(page.locator(".compare-config-column")).toHaveCount(2);
    await expect(page.locator(".track-select-btn.is-active")).toHaveCount(2);
    const continueCompareButton = page.locator("[data-action='build-compare-results']").first();
    await expect(continueCompareButton).toBeEnabled();
    await continueCompareButton.click();
    await expect(page.locator(".compare-decision-support")).toBeVisible();
    await expect(page.locator(".compare-uni-card")).toHaveCount(2);
    await expect(page.locator(".compare-table thead th")).toHaveCount(3);
    await page.waitForLoadState("networkidle");
    await expectNoHorizontalOverflow(page, `universities compare results ${viewport.name}`);

    await page.goto("/index.html?sort=rank_asc");
    await expect(page.locator("#universitiesList .uni-card:not(.is-skeleton)").first()).toBeVisible();
    await page.waitForLoadState("networkidle");
    await expectNoHorizontalOverflow(page, `universities sorted by rank ${viewport.name}`);
    await expectNavbarControlsInsideViewport(page, `universities sorted by rank ${viewport.name}`);

    await page.goto("/guide.html");
    await expect(page.locator("#guidePage")).toBeVisible();
    await page.waitForLoadState("networkidle");
    await expectNoHorizontalOverflow(page, `guide ${viewport.name}`);
    await expectNavbarControlsInsideViewport(page, `guide ${viewport.name}`);

    await page.goto("/university.html?id=mit-usa-cambridge");
    await expect(page.locator("#detailCard")).toBeVisible();
    await expect(page.locator("#detailName")).not.toHaveText("University Name");
    await page.waitForLoadState("networkidle");
    await expectNoHorizontalOverflow(page, `university detail ${viewport.name}`);
    await expectNavbarControlsInsideViewport(page, `university detail ${viewport.name}`);

    await page.click(".d-tab-btn[data-tab='tab-finance']");
    await expect(page.locator("#tab-finance")).toHaveClass(/active/);
    await expect(page.locator("#tab-finance .finance-box")).toBeVisible();
    await expectNoHorizontalOverflow(page, `university finance tab ${viewport.name}`);

    await page.click("#profileBtn");
    await expect(page.locator("#profileModal")).toHaveClass(/is-open/);
    await expectNoHorizontalOverflow(page, `profile modal ${viewport.name}`);
  });
}
