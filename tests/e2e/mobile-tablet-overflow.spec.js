const { test, expect } = require("@playwright/test");
const { personas, seedProfile } = require("./helpers/personas");

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
      "#menuToggleBtn",
      ".navbar-right .custom-select-trigger",
      "#themeToggleBtn",
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

for (const viewport of viewports) {
  test(`no horizontal overflow on key pages (${viewport.name})`, async ({ page }) => {
    await seedProfile(page, personas.enResearch.profile);
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    });

    await page.goto("/index.html");
    await expect(page.locator(".hero-section")).toBeVisible();
    await expectNoHorizontalOverflow(page, `index ${viewport.name}`);
    await expectNavbarControlsInsideViewport(page, `index ${viewport.name}`);

    if (viewport.width <= 599) {
      const menuBtn = page.locator("#menuToggleBtn");
      await expect(menuBtn).toBeVisible();
      await menuBtn.click();
      await expect(page.locator(".navbar")).toHaveClass(/is-menu-open/);
      await expectNoHorizontalOverflow(page, `index menu ${viewport.name}`);
    }

    await page.goto("/universities.html");
    await expect(page.locator(".u-layout")).toBeVisible();
    await page.waitForLoadState("networkidle");
    await expectNoHorizontalOverflow(page, `universities ${viewport.name}`);
    await expectNavbarControlsInsideViewport(page, `universities ${viewport.name}`);

    if (viewport.width <= 599) {
      const menuBtn = page.locator("#menuToggleBtn");
      await expect(menuBtn).toBeVisible();
      await menuBtn.click();
      await expect(page.locator(".navbar")).toHaveClass(/is-menu-open/);
      await expectNoHorizontalOverflow(page, `universities menu ${viewport.name}`);
    }

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

    if (viewport.width <= 599) {
      const menuBtn = page.locator("#menuToggleBtn");
      await expect(menuBtn).toBeVisible();
      await menuBtn.click();
      await expect(page.locator(".navbar")).toHaveClass(/is-menu-open/);
      await expectNoHorizontalOverflow(page, `university menu ${viewport.name}`);
    }

    await page.click("#profileBtn");
    await expect(page.locator("#profileModal")).toHaveClass(/is-open/);
    await expectNoHorizontalOverflow(page, `profile modal ${viewport.name}`);
  });
}
