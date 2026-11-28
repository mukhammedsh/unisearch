const { test, expect } = require("./helpers/coverage-test.cjs");
const { markTourAsSeen } = require("./helpers/personas");

const MIT_ID = "mit-usa-cambridge";
const IMPERIAL_ID = "imperial-college-london-uk";
const STANFORD_ID = "stanford-university-usa-ca";
const HARVARD_ID = "harvard-usa-cambridge";

const MATRIX_VIEWPORTS = [
  { width: 360, height: 800 },
  { width: 503, height: 918 },
  { width: 607, height: 911 },
  { width: 768, height: 900 },
  { width: 1001, height: 941 },
  { width: 1280, height: 900 },
];

const SECONDARY_VIEWPORTS = MATRIX_VIEWPORTS.slice(0, 5);
const HARVARD_VIEWPORTS = [{ width: 320, height: 640 }, ...SECONDARY_VIEWPORTS];

async function syncLanguageFromUrl(page) {
  await page.addInitScript(() => {
    const lang = new URLSearchParams(window.location.search).get("lang");
    if (lang) {
      localStorage.setItem("unisearch_ui_language_v1", lang);
    }
  });
}

/**
 * Collect horizontal overflow, hidden/closed tooltip leakage, and out-of-bounds open tooltip
 * defects across the active document for the given audit step label.
 */
async function collectResponsiveIssues(page, label) {
  return page.evaluate((stepLabel) => {
    const issues = [];
    const clientWidth = document.documentElement.clientWidth;
    const scrollWidth = document.documentElement.scrollWidth;
    const isInsideHorizontalScroller = (el) => {
      let cur = el.parentElement;
      while (cur && cur !== document.body && cur !== document.documentElement) {
        const ox = getComputedStyle(cur).overflowX;
        if (ox === "auto" || ox === "scroll") {
          return true;
        }
        cur = cur.parentElement;
      }
      return false;
    };

    if (scrollWidth > clientWidth + 1) {
      const offenders = [];
      for (const el of document.querySelectorAll("body *")) {
        if (el.closest(".leaflet-pane, .leaflet-control-container") || isInsideHorizontalScroller(el)) continue;
        const cs = getComputedStyle(el);
        if (cs.display === "none" || cs.visibility === "hidden") continue;
        const rect = el.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) continue;
        if (rect.right > clientWidth + 1.5 || rect.left < -1.5) {
          const id = el.id ? `#${el.id}` : "";
          const cls = typeof el.className === "string"
            ? el.className.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((c) => `.${c}`).join("")
            : "";
          offenders.push(`${el.tagName.toLowerCase()}${id}${cls}[${Math.round(rect.left)}..${Math.round(rect.right)}]`);
          if (offenders.length >= 6) break;
        }
      }
      issues.push(`${stepLabel}: horizontal overflow scrollWidth=${scrollWidth} > clientWidth=${clientWidth}${offenders.length ? ` (${offenders.join(", ")})` : ""}`);
    }

    const bubbleSelector = ".ui-tooltip-bubble, .u-tooltip, .profile-tooltip, .d-tooltip, .uni-status-tooltip__content";
    const wrapSelector = ".ui-tooltip-wrap, .u-info-wrap, .profile-info-wrap, .d-info-wrap, .uni-status-tooltip";
    for (const bubble of document.querySelectorAll(bubbleSelector)) {
      const wrap = bubble.closest(wrapSelector);
      const cs = getComputedStyle(bubble);
      const isActive = Boolean(
        wrap && !wrap.classList.contains("is-closed") && (
          wrap.classList.contains("is-open")
          || wrap.matches(":focus-within")
          || wrap.matches(":hover")
        )
      );
      if (!isActive) {
        if (cs.display !== "none") {
          issues.push(`${stepLabel}: closed tooltip keeps display=${cs.display}`);
        }
        continue;
      }
      const rect = bubble.getBoundingClientRect();
      if (rect.width > 0 && (rect.left < -1 || rect.right > clientWidth + 1)) {
        issues.push(`${stepLabel}: active tooltip bounds [${Math.round(rect.left)}..${Math.round(rect.right)}] exceed 0..${clientWidth}`);
      }
    }

    return issues;
  }, label);
}

test.describe("Responsive Audit Matrix", () => {
  test("catalog list, overlays, settings, search, and map view stay clean across mobile to desktop widths", async ({ page }) => {
    await markTourAsSeen(page);
    await page.addInitScript(({ recentIds }) => {
      localStorage.setItem("unisearch_ui_language_v1", "rus");
      localStorage.setItem("unisearch_recent_university_ids_v1", JSON.stringify(recentIds));
      localStorage.removeItem("unisearch_compare_university_ids_v1");
    }, { recentIds: [MIT_ID, IMPERIAL_ID, STANFORD_ID, HARVARD_ID] });
    await page.emulateMedia({ reducedMotion: "reduce" });

    await page.setViewportSize(MATRIX_VIEWPORTS[0]);
    await page.goto("/index.html?lang=rus");
    await expect(page.locator("body")).toHaveAttribute("data-page", "universities");
    await expect(page.locator("#universitiesList .uni-card:not(.is-skeleton)").first()).toBeVisible();
    await expect(page.locator("#viewMapBtn")).toBeEnabled();

    for (const vp of MATRIX_VIEWPORTS) {
      await page.setViewportSize(vp);
      const prefix = `catalog@${vp.width}`;

      expect(await collectResponsiveIssues(page, `${prefix}:list`)).toEqual([]);

      const recentBtn = page.locator("#recentlyViewedBtn");
      if (await recentBtn.isVisible()) {
        await recentBtn.click();
        await expect(page.locator("#recentlyViewedPopover")).toBeVisible();
        expect(await collectResponsiveIssues(page, `${prefix}:recent`)).toEqual([]);
        await page.keyboard.press("Escape");
      }

      await page.locator("#compareModeBtn").click();
      await expect(page.locator("body")).toHaveClass(/universities-compare-mode/);
      if ((await page.locator("#compareTray .compare-tray__chip").count()) < 2) {
        const firstCard = page.locator("#universitiesList .uni-card:not(.uni-card--compare-selected):not(.uni-card--compare-unavailable)").first();
        await firstCard.click();
        const secondCard = page.locator("#universitiesList .uni-card:not(.uni-card--compare-selected):not(.uni-card--compare-unavailable)").first();
        if ((await secondCard.count()) && (await page.locator("#compareTray .compare-tray__chip").count()) < 2) {
          await secondCard.click();
        }
      }
      await expect(page.locator("#compareTray")).toBeVisible();
      expect(await collectResponsiveIssues(page, `${prefix}:compare-tray`)).toEqual([]);
      await page.locator("#compareModeBtn").click();
      await expect(page.locator("body")).not.toHaveClass(/universities-compare-mode/);

      const filterToggle = page.locator("#mobileFilterToggle");
      if (await filterToggle.isVisible()) {
        await filterToggle.click();
        await expect(page.locator("#uSidebar")).toHaveClass(/is-open/);
        expect(await collectResponsiveIssues(page, `${prefix}:filter-overlay`)).toEqual([]);
        const overlayMetrics = await page.evaluate(() => {
          const sidebar = document.getElementById("uSidebar");
          const card = sidebar?.querySelector(".u-filter-card");
          return {
            innerHeight: window.innerHeight,
            sidebarBottom: sidebar?.getBoundingClientRect().bottom ?? 0,
            cardBottom: card?.getBoundingClientRect().bottom ?? 0,
          };
        });
        expect(overlayMetrics.sidebarBottom, `${prefix} filter backdrop reaches bottom`).toBeGreaterThanOrEqual(overlayMetrics.innerHeight - 1);
        expect(overlayMetrics.cardBottom, `${prefix} filter card reaches bottom`).toBeGreaterThanOrEqual(overlayMetrics.innerHeight - 1);
        await page.locator("#closeMobileFilters").click();
        await expect(page.locator("#uSidebar")).not.toHaveClass(/is-open/);
      }

      await page.locator("#settingsBtn").click();
      await expect(page.locator("#settingsModal")).toHaveAttribute("open", "");
      expect(await collectResponsiveIssues(page, `${prefix}:settings`)).toEqual([]);
      await page.locator("#settingsCloseBtn").click();
      await expect(page.locator("#settingsModal")).not.toHaveAttribute("open", "");

      const searchToggle = page.locator("#navbarSearchToggle");
      if (await searchToggle.isVisible()) {
        await searchToggle.click();
        await expect(page.locator("#qInput")).toBeVisible();
        await page.locator("#qInput").fill("MIT");
        expect(await collectResponsiveIssues(page, `${prefix}:mobile-search`)).toEqual([]);
        const clearBtn = page.locator("#searchClearBtn");
        if (await clearBtn.isVisible()) {
          await clearBtn.click();
        }
        await page.locator("#navbarSearchBack").click();
      }

      await page.locator("#viewMapBtn").click();
      await expect(page.locator("#viewMapBtn")).toHaveAttribute("aria-pressed", "true");
      expect(await collectResponsiveIssues(page, `${prefix}:map`)).toEqual([]);
      await page.locator("#viewListBtn").click();
      await expect(page.locator("#viewListBtn")).toHaveAttribute("aria-pressed", "true");
    }
  });

  test("MIT reviewed tabs and opened term tooltips clamp within narrow mobile viewports in rus and kaz", async ({ page }) => {
    await syncLanguageFromUrl(page);
    await page.emulateMedia({ reducedMotion: "reduce" });

    for (const lang of ["rus", "kaz"]) {
      for (const width of [360, 503]) {
        await page.setViewportSize({ width, height: 880 });
        await page.goto(`/university.html?id=${MIT_ID}&lang=${lang}`);
        await expect(page.locator("body")).toHaveAttribute("data-page", "university");
        await expect(page.locator("#detailCard")).toBeVisible();
        await expect(page.locator("#admissionsContext")).toHaveAttribute("data-state", "ready");

        const tabs = page.locator(".d-tab-btn");
        const tabCount = await tabs.count();
        let openedTooltips = 0;
        for (let i = 0; i < tabCount; i++) {
          const tab = tabs.nth(i);
          if (!(await tab.isVisible())) continue;
          const tabId = await tab.getAttribute("data-tab") || `tab-${i}`;
          await tab.click();
          expect(await collectResponsiveIssues(page, `mit@${width}:${lang}:${tabId}:closed`)).toEqual([]);

          const triggers = page.locator("main .ui-tooltip-trigger, main .d-info");
          const triggerCount = await triggers.count();
          for (let t = 0; t < triggerCount; t++) {
            const trigger = triggers.nth(t);
            if (!(await trigger.isVisible())) continue;
            await trigger.scrollIntoViewIfNeeded();
            await trigger.dispatchEvent("pointerdown", { pointerType: "touch", bubbles: true });
            await trigger.dispatchEvent("click", { bubbles: true, cancelable: true, detail: 1 });
            openedTooltips += 1;
            expect(await collectResponsiveIssues(page, `mit@${width}:${lang}:${tabId}:tooltip-${t}`)).toEqual([]);
            await page.keyboard.press("Escape");
          }
        }
        expect(openedTooltips, `mit@${width}:${lang} opened tooltips`).toBeGreaterThan(0);
      }
    }
  });

  test("Harvard legacy tabs stack funding options cleanly with zero horizontal overflow", async ({ page }) => {
    await syncLanguageFromUrl(page);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize(HARVARD_VIEWPORTS[0]);
    await page.goto(`/university.html?id=${HARVARD_ID}&lang=rus`);
    await expect(page.locator("body")).toHaveAttribute("data-page", "university");
    await expect(page.locator("#detailCard")).toBeVisible();

    for (const vp of HARVARD_VIEWPORTS) {
      await page.setViewportSize(vp);
      const tabs = page.locator(".d-tab-btn");
      const tabCount = await tabs.count();
      let checkedFundingOptions = 0;
      for (let i = 0; i < tabCount; i++) {
        const tab = tabs.nth(i);
        if (!(await tab.isVisible())) continue;
        const tabId = await tab.getAttribute("data-tab") || `tab-${i}`;
        await tab.click();
        expect(await collectResponsiveIssues(page, `harvard@${vp.width}:${tabId}`)).toEqual([]);

        const fundingAudit = await page.evaluate(() => {
          const cw = document.documentElement.clientWidth;
          const visibleOptions = Array.from(document.querySelectorAll(".admission-funding-option"))
            .filter((el) => el.getBoundingClientRect().width > 0);
          const bad = [];
          for (const el of visibleOptions) {
            const r = el.getBoundingClientRect();
            if (r.left < -1 || r.right > cw + 1) {
              bad.push(`option[${Math.round(r.left)}..${Math.round(r.right)}]>${cw}`);
            }
            for (const note of el.querySelectorAll(".admission-funding-diff-note, .admission-funding-option-main")) {
              const nr = note.getBoundingClientRect();
              if (nr.width > 0 && (nr.left < -1 || nr.right > cw + 1)) {
                bad.push(`note[${Math.round(nr.left)}..${Math.round(nr.right)}]>${cw}`);
              }
            }
          }
          return { count: visibleOptions.length, bad };
        });
        expect(fundingAudit.bad, `harvard@${vp.width}:${tabId} funding bounds`).toEqual([]);
        checkedFundingOptions += fundingAudit.count;
      }
      expect(checkedFundingOptions, `harvard@${vp.width} funding options`).toBeGreaterThan(0);
    }
  });

  test("secondary and informational pages fit cleanly across tablet and mobile breakpoints", async ({ page }) => {
    await markTourAsSeen(page);
    await syncLanguageFromUrl(page);
    await page.emulateMedia({ reducedMotion: "reduce" });

    const targets = [
      { url: `/compare.html?lang=rus&ids=${MIT_ID},${STANFORD_ID}`, ready: "[data-reviewed-comparison] .compare-reviewed__head" },
      { url: "/profile.html?lang=rus", ready: "[data-profile-tab]" },
      { url: "/profile.html?lang=kaz", ready: "[data-profile-tab]" },
      { url: "/guide.html?lang=rus", ready: "main" },
      { url: "/about.html?lang=rus", ready: "main" },
      { url: "/privacy.html?lang=rus", ready: "main" },
      { url: "/404.html?lang=rus", ready: "main" },
    ];

    for (const target of targets) {
      await page.setViewportSize(SECONDARY_VIEWPORTS[0]);
      await page.goto(target.url);
      await expect(page.locator(target.ready).first()).toBeVisible();

      for (const vp of SECONDARY_VIEWPORTS) {
        await page.setViewportSize(vp);
        expect(await collectResponsiveIssues(page, `${target.url}@${vp.width}`)).toEqual([]);
      }
    }
  });
});
