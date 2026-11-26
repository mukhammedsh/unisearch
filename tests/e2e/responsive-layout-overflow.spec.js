const { test, expect } = require("./helpers/coverage-test.cjs");

test.describe("Responsive Layout and Overflow Verification", () => {
  test("adjusts sidebar and mobile filter button based on desktop viewport", async ({ page }) => {
    // Set desktop viewport BEFORE loading the page
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/index.html");
    await page.waitForSelector(".uni-card");

    // On desktop, the filter sidebar must be visible
    const sidebar = page.locator("#uSidebar");
    await expect(sidebar).toBeVisible();
    await expect(sidebar.locator("#catalogLevelFilter")).toBeVisible();
    await expect(sidebar.locator("#recentlyViewedBar")).toHaveCount(0);
    await expect(page.locator("#mobileRecentSlot #recentlyViewedBar")).toHaveCount(1);

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
    await expect(sidebar.locator("#catalogLevelFilter")).toBeVisible();
    await expect(sidebar.locator("#recentlyViewedBar")).toHaveCount(0);
    await expect(page.locator("#mobileRecentSlot #recentlyViewedBar")).toHaveCount(1);

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
    await page.addInitScript(() => {
      localStorage.setItem("unisearch_ui_language_v1", "rus");
      localStorage.setItem("unisearch_recent_university_ids_v1", JSON.stringify([
        "mit-usa-cambridge",
        "imperial-college-london-uk",
        "stanford-university-usa-ca",
        "harvard-usa-cambridge",
      ]));
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/index.html?lang=rus");
    await page.waitForSelector(".uni-card:not(.is-skeleton)");

    const sidebar = page.locator("#uSidebar");
    const mobileFilterToggle = page.locator("#mobileFilterToggle");

    // On mobile, the mobile filter toggle button must be visible
    await expect(mobileFilterToggle).toBeVisible();

    // The filter sidebar is hidden by default
    await expect(sidebar).not.toBeVisible();

    // On narrow viewports where the toolbar wraps onto two rows, the actions row
    // must span the full toolbar width instead of floating right-aligned under the count.
    const toolbarLayout = await page.evaluate(() => {
      const meta = document.querySelector(".u-section-meta").getBoundingClientRect();
      const found = document.getElementById("uFoundSummary").getBoundingClientRect();
      const actions = document.querySelector(".u-section-actions").getBoundingClientRect();
      const recent = document.getElementById("recentlyViewedBtn").getBoundingClientRect();
      const filter = document.getElementById("mobileFilterToggle").getBoundingClientRect();
      const view = document.getElementById("viewToggles").getBoundingClientRect();
      const compare = document.getElementById("compareModeBtn").getBoundingClientRect();
      return { meta, found, actions, recent, filter, view, compare };
    });

    expect(Math.abs(toolbarLayout.found.left - toolbarLayout.meta.left)).toBeLessThanOrEqual(2);
    expect(Math.abs(toolbarLayout.actions.left - toolbarLayout.meta.left)).toBeLessThanOrEqual(2);
    expect(Math.abs(toolbarLayout.actions.right - toolbarLayout.meta.right)).toBeLessThanOrEqual(2);
    expect(toolbarLayout.actions.top).toBeGreaterThanOrEqual(toolbarLayout.found.bottom - 1);
    expect(Math.abs(toolbarLayout.recent.top - toolbarLayout.filter.top)).toBeLessThanOrEqual(2);
    expect(Math.abs(toolbarLayout.filter.top - toolbarLayout.view.top)).toBeLessThanOrEqual(2);
    expect(Math.abs(toolbarLayout.view.top - toolbarLayout.compare.top)).toBeLessThanOrEqual(2);
    expect(toolbarLayout.view.left).toBeGreaterThan(toolbarLayout.filter.right + 8);
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
    await expect(sidebar.locator("#catalogLevelFilter")).toBeVisible();
    await expect(sidebar.locator("#recentlyViewedBar")).toHaveCount(0);
    await expect(page.locator("#mobileRecentSlot #recentlyViewedBar")).toHaveCount(1);

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

    // The unscrolled filter column must end inside the viewport, so a scrolled-to-the-end
    // panel is visibly at its end before the page itself is scrolled.
    const viewportHeight = page.viewportSize().height;
    expect(before.y + before.height).toBeLessThanOrEqual(viewportHeight);

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

  test("closed filter dropdowns do not leave empty scroll space below the filter card", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("unisearch_universities_tour_seen_v1", "1");
    });

    // On a tall viewport where all default filters fit, the sidebar should not scroll at all.
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto("/index.html");
    await page.waitForSelector("#universitiesList .uni-card:not(.is-skeleton)");

    const tallMetrics = await page.evaluate(() => {
      const sb = document.getElementById("uSidebar");
      const card = sb.querySelector(".u-filter-card");
      const padBottom = parseFloat(getComputedStyle(sb).paddingBottom) || 0;
      return {
        scrollHeight: sb.scrollHeight,
        clientHeight: sb.clientHeight,
        expectedHeight: card.offsetHeight + padBottom,
      };
    });
    expect(tallMetrics.scrollHeight).toBeLessThanOrEqual(tallMetrics.expectedHeight + 2);
    expect(tallMetrics.scrollHeight).toBeLessThanOrEqual(tallMetrics.clientHeight + 1);

    // On a compact desktop viewport, scrolling to the bottom should stop at the card with no void below it,
    // and opening the bottom Sort dropdown should flip upward inside the sidebar.
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/index.html");
    await page.waitForSelector("#universitiesList .uni-card:not(.is-skeleton)");

    const compactMetrics = await page.evaluate(() => {
      const sb = document.getElementById("uSidebar");
      const card = sb.querySelector(".u-filter-card");
      const padBottom = parseFloat(getComputedStyle(sb).paddingBottom) || 0;
      sb.scrollTop = sb.scrollHeight;
      const sbRect = sb.getBoundingClientRect();
      const cardRect = card.getBoundingClientRect();
      return {
        scrollHeight: sb.scrollHeight,
        expectedHeight: card.offsetHeight + padBottom,
        gapBelowCard: sbRect.bottom - cardRect.bottom,
        padBottom,
      };
    });
    expect(compactMetrics.scrollHeight).toBeLessThanOrEqual(compactMetrics.expectedHeight + 2);
    expect(compactMetrics.gapBelowCard).toBeLessThanOrEqual(compactMetrics.padBottom + 2);

    const sortWrapper = page.locator(".custom-select-wrapper", { has: page.locator("#sortSelect") });
    await sortWrapper.locator(".custom-select-trigger").click();
    await expect(sortWrapper).toHaveClass(/\bopen\b/);
    await expect(sortWrapper).toHaveClass(/\bopen-up\b/);
    const panelInBounds = await page.evaluate(() => {
      const sb = document.getElementById("uSidebar");
      const opts = document.getElementById("custom-options-sortSelect");
      const sbRect = sb.getBoundingClientRect();
      const optsRect = opts.getBoundingClientRect();
      return optsRect.top >= sbRect.top - 1 && optsRect.bottom <= sbRect.bottom + 1;
    });
    expect(panelInBounds).toBe(true);
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

  test("fills single-column cards, keeps language trigger padding symmetric, and anchors filter overlays", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("unisearch_universities_tour_seen_v1", "1");
    });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/index.html?lang=rus");
    await page.waitForSelector("#universitiesList .uni-card:not(.is-skeleton)");

    for (const width of [607, 640]) {
      await page.setViewportSize({ width, height: 911 });
      const cardMetrics = await page.evaluate(() => {
        const grid = document.getElementById("universitiesList");
        const card = grid?.querySelector(".uni-card:not(.is-skeleton)");
        const cols = getComputedStyle(grid).gridTemplateColumns.split(" ").map(Number.parseFloat);
        return { trackWidth: cols[0], cardWidth: card.getBoundingClientRect().width };
      });
      expect(cardMetrics.trackWidth - cardMetrics.cardWidth, `single-column card fill at ${width}px`).toBeLessThanOrEqual(2);
    }

    for (const vp of [
      { width: 1280, height: 900 },
      { width: 1001, height: 941 },
      { width: 768, height: 900 },
      { width: 640, height: 911 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(vp);
      const pad = await page.evaluate(() => {
        const trigger = document.querySelector(".navbar-right .lang-control .custom-select-trigger");
        const cs = getComputedStyle(trigger);
        return { left: Number.parseFloat(cs.paddingLeft), right: Number.parseFloat(cs.paddingRight) };
      });
      expect(Math.abs(pad.left - pad.right), `symmetric lang padding at ${vp.width}px`).toBeLessThanOrEqual(1);
    }

    for (const vp of [
      { width: 1001, height: 941, mode: "drawer" },
      { width: 768, height: 900, mode: "drawer" },
      { width: 607, height: 911, mode: "sheet" },
      { width: 375, height: 812, mode: "sheet" },
    ]) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.locator("#mobileFilterToggle").click();
      await expect(page.locator("#uSidebar")).toHaveClass(/is-open/);

      const overlay = await page.evaluate(() => {
        const sidebar = document.getElementById("uSidebar");
        const card = sidebar.querySelector(".u-filter-card");
        const sr = sidebar.getBoundingClientRect();
        const cr = card.getBoundingClientRect();
        const ccs = getComputedStyle(card);
        return {
          innerHeight: window.innerHeight,
          sidebarBottom: sr.bottom,
          cardLeft: cr.left,
          cardBottom: cr.bottom,
          borderRadius: ccs.borderRadius,
          bottomLeftRadius: ccs.borderBottomLeftRadius,
          bottomRightRadius: ccs.borderBottomRightRadius,
        };
      });

      expect(Math.abs(overlay.sidebarBottom - overlay.innerHeight), `${vp.width}px backdrop reaches viewport bottom`).toBeLessThanOrEqual(1);
      expect(Math.abs(overlay.cardBottom - overlay.innerHeight), `${vp.width}px filter card reaches viewport bottom`).toBeLessThanOrEqual(1);
      if (vp.mode === "drawer") {
        expect(Math.abs(overlay.cardLeft), `${vp.width}px drawer flush to left edge`).toBeLessThanOrEqual(1);
        expect(overlay.borderRadius, `${vp.width}px drawer has no rounded corners`).toBe("0px");
      } else {
        expect(overlay.bottomLeftRadius, `${vp.width}px sheet bottom-left radius`).toBe("0px");
        expect(overlay.bottomRightRadius, `${vp.width}px sheet bottom-right radius`).toBe("0px");
      }

      await page.locator("#closeMobileFilters").click();
      await expect(page.locator("#uSidebar")).not.toHaveClass(/is-open/);
    }
  });
});
