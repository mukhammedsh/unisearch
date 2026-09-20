import { expect, test } from "@playwright/test";

for (const viewport of [{ name: "phone", width: 390 }, { name: "tablet", width: 733 }]) {
for (const theme of ["light", "dark"]) {
test(`mobile footer keeps navigation separators attached and filters above the footer (${viewport.name}, ${theme})`, async ({ page }) => {
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

  const outerDividerVisibility = await page.locator(".footer-meta > .footer-divider").evaluateAll((dividers) =>
    dividers.map((divider) => getComputedStyle(divider).display !== "none")
  );
  expect(outerDividerVisibility).toEqual([false, false]);

  const footerDividers = await page.locator(".footer-legal-links").evaluateAll((navigations) =>
    navigations.map((navigation) => {
      const navigationBox = navigation.getBoundingClientRect();
      const dividerBox = navigation.querySelector(".footer-divider").getBoundingClientRect();
      return Math.abs((dividerBox.left + dividerBox.width / 2) - (navigationBox.left + navigationBox.width / 2));
    })
  );
  expect(footerDividers).toEqual([0, 0]);

  const legalLinkRows = await page.locator(".footer-legal-links:not(.footer-product-links) a").evaluateAll((links) =>
    links.map((link) => Math.round(link.getBoundingClientRect().height / parseFloat(getComputedStyle(link).lineHeight)))
  );
  expect(legalLinkRows).toEqual([2, 2]);

  await page.locator("footer.site-footer").scrollIntoViewIfNeeded();
  await expect.poll(() => page.locator("#mobileFilterToggle").evaluate((button) => {
    const footer = document.querySelector("footer.site-footer");
    const buttonBox = button.getBoundingClientRect();
    const footerBox = footer.getBoundingClientRect();
    return Math.round(footerBox.top - buttonBox.bottom);
  })).toBeGreaterThanOrEqual(16);
});
}
}
