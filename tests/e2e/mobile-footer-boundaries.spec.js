import { expect, test } from "./helpers/coverage-test.mjs";

for (const viewport of [
  { name: "phone", width: 390, expectStacked: true, expectLegalSingleRow: false, expectedVisibleDividers: 0 },
  { name: "tablet-portrait", width: 733, expectStacked: true, expectLegalSingleRow: true, expectedVisibleDividers: 3 },
  { name: "tablet-landscape", width: 1024, expectStacked: false, expectLegalSingleRow: true, expectedVisibleDividers: 4 },
]) {
for (const theme of ["light", "dark"]) {
test(`responsive footer keeps links single-line and GitHub aligned on the right (${viewport.name}, ${theme})`, async ({ page }) => {
  await page.setViewportSize({ width: viewport.width, height: 844 });
  await page.addInitScript((selectedTheme) => localStorage.setItem("unisearch_theme", selectedTheme), theme);
  await page.goto("/index.html");
  await expect(page.locator(".uni-card:not(.is-skeleton)").first()).toBeVisible();

  await page.evaluate(() => {
    const select = document.getElementById("languageSelect");
    select.value = "rus";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await expect(page.locator(".footer-legal-links a[data-route='privacy']")).toHaveText("Политика конфиденциальности");

  // Keep inline dot separators when links share a row, and hide them as rows wrap.
  const visibleDividers = await page.locator(".site-footer .footer-divider").evaluateAll((dividers) =>
    dividers.filter((divider) => getComputedStyle(divider).display !== "none").length
  );
  expect(visibleDividers).toBe(viewport.expectedVisibleDividers);

  // Every footer link stays on a single line (no forced mid-phrase line breaks).
  const linkLineCounts = await page.locator(".footer-legal-links a").evaluateAll((links) =>
    links.map((link) => {
      const range = document.createRange();
      range.selectNodeContents(link);
      return range.getClientRects().length;
    })
  );
  expect(linkLineCounts).toEqual([1, 1, 1, 1]);

  // GitHub sits on the top row to the right of the copyright rather than taking its own row below.
  const topRowAlignment = await page.locator(".site-footer").evaluate((footer) => {
    const copyBox = footer.querySelector(".footer-copy").getBoundingClientRect();
    const githubBox = footer.querySelector(".social-links a").getBoundingClientRect();
    return {
      githubRightOfCopy: githubBox.left > copyBox.right,
      topDelta: Math.abs(Math.round(githubBox.top - copyBox.top)),
    };
  });
  expect(topRowAlignment.githubRightOfCopy).toBe(true);
  expect(topRowAlignment.topDelta).toBeLessThanOrEqual(12);

  // On tablet portrait/landscape, both Russian legal links share one horizontal row.
  const legalTops = await page.locator(".footer-legal-links:not(.footer-product-links) a").evaluateAll((links) =>
    links.map((link) => Math.round(link.getBoundingClientRect().top))
  );
  if (viewport.expectLegalSingleRow) {
    expect(Math.abs(legalTops[0] - legalTops[1])).toBeLessThanOrEqual(2);
  }

  // No horizontal overflow at this viewport width.
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);

  // On narrow viewports with the floating mobile filter toggle, keep it above the footer.
  if (viewport.expectStacked) {
    await page.locator("footer.site-footer").scrollIntoViewIfNeeded();
    await expect.poll(() => page.locator("#mobileFilterToggle").evaluate((button) => {
      const footer = document.querySelector("footer.site-footer");
      const buttonBox = button.getBoundingClientRect();
      const footerBox = footer.getBoundingClientRect();
      return Math.round(footerBox.top - buttonBox.bottom);
    })).toBeGreaterThanOrEqual(16);
  }
});
}
}
