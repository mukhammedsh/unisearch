const { test, expect } = require("@playwright/test");
const { markTourAsSeen } = require("./helpers/personas");

test.describe("Sticky Footer Verification Across Pages", () => {
  const pagesToTest = [
    { url: "/about.html", name: "About" },
    { url: "/404.html", name: "404" },
    { url: "/index.html", name: "University catalog" },
    { url: "/terms.html", name: "Terms" },
    { url: "/privacy.html", name: "Privacy" },
  ];

  test("footer sits at the bottom of the viewport on short pages at large display resolutions", async ({ page }) => {
    await markTourAsSeen(page);
    const viewportHeight = 1080;
    await page.setViewportSize({ width: 1440, height: viewportHeight });

    for (const pageItem of pagesToTest) {
      await page.goto(pageItem.url);
      const footer = page.locator("footer.site-footer");
      await expect(footer).toBeVisible();

      const footerBox = await footer.boundingBox();
      expect(footerBox).not.toBeNull();

      const footerBottom = footerBox.y + footerBox.height;
      expect(footerBottom).toBeGreaterThanOrEqual(viewportHeight - 2);

      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
    }
  });

  test("footer remains at the bottom of the viewport even with zero content", async ({ page }) => {
    await markTourAsSeen(page);
    const viewportHeight = 900;
    await page.setViewportSize({ width: 1280, height: viewportHeight });

    await page.goto("/about.html");
    await page.evaluate(() => {
      const main = document.querySelector("main");
      if (main) main.innerHTML = "";
    });

    const footer = page.locator("footer.site-footer");
    await expect(footer).toBeVisible();

    const footerBox = await footer.boundingBox();
    expect(footerBox).not.toBeNull();
    const footerBottom = footerBox.y + footerBox.height;

    expect(Math.abs(footerBottom - viewportHeight)).toBeLessThanOrEqual(2);
  });
});
