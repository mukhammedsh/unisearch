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

    const strip = page.locator("#detailRecommendations .d-facts-strip");
    await expect(strip).toBeVisible();
    const stripHeightBefore = Math.round((await strip.boundingBox()).height);

    const factMetrics = await strip.locator(".d-kv").evaluateAll((cards) =>
      cards.map((card) => {
        const label = card.querySelector(".d-kv-label");
        const valueNode = card.querySelector(".d-kv-metric");
        const cardRect = card.getBoundingClientRect();
        const valueRect = valueNode ? valueNode.getBoundingClientRect() : null;
        return {
          labelText: (label?.textContent || "").trim(),
          labelWeight: label ? getComputedStyle(label).fontWeight : "",
          valueWeight: valueNode ? getComputedStyle(valueNode).fontWeight : "",
          cardTop: Math.round(cardRect.top),
          valueOffsetFromCardTop: valueRect ? Math.round(valueRect.top - cardRect.top) : null,
        };
      }));
    expect(factMetrics.length).toBeGreaterThanOrEqual(3);
    for (const metric of factMetrics) {
      expect(metric.labelText.endsWith(":")).toBe(false);
      expect(metric.labelWeight).toBe("500");
      expect(metric.valueWeight).toBe("600");
    }
    // Cells on the same grid row must align their primary values at the top with no vertical gap.
    const sameRowOffsets = factMetrics
      .filter((metric) => Math.abs(metric.cardTop - factMetrics[0].cardTop) <= 2)
      .map((metric) => metric.valueOffsetFromCardTop);
    expect(Math.max(...sameRowOffsets) - Math.min(...sameRowOffsets)).toBeLessThanOrEqual(4);

    // Expanding the shared sources disclosure must reveal verified links without stretching the stat strip.
    const sourcesSummary = page.locator("#detailRecommendations .d-facts-sources__summary");
    await expect(sourcesSummary).toBeVisible();
    await sourcesSummary.click();
    await expect(page.locator("#detailRecommendations .d-facts-sources")).toHaveAttribute("open", "");
    await expect(page.locator("#detailRecommendations .d-fact-source__link").first()).toBeVisible();
    const stripHeightAfter = Math.round((await strip.boundingBox()).height);
    expect(Math.abs(stripHeightAfter - stripHeightBefore)).toBeLessThanOrEqual(2);
    await sourcesSummary.click();
    await expect(page.locator("#detailRecommendations .d-facts-sources")).not.toHaveAttribute("open", "");

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
    expect(hovered.color).toBe(resting.color);
  });
}
