const { test, expect } = require("@playwright/test");

const viewports = [
  { name: "mobile", width: 390, height: 844 },
  { name: "tablet", width: 820, height: 1180 },
];

for (const viewport of viewports) {
  test(`university detail touch targets and long text stay usable (${viewport.name})`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/university.html?id=suleyman-demirel-university-kaz-kaskelen");

    await expect(page.locator("#detailCard")).toBeVisible();
    await expect(page.locator("#detailName")).not.toHaveText("University Name");

    await page.evaluate(() => {
      const title = document.getElementById("detailName");
      if (title) {
        title.textContent =
          "International Institute of Extremely Long Demonstration University Name For Responsive Layout Validation";
      }
      const programsTab = document.querySelector(
        ".d-tab-btn[data-tab='tab-programs'] [data-i18n='university.tab.programs']"
      );
      if (programsTab) {
        programsTab.textContent = "Programs and Curriculum Structure Overview";
      }
    });

    const metrics = await page.evaluate(() => {
      const doc = document.documentElement;
      const scrolling = document.scrollingElement || doc;
      const touchLinks = Array.from(document.querySelectorAll(".d-site-link")).filter(
        (el) => el instanceof HTMLElement && el.offsetParent !== null
      );
      const tabButtons = Array.from(document.querySelectorAll(".d-tab-btn")).filter(
        (el) => el instanceof HTMLElement && el.offsetParent !== null
      );

      const minLink = touchLinks.reduce((acc, el) => {
        const rect = el.getBoundingClientRect();
        return Math.min(acc, rect.width, rect.height);
      }, Infinity);

      const minTabHeight = tabButtons.reduce((acc, el) => {
        const rect = el.getBoundingClientRect();
        return Math.min(acc, rect.height);
      }, Infinity);

      return {
        minLink,
        minTabHeight,
        scrollWidth: scrolling ? scrolling.scrollWidth : 0,
        clientWidth: scrolling ? scrolling.clientWidth : 0,
      };
    });

    expect(metrics.minLink).toBeGreaterThanOrEqual(43.5);
    expect(metrics.minTabHeight).toBeGreaterThanOrEqual(43.5);
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
  });
}
