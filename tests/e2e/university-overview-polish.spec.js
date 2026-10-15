const { test, expect } = require("@playwright/test");

for (const { theme, viewport } of [
  { theme: "light", viewport: { width: 1280, height: 900 } },
  { theme: "dark", viewport: { width: 390, height: 844 } },
]) {
  test(`overview facts and tag hover are readable in ${theme} theme`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.addInitScript((chosenTheme) => {
      localStorage.setItem("unisearch_theme", chosenTheme);
    }, theme);
    await page.goto("/university.html?id=mit-usa-cambridge");
    await expect(page.locator("#detailCard")).toHaveClass(/is-mounted/);
    await expect(page.locator("#detailExtra .uni-tag").first()).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);

    const factWeights = await page.locator("#detailRecommendations .d-kv").first().evaluate((row) =>
      Array.from(row.children).map((child) => getComputedStyle(child).fontWeight));
    expect(factWeights).toEqual(["400", "400"]);

    const tag = page.locator("#detailExtra .uni-tag").first();
    const resting = await tag.evaluate((node) => ({
      background: getComputedStyle(node).backgroundColor,
      color: getComputedStyle(node).color,
    }));
    await tag.hover();
    const hovered = await tag.evaluate((node) => ({
      background: getComputedStyle(node).backgroundColor,
      color: getComputedStyle(node).color,
    }));
    expect(hovered.background).not.toBe(resting.background);
    expect(hovered.color).not.toBe(resting.color);
  });
}
