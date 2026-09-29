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

  test("allows scrolling filters completely into view when at the top of the page on desktop", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.addInitScript(() => {
      localStorage.setItem("unisearch_universities_tour_seen_v1", "1");
    });
    await page.goto("/index.html");
    await page.waitForSelector("#universitiesList .uni-card:not(.is-skeleton)");

    const sidebar = page.locator("#uSidebar");
    await expect(sidebar).toBeVisible();

    const initialScrollY = await page.evaluate(() => window.scrollY);
    expect(initialScrollY).toBe(0);

    // Select a country with state options (e.g. USA) to reveal State/Region select and expand filter height
    await page.evaluate(() => {
      const countrySelect = document.getElementById("countrySelect");
      const usOpt = Array.from(countrySelect.options).find(o => o.value.includes("US") || o.text.includes("United States"));
      if (usOpt) {
        countrySelect.value = usOpt.value;
        countrySelect.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    await page.waitForTimeout(200);

    // Independent panels: the sidebar keeps a stable viewport-clamped height
    // that does not depend on page scroll position. At the very top of the
    // page its bottom may extend below the fold; every control stays
    // reachable through the sidebar's own inner scroll without moving the page.
    const sidebarBox = await sidebar.boundingBox();
    expect(sidebarBox).not.toBeNull();
    const sidebarHeightAtTop = sidebarBox.height;

    // Scroll sidebar to its bottom
    await page.evaluate(() => {
      const el = document.getElementById("uSidebar");
      el.scrollTop = el.scrollHeight;
    });

    // The sort strategy field (the last field in standard mode) must be fully visible within the 800px viewport
    const lastField = page.locator("#uSidebar .u-field--sort");
    await expect(lastField).toBeVisible();
    const lastFieldBox = await lastField.boundingBox();
    expect(lastFieldBox).not.toBeNull();
    expect(lastFieldBox.y + lastFieldBox.height).toBeLessThanOrEqual(800);

    // Scroll page down and verify sticky behavior remains clamped within viewport
    await page.evaluate(() => window.scrollTo(0, 350));
    await page.waitForTimeout(100);

    const scrolledSidebarBox = await sidebar.boundingBox();
    expect(scrolledSidebarBox).not.toBeNull();
    expect(scrolledSidebarBox.y).toBeCloseTo(90, 0);
    expect(scrolledSidebarBox.height).toBeCloseTo(sidebarHeightAtTop, 0);
    expect(scrolledSidebarBox.y + scrolledSidebarBox.height).toBeLessThanOrEqual(800);
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

  test("keeps filter sidebar and catalog scroll positions independent on desktop", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.addInitScript(() => {
      localStorage.setItem("unisearch_universities_tour_seen_v1", "1");
    });
    await page.goto("/index.html");
    await page.waitForSelector("#universitiesList .uni-card:not(.is-skeleton)");

    const sidebar = page.locator("#uSidebar");
    await expect(sidebar).toBeVisible();

    // Expand the filter column so it always overflows its clamped height.
    await page.evaluate(() => {
      const countrySelect = document.getElementById("countrySelect");
      const usOpt = Array.from(countrySelect.options).find(o => o.value.includes("US") || o.text.includes("United States"));
      if (usOpt) {
        countrySelect.value = usOpt.value;
        countrySelect.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    await page.waitForTimeout(200);

    const isSidebarScrollable = await page.evaluate(() => {
      const el = document.getElementById("uSidebar");
      return el.scrollHeight > el.clientHeight + 1;
    });
    expect(isSidebarScrollable).toBe(true);

    const before = await page.evaluate(() => {
      const el = document.getElementById("uSidebar");
      const box = el.getBoundingClientRect();
      return { y: box.y, height: box.height, scrollTop: el.scrollTop, pageY: window.scrollY };
    });
    expect(before.pageY).toBe(0);

    // 1. Scrolling the catalog (page) must not resize or inner-scroll the filters.
    await page.evaluate(() => window.scrollTo(0, 400));
    await page.waitForTimeout(200);

    const afterPageScroll = await page.evaluate(() => {
      const el = document.getElementById("uSidebar");
      const box = el.getBoundingClientRect();
      return { y: box.y, height: box.height, scrollTop: el.scrollTop, pageY: window.scrollY };
    });
    expect(afterPageScroll.pageY).toBeGreaterThan(0);
    expect(afterPageScroll.y).toBeCloseTo(90, 0);
    expect(afterPageScroll.height).toBeCloseTo(before.height, 0);
    expect(afterPageScroll.scrollTop).toBe(0);

    // 2. Wheeling over the catalog must not move the filter inner scroll.
    const catalogBox = await page.locator("#universitiesCatalogPane").boundingBox();
    expect(catalogBox).not.toBeNull();
    await page.mouse.move(catalogBox.x + catalogBox.width / 2, catalogBox.y + 120);
    await page.mouse.wheel(0, 400);
    await page.waitForTimeout(200);

    const afterCatalogWheel = await page.evaluate(() => {
      const el = document.getElementById("uSidebar");
      const box = el.getBoundingClientRect();
      return { y: box.y, scrollTop: el.scrollTop, pageY: window.scrollY };
    });
    expect(afterCatalogWheel.pageY).toBeGreaterThan(afterPageScroll.pageY);
    expect(afterCatalogWheel.y).toBeCloseTo(90, 0);
    expect(afterCatalogWheel.scrollTop).toBe(0);

    // 3. Wheeling at the filter scroll boundaries must not chain into page scroll.
    await page.evaluate(() => {
      const el = document.getElementById("uSidebar");
      el.scrollTop = el.scrollHeight;
    });
    await page.waitForTimeout(100);
    const sidebarBox = await sidebar.boundingBox();
    expect(sidebarBox).not.toBeNull();
    const pageYBeforeSidebarWheel = await page.evaluate(() => window.scrollY);
    await page.mouse.move(sidebarBox.x + sidebarBox.width / 2, sidebarBox.y + sidebarBox.height / 2);
    await page.mouse.wheel(0, 500);
    await page.waitForTimeout(250);

    const afterSidebarWheel = await page.evaluate(() => {
      const el = document.getElementById("uSidebar");
      return { scrollTop: el.scrollTop, scrollMax: el.scrollHeight - el.clientHeight, pageY: window.scrollY };
    });
    expect(afterSidebarWheel.scrollTop).toBeCloseTo(afterSidebarWheel.scrollMax, 0);
    expect(afterSidebarWheel.pageY).toBe(pageYBeforeSidebarWheel);
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
