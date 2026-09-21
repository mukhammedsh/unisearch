const { test, expect } = require("@playwright/test");
const { markTourAsSeen } = require("./helpers/personas");
const { selectors, setNativeSelect } = require("./helpers/selectors");

async function installMotionRecorder(page) {
  await page.evaluate(() => {
    window.__motionSeen = [];
    window.__motionObserver?.disconnect?.();
    window.__motionObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        const className = String(mutation.target?.getAttribute?.("class") || "");
        className
          .split(/\s+/)
          .filter((name) => name.startsWith("motion-"))
          .forEach((name) => window.__motionSeen.push(name));
      });
    });
    window.__motionObserver.observe(document.documentElement, {
      subtree: true,
      attributes: true,
      attributeFilter: ["class"],
    });
  });
}

async function expectMotionSeen(page, className) {
  await expect.poll(async () =>
    page.evaluate((name) => window.__motionSeen?.includes(name) === true, className)
  ).toBe(true);
}

async function expectNoLingeringMotionClasses(page) {
  await expect.poll(async () =>
    page.locator([
      ".motion-press-pop",
      ".motion-pop",
      ".motion-state-pulse",
      ".motion-state-pulse--compare",
      ".motion-icon-save",
      ".motion-icon-unsave",
      ".motion-icon-compare-add",
      ".motion-icon-compare-remove",
      ".motion-icon-remove",
      ".motion-icon-clear",
      ".motion-switch-toggle",
      ".motion-row-exit",
      ".motion-chip-remove",
      ".motion-card-remove",
      ".motion-panel-enter",
      ".motion-list-item-enter",
    ].join(", ")).count()
  ).toBe(0);
}

test("profile category motion keeps tab state and reduced-motion final states stable", async ({ page }) => {
  await markTourAsSeen(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/index.html");

  await page.click(selectors.profileBtn);
  await expect(page.locator(selectors.profileModal)).toHaveClass(/is-open/);

  await page.click("[data-profile-tab='scores']");
  await expect(page.locator("[data-profile-tab='scores']")).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("[data-profile-section='scores']").first()).not.toHaveClass(/is-section-hidden/);
  await expect(page.locator("[data-profile-section='basics']").first()).toHaveClass(/is-section-hidden/);

  await page.click("[data-profile-tab='preferences']");
  await expect(page.locator("[data-profile-tab='preferences']")).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("[data-profile-section='preferences']").first()).not.toHaveClass(/is-section-hidden/);
  await expect(page.locator(".is-motion-active")).toHaveCount(0);
});

test("universities compare motion preserves pressed states", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await markTourAsSeen(page);
  await page.goto("/index.html");

  const firstCard = page.locator(".uni-card:not(.is-skeleton)").first();
  await expect(firstCard).toBeVisible();
  const firstUniversityId = await firstCard.getAttribute("data-uni-id");
  const firstUniversityName = (await firstCard.locator(".uni-title").innerText()).trim();

  await page.evaluate((id) => {
    localStorage.setItem("unisearch_recent_university_ids_v1", JSON.stringify([id]));
  }, firstUniversityId);
  await page.reload();

  const refreshedFirstCard = page.locator(".uni-card:not(.is-skeleton)").first();
  await expect(refreshedFirstCard).toBeVisible();
  const recentChip = page.locator("#recentlyViewedBar .u-recent__chip").filter({ hasText: firstUniversityName }).first();
  await expect(recentChip).toBeVisible();
  await installMotionRecorder(page);

  await expect(page.locator("#savedShortlistBar")).toHaveCount(0);

  await page.locator("#compareModeBtn").click();
  await expect(page.locator("body")).toHaveClass(/universities-compare-mode/);
  const compareModeCard = page.locator(`.uni-card[data-uni-id="${firstUniversityId}"]`).first();
  await expect(compareModeCard).toBeVisible();
  await compareModeCard.click();
  await expect(compareModeCard).toHaveClass(/uni-card--compare-selected/);
  await expect(compareModeCard).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("#compareTray")).toBeVisible();
  await expect(recentChip).toBeVisible();

  await recentChip.hover();
  await recentChip.locator("[data-action='remove-recent']").click();
  await expectMotionSeen(page, "motion-chip-remove");
  await expectMotionSeen(page, "motion-icon-remove");
  await expect(recentChip).toHaveCount(0);

  await expectNoLingeringMotionClasses(page);
});

test("floating motion layers close cleanly and stay above docked controls", async ({ page }) => {
  await markTourAsSeen(page);
  await page.goto("/index.html");

  await page.click("#settingsBtn");
  await expect(page.locator("#settingsModal")).toHaveClass(/is-open/);
  await page.keyboard.press("Escape");
  await expect(page.locator("#settingsModal")).toHaveClass(/is-closing/);
  await expect.poll(async () =>
    page.locator("#settingsModal.is-open, #settingsModal.is-closing").count()
  ).toBe(0);
  await expect(page.locator("#settingsModal")).toHaveAttribute("aria-hidden", "true");

  await page.goto("/index.html");
  await page.evaluate(() => localStorage.removeItem("unisearch_profile"));
  await expect(page.locator(".uni-card:not(.is-skeleton)").first()).toBeVisible();

  await page.evaluate(() => {
    const select = document.getElementById("sortSelect");
    select.value = "uni_ai";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  const warningModal = page.locator("#unifitWarningModal");
  await expect(warningModal).toHaveClass(/is-open/);
  await page.keyboard.press("Escape");
  await expect(warningModal).toHaveClass(/is-closing/);
  await expect.poll(async () =>
    page.locator("#unifitWarningModal.is-open, #unifitWarningModal.is-closing").count()
  ).toBe(0);
  await expect(warningModal).toHaveAttribute("aria-hidden", "true");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.click("#mobileFilterToggle");
  await expect(page.locator("#uSidebar")).toHaveClass(/is-open/);
  const layers = await page.evaluate(() => {
    const asNumber = (value) => Number.parseInt(String(value || "0"), 10) || 0;
    return {
      drawer: asNumber(getComputedStyle(document.getElementById("uSidebar")).zIndex),
      dockedControl: asNumber(getComputedStyle(document.getElementById("mobileFilterToggle")).zIndex),
    };
  });
  expect(layers.drawer).toBeGreaterThan(layers.dockedControl);
});

test("mobile settings layer uses sheet motion without breaking reduced motion", async ({ page }) => {
  await markTourAsSeen(page);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/index.html");

  await page.click("#settingsBtn");
  await expect(page.locator("#settingsModal")).toHaveClass(/is-open/);
  await expect.poll(async () =>
    page.locator("#settingsModal .settings-card").evaluate((node) => getComputedStyle(node).animationName)
  ).toBe("motion-sheet-in");
  await installMotionRecorder(page);
  await page.locator(".settings-switch").first().click();
  await expectMotionSeen(page, "motion-switch-toggle");
  await expectNoLingeringMotionClasses(page);

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.keyboard.press("Escape");
  await expect.poll(async () =>
    page.locator("#settingsModal.is-open, #settingsModal.is-closing").count()
  ).toBe(0);
});

test("view mode toggle changes views without a content transition", async ({ page }) => {
  await markTourAsSeen(page);
  await page.goto("/index.html");
  await expect(page.locator(".uni-card:not(.is-skeleton)").first()).toBeVisible();

  // The map results rail is populated only when map mode is selected.
  await expect(page.locator("#viewMapBtn")).toBeEnabled();

  await expect(page.locator(".view-toggles .sliding-indicator")).toHaveCount(0);
  await page.click("#viewMapBtn");
  await expect(page.locator("#viewMapBtn")).toHaveClass(/active/);
  await expect(page.locator("#viewListBtn")).not.toHaveClass(/active/);
  await expect(page.locator("#mapStage")).toBeVisible();

  const mapCard = page.locator("#mapResultsPanel .uni-card:not(.is-skeleton)").first();
  await expect(page.locator(".u-view-motion-layer")).toHaveCount(0);

  const mapBox = await page.locator("#mapContainer").boundingBox();
  const resultsBox = await page.locator("#mapResultsPanel").boundingBox();
  expect(mapBox && resultsBox).toBeTruthy();
  expect(mapBox.x).toBeLessThan(resultsBox.x);
  expect(mapBox.width).toBeGreaterThan(resultsBox.width);

  await expect(mapCard).toBeVisible();
  const gaps = await page.evaluate(() => {
    const panel = document.getElementById("mapResultsPanel");
    const cardEl = panel.querySelector(".uni-card:not(.is-skeleton)");
    if (!panel || !cardEl) return null;
    const pRect = panel.getBoundingClientRect();
    const cRect = cardEl.getBoundingClientRect();
    return {
      leftGap: Math.round(cRect.left - pRect.left),
      rightGap: Math.round(pRect.right - cRect.right),
      cardWidth: Math.round(cRect.width),
      panelWidth: Math.round(pRect.width),
    };
  });
  expect(gaps).toBeTruthy();
  expect(Math.abs(gaps.leftGap - gaps.rightGap)).toBeLessThanOrEqual(1);

  const cardWithStatuses = page.locator("#mapResultsPanel .uni-card:has(.uni-card-statuses)").first();
  if (await cardWithStatuses.count() > 0) {
    const triggers = cardWithStatuses.locator(".uni-status-trigger");
    const triggerCount = await triggers.count();
    if (triggerCount >= 2) {
      const box0 = await triggers.nth(0).boundingBox();
      const box1 = await triggers.nth(1).boundingBox();
      expect(box0 && box1).toBeTruthy();
      expect(box1.y).toBeGreaterThan(box0.y);
    }
    const titleBox = await cardWithStatuses.locator(".uni-title").boundingBox();
    const firstTriggerBox = await triggers.first().boundingBox();
    if (titleBox && firstTriggerBox) {
      expect(titleBox.x + titleBox.width).toBeLessThanOrEqual(firstTriggerBox.x + 1);
    }
  }

  await expect(page.locator(".view-toggles .sliding-indicator")).toHaveCount(0);
  await expect.poll(async () =>
    page.locator("#viewListBtn.motion-press-pop, #viewListBtn.motion-state-pulse, #viewMapBtn.motion-press-pop, #viewMapBtn.motion-state-pulse").count()
  ).toBe(0);

  await page.click("#viewListBtn");
  await expect(page.locator("#viewListBtn")).toHaveClass(/active/);
  await expect(page.locator("#viewMapBtn")).not.toHaveClass(/active/);
  await expect(page.locator(".u-view-motion-layer")).toHaveCount(0);
  await expect(page.locator(".view-toggles .sliding-indicator")).toHaveCount(0);
  await expect(page.locator("#universitiesList .uni-card:not(.is-skeleton)").first()).toBeVisible();

  await page.reload();
  await expect(page.locator("#universitiesList .uni-card:not(.is-skeleton)").first()).toBeVisible();
  await expect(page.locator("#mapResultsPanel .uni-card:not(.is-skeleton)").first()).toBeAttached();
  await page.click("#viewMapBtn");
  await expect(page.locator("#mapStage")).toBeVisible();
  await page.click("#viewListBtn");
  await expect(page.locator("#viewListBtn")).toHaveClass(/active/);
  await expect(page.locator(".u-view-motion-layer")).toHaveCount(0);
});

test("map results rail renders status badges in vertical column without overlapping title", async ({ page }) => {
  await markTourAsSeen(page);
  await page.addInitScript(() => {
    localStorage.setItem(
      "unisearch_profile",
      JSON.stringify({
        budget: 50000,
        budget_vs_prestige: 20,
        vibe: { focus: 80, atmosphere: 70, finance: 20, location: 60 },
      })
    );
  });
  await page.goto("/index.html");
  await expect(page.locator(".uni-card:not(.is-skeleton)").first()).toBeVisible();
  await setNativeSelect(page, "sortSelect", "uni_ai");

  const confirmBtn = page.locator("#unifitWarningModal [data-action='confirm']");
  if (await confirmBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
    await confirmBtn.click();
    await expect(page.locator("#unifitWarningModal")).toBeHidden();
  }

  await page.click("#viewMapBtn");
  await expect(page.locator("#viewMapBtn")).toHaveClass(/active/);
  await expect(page.locator("#mapStage")).toBeVisible();

  const cardWithStatuses = page.locator("#mapResultsPanel .uni-card:has(.uni-card-statuses > .uni-status-tooltip:nth-child(2))").first();
  await expect(cardWithStatuses).toBeVisible();

  const triggers = cardWithStatuses.locator(".uni-status-trigger");
  const count = await triggers.count();
  expect(count).toBeGreaterThanOrEqual(2);

  const box0 = await triggers.nth(0).boundingBox();
  const box1 = await triggers.nth(1).boundingBox();
  expect(box0 && box1).toBeTruthy();
  expect(Math.abs(box0.x - box1.x)).toBeLessThanOrEqual(2);
  expect(box1.y).toBeGreaterThan(box0.y);

  const titleBox = await cardWithStatuses.locator(".uni-title").boundingBox();
  expect(titleBox).toBeTruthy();
  expect(titleBox.x + titleBox.width).toBeLessThanOrEqual(box0.x + 1);
});

test("university detail category switching leaves one active pane", async ({ page }) => {
  await page.goto("/university.html?id=mit-usa-cambridge");
  await expect(page.locator("#detailCard")).toBeVisible();

  await page.click(".d-tab-btn[data-tab='tab-admission']");
  await expect(page.locator(".d-tab-btn[data-tab='tab-admission']")).toHaveClass(/active/);
  await expect(page.locator("#tab-admission")).toHaveClass(/active/);
  await expect(page.locator(".d-tab-pane.active")).toHaveCount(1);

  await page.click(".d-tab-btn[data-tab='tab-finance']");
  await expect(page.locator(".d-tab-btn[data-tab='tab-finance']")).toHaveClass(/active/);
  await expect(page.locator("#tab-finance")).toHaveClass(/active/);
  await expect(page.locator(".d-tab-pane.active")).toHaveCount(1);
});

test("university detail tabs stay clickable after client-side route", async ({ page }) => {
  await markTourAsSeen(page);
  await page.goto("/index.html");

  const mitCard = page.locator(".uni-card[data-uni-id='mit-usa-cambridge']").first();
  await expect(mitCard).toBeVisible();
  await mitCard.locator(".uni-card-link-overlay").click();

  await expect(page).toHaveURL(/\/university\.html\?id=mit-usa-cambridge/);
  await expect(page.locator("#detailCard")).toBeVisible();

  await page.click(".d-tab-btn[data-tab='tab-admission']");
  await expect(page.locator(".d-tab-btn[data-tab='tab-admission']")).toHaveClass(/active/);
  await expect(page.locator("#tab-admission")).toHaveClass(/active/);
});
