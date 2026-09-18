const { test, expect } = require("@playwright/test");

test.describe("Responsive Layout and Overflow Verification", () => {
  test("adjusts sidebar and mobile filter button based on desktop viewport", async ({ page }) => {
    // Set desktop viewport BEFORE loading the page
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/index.html");
    await page.waitForSelector(".uni-card");

    // On desktop, the filter sidebar must be visible
    const sidebar = page.locator("#uSidebar");
    await expect(sidebar).toBeVisible();

    // The mobile filter toggle button must be hidden
    const mobileFilterToggle = page.locator("#mobileFilterToggle");
    await expect(mobileFilterToggle).not.toBeVisible();
  });

  test("adjusts sidebar and mobile filter button based on mobile viewport", async ({ page }) => {
    // Set mobile viewport BEFORE loading the page
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/index.html");
    await page.waitForSelector(".uni-card");

    const sidebar = page.locator("#uSidebar");
    const mobileFilterToggle = page.locator("#mobileFilterToggle");

    // On mobile, the mobile filter toggle button must be visible
    await expect(mobileFilterToggle).toBeVisible();

    // The filter sidebar is hidden by default
    await expect(sidebar).not.toBeVisible();
  });

  test("keeps university card width <= 550px on desktop when single university is returned", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/index.html?q=Oxford");
    await page.waitForSelector("#universitiesList .uni-card:not(.is-skeleton)");

    const cards = page.locator("#universitiesList .uni-card:not(.is-skeleton)");
    await expect(cards).toHaveCount(1);

    const cardBox = await cards.first().boundingBox();
    expect(cardBox).not.toBeNull();
    expect(cardBox.width).toBeLessThanOrEqual(550);
    expect(cardBox.width).toBeGreaterThanOrEqual(280);
  });

  test("uses multi-column layout and caps card width on tablet/wide-mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 820, height: 1180 });
    await page.goto("/index.html");
    await page.waitForSelector("#universitiesList .uni-card:not(.is-skeleton)");

    const cards = page.locator("#universitiesList .uni-card:not(.is-skeleton)");
    await expect(cards.first()).toBeVisible();

    const firstCardBox = await cards.nth(0).boundingBox();
    const secondCardBox = await cards.nth(1).boundingBox();

    expect(firstCardBox).not.toBeNull();
    expect(secondCardBox).not.toBeNull();
    expect(firstCardBox.width).toBeLessThanOrEqual(550);
    expect(secondCardBox.width).toBeLessThanOrEqual(550);

    // Cards should be placed side-by-side in columns, not stacked full-width
    expect(Math.abs(firstCardBox.y - secondCardBox.y)).toBeLessThan(10);
    expect(secondCardBox.x).toBeGreaterThan(firstCardBox.x + firstCardBox.width / 2);
  });

  test("keeps single university card width <= 550px in wide-mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 820, height: 1180 });
    await page.goto("/index.html?q=Oxford");
    await page.waitForSelector("#universitiesList .uni-card:not(.is-skeleton)");

    const cards = page.locator("#universitiesList .uni-card:not(.is-skeleton)");
    await expect(cards).toHaveCount(1);

    const cardBox = await cards.first().boundingBox();
    expect(cardBox).not.toBeNull();
    expect(cardBox.width).toBeLessThanOrEqual(550);
    expect(cardBox.width).toBeGreaterThanOrEqual(280);
  });

  test("ensures mobile filter button and sidebar are only visible on universities page and absent on other pages", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("unisearch_universities_tour_seen_v1", "1");
    });
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/index.html");
    await page.waitForSelector(".uni-card");

    const mobileFilterToggle = page.locator("#mobileFilterToggle");
    const sidebar = page.locator("#uSidebar");

    // Visible on home/universities page
    await expect(mobileFilterToggle).toBeVisible();

    // Navigate to university details via client router link click
    await page.waitForSelector(".uni-card:not(.is-skeleton) .uni-card-link-overlay");
    const firstCardLink = page.locator(".uni-card:not(.is-skeleton) .uni-card-link-overlay").first();
    await firstCardLink.click();
    await page.waitForSelector("#detailCard");
    await expect(mobileFilterToggle).not.toBeVisible();
    await expect(sidebar).not.toBeVisible();

    // Navigate to profile page
    await page.locator("#profileBtn").click();
    await page.waitForSelector("#profilePage");
    await expect(mobileFilterToggle).not.toBeVisible();
    await expect(sidebar).not.toBeVisible();

    // Navigate to compare page
    await page.goto("/compare.html");
    await page.waitForSelector("#compareResultsPane");
    await expect(mobileFilterToggle).not.toBeVisible();
    await expect(sidebar).not.toBeVisible();

    // Navigate to guide page
    await page.goto("/guide.html");
    await page.waitForSelector("#guidePage");
    await expect(mobileFilterToggle).not.toBeVisible();
    await expect(sidebar).not.toBeVisible();

    // Return to home page and verify button is restored
    await page.goto("/index.html");
    await page.waitForSelector(".uni-card");
    await expect(mobileFilterToggle).toBeVisible();
  });

  test("keeps navbar logo left-aligned under 560px viewport", async ({ page }) => {
    for (const width of [500, 420, 375]) {
      await page.setViewportSize({ width, height: 750 });
      await page.goto("/index.html");
      await page.waitForSelector(".navbar-left .logo");

      const logoBox = await page.locator(".navbar-left .logo").boundingBox();
      const navBox = await page.locator(".navbar").boundingBox();
      expect(logoBox).not.toBeNull();
      expect(navBox).not.toBeNull();
      // On mobile (<560px), navbar padding is 10-12px. Logo must stay anchored near left edge.
      expect(logoBox.x - navBox.x).toBeLessThanOrEqual(20);
    }
  });
});
