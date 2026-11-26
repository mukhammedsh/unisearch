const { test, expect } = require("./helpers/coverage-test.cjs");
const { markTourAsSeen } = require("./helpers/personas");
const { selectors, setNativeSelect } = require("./helpers/selectors");

async function installMotionRecorder(page) {
  await page.evaluate(() => {
    window.__motionSeen = [];
    window.__motionAnimations = [];
    document.addEventListener("animationstart", (event) => {
      const target = event.pseudoElement || event.target.id || event.target.classList[0];
      window.__motionAnimations.push(`${target}:${event.animationName}`);
    });
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

async function expectAnimationStarted(page, target, animation) {
  await expect.poll(() => page.evaluate(
    (prefix) => window.__motionAnimations.some((key) => key.startsWith(prefix)),
    `${target}:${animation}`,
  )).toBe(true);
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

  // All sections stay visible; the outline only marks the one that was jumped to.
  await page.click("[data-profile-tab='scores']");
  await expect(page.locator("[data-profile-tab='scores']")).toHaveAttribute("aria-current", "location");
  await expect(page.locator("[data-profile-section='scores']").first()).toBeVisible();
  await expect(page.locator("[data-profile-section='basics']").first()).toBeVisible();

  await page.click("[data-profile-tab='preferences']");
  await expect(page.locator("[data-profile-tab='preferences']")).toHaveAttribute("aria-current", "location");
  await expect(page.locator("[data-profile-tab='scores']")).not.toHaveAttribute("aria-current", "location");
  await expect(page.locator("[data-profile-section='preferences']").first()).toBeVisible();
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
  const recentTrigger = page.locator("#recentlyViewedBtn");
  await expect(recentTrigger).toBeVisible();
  await installMotionRecorder(page);

  await expect(page.locator("#savedShortlistBar")).toHaveCount(0);

  await page.locator("#compareModeBtn").click();
  await expect(page.locator("body")).toHaveClass(/universities-compare-mode/);
  const compareModeCard = page.locator(`.uni-card[data-uni-id="${firstUniversityId}"]`).first();
  await expect(compareModeCard).toBeVisible();
  await compareModeCard.click();
  await expect(compareModeCard).toHaveClass(/uni-card--compare-selected/);
  await expect(compareModeCard).toHaveAttribute("data-compare-selected", "true");
  await expect(page.locator("#compareTray")).toBeVisible();
  await expect(recentTrigger).toBeVisible();

  await recentTrigger.click();
  const recentChip = page.locator("#recentlyViewedPopover .u-recent__chip").filter({ hasText: firstUniversityName }).first();
  await expect(recentChip).toBeVisible();
  await recentChip.hover();
  await recentChip.locator("[data-action='remove-recent']").click();
  await expectMotionSeen(page, "motion-chip-remove");
  await expectMotionSeen(page, "motion-icon-remove");
  await expect(recentChip).toHaveCount(0);
  await expect(recentTrigger).toHaveCount(0);

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
  await expect(page.locator("#settingsModal")).not.toHaveAttribute("open", "");

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

test("view mode fades in the map and list while preserving their layout", async ({ page }) => {
  await markTourAsSeen(page);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/index.html");
  await expect(page.locator(".uni-card:not(.is-skeleton)").first()).toBeVisible();

  // The map results rail is populated only when map mode is selected.
  await expect(page.locator("#viewMapBtn")).toBeEnabled();
  await installMotionRecorder(page);

  await expect(page.locator(".view-toggles .sliding-indicator")).toHaveCount(0);
  await page.click("#viewMapBtn");
  const mapAnimations = await page.locator("#mapStage").evaluate((el) =>
    el.getAnimations().flatMap((animation) => Object.keys(animation.effect?.getKeyframes?.()[0] || {}))
  );
  await expect(page.locator("#viewMapBtn")).toHaveClass(/active/);
  await expect(page.locator("#viewListBtn")).not.toHaveClass(/active/);
  await expect(page.locator("#mapStage")).toBeVisible();
  expect(mapAnimations).toContain("opacity");
  expect(mapAnimations).not.toContain("transform");

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
  const listAnimations = await page.locator("#universitiesList").evaluate((el) =>
    el.getAnimations().flatMap((animation) => Object.keys(animation.effect?.getKeyframes?.()[0] || {}))
  );
  expect(listAnimations).toContain("opacity");
  expect(listAnimations).not.toContain("transform");
  await expect(page.locator("#viewListBtn")).toHaveClass(/active/);
  await expect(page.locator("#viewMapBtn")).not.toHaveClass(/active/);
  await expect(page.locator(".u-view-motion-layer")).toHaveCount(0);
  await expect(page.locator(".view-toggles .sliding-indicator")).toHaveCount(0);
  await expect(page.locator("#universitiesList .uni-card:not(.is-skeleton)").first()).toBeVisible();

  await page.reload();
  await expect(page.locator("#universitiesList .uni-card:not(.is-skeleton)").first()).toBeVisible();
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
  const aiResponsePromise = page.waitForResponse((r) => r.url().includes("/universities/ai-sort") && r.status() === 200);
  await setNativeSelect(page, "sortSelect", "uni_ai");

  await aiResponsePromise;
  await expect(page.locator(".uni-card:not(.is-skeleton)").first()).toBeVisible();

  await page.click("#viewMapBtn");
  await expect(page.locator("#viewMapBtn")).toHaveClass(/active/);
  await expect(page.locator("#mapStage")).toBeVisible();

  const cardWithStatuses = page.locator("#mapResultsPanel .uni-card:has(.uni-card-statuses > .uni-status-tooltip:nth-child(2))").first();
  await expect(cardWithStatuses).toBeVisible();

  const triggers = cardWithStatuses.locator(".uni-status-trigger");
  await expect(triggers.nth(0)).toBeVisible();
  await expect(triggers.nth(1)).toBeVisible();
  const count = await triggers.count();
  expect(count).toBeGreaterThanOrEqual(2);
  await expect.poll(async () => {
    const data = await cardWithStatuses.evaluate(card => {
      const box = element => {
        if (!element) return null;
        const rect = element.getBoundingClientRect();
        return { x: rect.x, y: rect.y, width: rect.width };
      };
      const [box0, box1] = [...card.querySelectorAll(".uni-status-trigger")].slice(0, 2).map(box);
      const titleBox = box(card.querySelector(".uni-title"));
      return { box0, box1, titleBox };
    });
    if (!data?.box0 || !data?.box1 || !data?.titleBox) return false;
    const isColumn = Math.abs(data.box0.x - data.box1.x) <= 2 && data.box1.y > data.box0.y;
    const noOverlap = (data.titleBox.x + data.titleBox.width) <= (data.box0.x + 1);
    return isColumn && noOverlap;
  }).toBe(true);
});

test("university detail category switching leaves one active pane", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/university.html?id=mit-usa-cambridge");
  await expect(page.locator("#detailCard")).toBeVisible();
  await installMotionRecorder(page);

  await page.click(".d-tab-btn[data-tab='tab-admission']");
  await expect(page.locator(".d-tab-btn[data-tab='tab-admission']")).toHaveClass(/active/);
  await expect(page.locator("#tab-admission")).toHaveClass(/active/);
  await expectAnimationStarted(page, "tab-admission", "motion-tab-forward");
  await expect(page.locator(".d-tab-pane.active")).toHaveCount(1);

  await page.click(".d-tab-btn[data-tab='tab-finance']");
  await expect(page.locator(".d-tab-btn[data-tab='tab-finance']")).toHaveClass(/active/);
  await expect(page.locator("#tab-finance")).toHaveClass(/active/);
  await expect(page.locator(".d-tab-pane.active")).toHaveCount(1);
});

test("university detail tabs stay clickable after client-side route", async ({ page }) => {
  await markTourAsSeen(page);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/index.html");

  const mitCard = page.locator(".uni-card[data-uni-id='mit-usa-cambridge']").first();
  await expect(mitCard).toBeVisible();
  await installMotionRecorder(page);
  const supportsViewTransition = await page.evaluate(() => typeof document.startViewTransition === "function");
  await mitCard.locator(".uni-card-link-overlay").click();

  await expect(page).toHaveURL(/\/university\.html\?id=mit-usa-cambridge/);
  await expect(page.locator("#detailCard")).toBeVisible();
  if (supportsViewTransition) await expectAnimationStarted(page, "::view-transition-new(root)", "");
  else await expect(page.locator("main")).toHaveClass(/route-enter/);

  await page.click(".d-tab-btn[data-tab='tab-admission']");
  await expect(page.locator(".d-tab-btn[data-tab='tab-admission']")).toHaveClass(/active/);
  await expect(page.locator("#tab-admission")).toHaveClass(/active/);
});

test("settings cross-fade the palette and apply reduced-motion changes immediately", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "no-preference" });
  await page.goto("/about.html");
  await expect(page.locator("#siteInitialLoader")).toBeHidden();
  await page.locator("#settingsBtn").click();
  const settings = page.locator("#settingsModal");
  await expect(settings).toBeVisible();
  await installMotionRecorder(page);
  const supportsViewTransition = await page.evaluate(() => typeof document.startViewTransition === "function");
  const theme = settings.getByRole("combobox", { name: "Theme", exact: true });

  await theme.click();
  await settings.getByRole("option", { name: "Dark", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  if (supportsViewTransition) await expectAnimationStarted(page, "::view-transition-new(root)", "");
  await expect(page.locator("html")).not.toHaveAttribute("data-theme-switching", /.+/);
  await expect(settings).toBeVisible();
  const rootAnimations = () => page.evaluate(() => window.__motionAnimations.filter((key) => key.startsWith("::view-transition-new(root):")));
  const animatedTheme = await rootAnimations();

  await page.emulateMedia({ reducedMotion: "reduce" });
  await theme.click();
  await settings.getByRole("option", { name: "Light", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  expect(await rootAnimations()).toEqual(animatedTheme);
});

test("Guide disclosures preserve keyboard access and honor reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/guide.html#guide-unifit");
  await expect(page.locator("#siteInitialLoader")).toBeHidden();
  const details = page.locator("#guide-unifit .guide-formula-details");
  const summary = details.locator("summary");
  await summary.press("Enter");
  await expect(details).toHaveAttribute("open", "");

  const supportsMotion = await page.evaluate(() => CSS.supports(
    "(interpolate-size: allow-keywords) and selector(details::details-content)",
  ));
  if (supportsMotion) {
    expect(await details.evaluate((element) => getComputedStyle(element, "::details-content").transitionProperty))
      .toContain("block-size");
    await expect.poll(() => details.evaluate((element) => getComputedStyle(element, "::details-content").contentVisibility))
      .toBe("visible");
  }
  await details.locator(".guide-formula").focus();
  await expect(details.locator(".guide-formula")).toBeFocused();

  await page.emulateMedia({ reducedMotion: "reduce" });
  await summary.press("Enter");
  await expect(details).not.toHaveAttribute("open", "");
  await expect(summary).toBeFocused();
  if (supportsMotion) {
    expect(await details.evaluate((element) => getComputedStyle(element, "::details-content").transitionDuration))
      .toBe("0s");
  }
});

test("calendar month changes animate the grid and keep keyboard focus", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/university.html?id=mit-usa-cambridge&admission_application_route=mit-transfer&admission_level=undergraduate&admission_route=transfer&admission_cycle=Fall+2027");
  await expect(page.locator("#admissionsContext")).toHaveAttribute("data-state", "ready");
  await page.locator('[data-tab="tab-deadlines"]').click();

  const grid = page.locator(".deadline-calendar__grid");
  await expect(grid).toBeVisible();
  const initialMonth = await grid.getAttribute("data-calendar-month-key");
  const next = page.locator('[data-calendar-month="next"]');
  const previous = page.locator('[data-calendar-month="previous"]');
  await installMotionRecorder(page);

  const firstDay = page.locator("[data-calendar-day]").first();
  await firstDay.press("Enter");
  await expect(firstDay).toHaveAttribute("aria-pressed", "true");
  await firstDay.evaluate(node => { window.__selectedCalendarDay = node; });
  await firstDay.press("Enter");
  expect(await page.evaluate(() => window.__selectedCalendarDay.isConnected)).toBe(true);

  await next.press("Enter");
  await expect(grid).not.toHaveAttribute("data-calendar-month-key", initialMonth);
  await expect(next).toBeFocused();
  await expectAnimationStarted(page, "deadline-calendar__grid", "motion-fade-lift-enter");
  await expectAnimationStarted(page, "deadline-calendar__details", "motion-fade-lift-enter");

  await page.emulateMedia({ reducedMotion: "reduce" });
  await previous.press("Enter");
  await expect(grid).toHaveAttribute("data-calendar-month-key", initialMonth);
  await expect(grid).not.toHaveClass(/motion-panel-enter/);
  await expect(previous).toBeFocused();
});

test("comparison picker animates study levels and route steps while retaining focus", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/compare.html?ids=stanford-university-usa-ca,mit-usa-cambridge");
  await page.locator('[data-compare-pick="stanford-university-usa-ca"]').click();
  const dialog = page.locator("dialog.compare-picker[open]");
  await expect(dialog.locator("[data-picker-option]").first()).toBeVisible();
  await installMotionRecorder(page);

  const masters = dialog.locator('[data-picker-level="masters"]');
  await masters.press("Enter");
  await expect(masters).toHaveAttribute("aria-pressed", "true");
  await expect(masters).toBeFocused();
  await expectAnimationStarted(page, "compare-picker__results", "motion-fade-lift-enter");

  const search = dialog.locator("#comparePickerSearch");
  await search.fill("Computer Science");
  await dialog.locator('[data-picker-option="stanford-option-cs-ms"]').click();
  await expect(dialog.locator("[data-picker-route]").first()).toBeFocused();
  await expectAnimationStarted(page, "compare-picker__body", "motion-fade-lift-enter");
  await dialog.locator("[data-picker-back]").press("Enter");
  await expect(search).toBeFocused();
  await expect(search).toHaveValue("Computer Science");
});

test("tab sliding indicators use a unified 2px full-pill line across filters and pages", async ({ page }) => {
  await markTourAsSeen(page);
  await page.goto("/index.html");
  await expect(page.locator(".uni-card:not(.is-skeleton)").first()).toBeVisible();

  // Filter tabs (.u-saved-filter)
  const filterIndicator = page.locator(".u-saved-filter .sliding-indicator");
  await expect(filterIndicator).toHaveCount(1);
  const filterStyle = await filterIndicator.evaluate((el) => {
    const cs = getComputedStyle(el);
    return {
      height: cs.height,
      borderRadius: cs.borderRadius,
      bottom: cs.bottom,
    };
  });
  expect(filterStyle.height).toBe("2px");
  expect(filterStyle.borderRadius).toBe("999px");
  expect(filterStyle.bottom).toBe("0px");

  // Hover over Favorites tab moves indicator
  const favBtn = page.locator(".u-saved-filter__btn[data-saved-filter='favorites']");
  await favBtn.hover();
  await expect.poll(async () => {
    return filterIndicator.evaluate((el) => el.style.opacity);
  }).toBe("1");

  // University detail tabs (.d-tabs)
  await page.goto("/university.html?id=mit-usa-cambridge");
  await expect(page.locator("#detailCard")).toBeVisible();
  const detailIndicator = page.locator(".d-tabs .sliding-indicator");
  await expect(detailIndicator).toHaveCount(1);
  const detailStyle = await detailIndicator.evaluate((el) => {
    const cs = getComputedStyle(el);
    return {
      height: cs.height,
      borderRadius: cs.borderRadius,
      bottom: cs.bottom,
    };
  });
  expect(detailStyle.height).toBe("2px");
  expect(detailStyle.borderRadius).toBe("999px");
  expect(detailStyle.bottom).toBe("0px");
});
