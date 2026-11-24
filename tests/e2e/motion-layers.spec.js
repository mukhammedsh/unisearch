// Floating-layer motion (stage 1 of docs/superpowers/specs/2026-11-25-motion-system-design.md):
// layers animate in and out with the shared tokens, and reduced motion lands on the final state at once.
const { test, expect } = require("./helpers/coverage-test.cjs");

/** Asserts the element has no running animations or transitions and is fully opaque. */
async function expectInstant(locator) {
  const state = await locator.evaluate((el) => ({
    animations: el.getAnimations().length,
    opacity: getComputedStyle(el).opacity,
  }));
  expect(state).toEqual({ animations: 0, opacity: "1" });
}

/** Asserts the element has at least one running animation or transition right after an action. */
async function expectAnimating(locator) {
  const running = await locator.evaluate((el) => el.getAnimations().length);
  expect(running).toBeGreaterThan(0);
}

test("motion tokens for floating layers are defined on :root", async ({ page }) => {
  await page.goto("/index.html");
  const tokens = await page.evaluate(() => {
    const styles = getComputedStyle(document.documentElement);
    return {
      offset: styles.getPropertyValue("--motion-offset-sm").trim(),
      tooltipDelay: styles.getPropertyValue("--motion-tooltip-delay").trim(),
    };
  });
  expect(tokens).toEqual({ offset: "4px", tooltipDelay: "200ms" });
});


async function openPhotoViewer(page, reducedMotion) {
  await page.emulateMedia({ reducedMotion });
  await page.addInitScript(() => {
    localStorage.setItem("unisearch_ui_language_v1", "eng");
    localStorage.setItem("unisearch_universities_tour_seen_v1", "1");
  });
  await page.goto("/university.html?id=australian-national-university-au-canberra");
  await expect(page.locator("#siteInitialLoader")).toBeHidden();
  await page.locator("#detailCover").getByRole("button", { name: /Enlarge photo/ }).press("Enter");
  await expect(page.getByRole("dialog", { name: "Campus photos" })).toBeVisible();
  // A CSS locator keeps resolving after close; role locators drop the dialog once it is hidden.
  return page.locator(".d-photo-viewer");
}

/** Closes a dialog and reads its state in the same frame, before any exit transition can finish. */
async function closeAndSample(locator) {
  return locator.evaluate((dialog) => {
    dialog.close();
    return {
      open: dialog.open,
      display: getComputedStyle(dialog).display,
      animations: dialog.getAnimations().length,
      pointerEvents: getComputedStyle(dialog).pointerEvents,
    };
  });
}

test("photo viewer dialog fades out after close", async ({ page }) => {
  const viewer = await openPhotoViewer(page, "no-preference");
  const sample = await closeAndSample(viewer);
  expect(sample.open).toBe(false);
  expect(sample.display).not.toBe("none");
  expect(sample.animations).toBeGreaterThan(0);
  // A click right after closing must reach the page, not the fading layer.
  expect(sample.pointerEvents).toBe("none");
  await expect.poll(() => viewer.evaluate((el) => getComputedStyle(el).display), { timeout: 1000 }).toBe("none");
});

test("photo viewer dialog closes instantly with reduced motion", async ({ page }) => {
  const viewer = await openPhotoViewer(page, "reduce");
  await page.waitForTimeout(50);
  await expectInstant(viewer);
  const sample = await closeAndSample(viewer);
  expect(sample).toMatchObject({ open: false, display: "none", animations: 0 });
});

async function openCatalog(page, reducedMotion) {
  await page.emulateMedia({ reducedMotion });
  await page.addInitScript(() => {
    localStorage.setItem("unisearch_ui_language_v1", "eng");
    localStorage.setItem("unisearch_universities_tour_seen_v1", "1");
  });
  await page.goto("/index.html");
  await expect(page.locator(".uni-card:not(.is-skeleton)").first()).toBeVisible();
}

function sortSelect(page) {
  const wrapper = page.locator(".custom-select-wrapper").filter({ has: page.locator("#sortSelect") });
  return {
    wrapper,
    trigger: wrapper.locator(".custom-select-trigger"),
    panel: wrapper.locator(".custom-options"),
  };
}

test("catalog select unfolds with motion and survives a rapid reopen", async ({ page }) => {
  await openCatalog(page, "no-preference");
  const { trigger, panel } = sortSelect(page);
  await trigger.click();
  await expectAnimating(panel);

  // Close and reopen inside one frame: the panel must end open, opaque and interactive.
  await trigger.evaluate((button) => { button.click(); button.click(); });
  await expect(panel).toBeVisible();
  await expect.poll(() => panel.evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
  await expect(panel.locator(".custom-option").first()).toBeVisible();
  await expect(panel).toHaveCSS("pointer-events", "auto");

  await page.keyboard.press("Escape");
  await expect(panel).toHaveCSS("pointer-events", "none");
  await expect(panel).toBeHidden();
});

test("catalog select opens and closes instantly with reduced motion", async ({ page }) => {
  await openCatalog(page, "reduce");
  const { trigger, panel } = sortSelect(page);
  await trigger.click();
  await expectInstant(panel);
  await page.keyboard.press("Escape");
  const display = await panel.evaluate((el) => getComputedStyle(el).display);
  expect(display).toBe("none");
});

async function showSearchSuggestions(page) {
  await page.locator("#qInput").fill("Harvard");
  const container = page.locator(".navbar-search-suggestions");
  await expect(container.locator(".navbar-search-suggestion").first()).toBeVisible();
  await expect.poll(() => container.evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
  return container;
}

test("closed search suggestions fade out without catching clicks", async ({ page }) => {
  await openCatalog(page, "no-preference");
  const container = await showSearchSuggestions(page);
  const box = await container.locator(".navbar-search-suggestion").first().boundingBox();

  await page.locator("#qInput").fill("");
  await expect(container).toHaveCSS("pointer-events", "none");
  const hit = await page.evaluate(({ x, y }) => Boolean(document.elementFromPoint(x, y)?.closest(".navbar-search-suggestions")),
    { x: box.x + box.width / 2, y: box.y + box.height / 2 });
  expect(hit).toBe(false);
  await expect(container).toBeHidden();
});

test("search suggestions appear instantly with reduced motion", async ({ page }) => {
  await openCatalog(page, "reduce");
  const container = await showSearchSuggestions(page);
  await expectInstant(container);
});

function filterTooltips(page) {
  const wraps = page.locator(":is(.u-info-wrap, .ui-tooltip-wrap, .uni-status-tooltip):visible");
  return { first: wraps.nth(0), second: wraps.nth(1) };
}

function bubbleOf(wrap) {
  return wrap.locator(":scope > :is(.u-tooltip, .ui-tooltip-bubble, .uni-status-tooltip__content)");
}

async function bubbleDelay(wrap) {
  return bubbleOf(wrap).evaluate((el) => getComputedStyle(el).transitionDelay.split(",")[0].trim());
}

test("tooltip hover waits for intent while focus and warm hover open at once", async ({ page }) => {
  await openCatalog(page, "no-preference");
  const { first, second } = filterTooltips(page);

  await first.locator("button").first().hover();
  expect(await bubbleDelay(first)).toBe("0.2s");
  await expect(bubbleOf(first)).toBeVisible();

  // Moving straight to a neighbouring tooltip skips the intent delay.
  await second.locator("button").first().hover();
  expect(await bubbleDelay(second)).toBe("0s");

  await page.mouse.move(0, 0);
  await page.waitForTimeout(500);
  await second.locator("button").first().focus();
  await expectAnimating(bubbleOf(second));
  expect(await bubbleDelay(second)).toBe("0s");
  await expect(bubbleOf(second)).toBeVisible();
});

test("tooltips appear instantly with reduced motion", async ({ page }) => {
  await openCatalog(page, "reduce");
  const { first } = filterTooltips(page);
  await first.locator("button").first().focus();
  await expectInstant(bubbleOf(first));
});

test("hover intent delays the fade but not display, so viewport clamping can measure the bubble", async ({ page }) => {
  await openCatalog(page, "no-preference");
  const { first } = filterTooltips(page);
  await first.locator("button").first().hover();
  const delays = await bubbleOf(first).evaluate((el) => {
    const styles = getComputedStyle(el);
    const props = styles.transitionProperty.split(",").map((value) => value.trim());
    const values = styles.transitionDelay.split(",").map((value) => value.trim());
    return Object.fromEntries(props.map((prop, index) => [prop, values[index % values.length]]));
  });
  expect(delays).toMatchObject({ opacity: "0.2s", visibility: "0.2s", display: "0s" });
});

test("clearing the catalog search keeps suggestions filled while they fade out", async ({ page }) => {
  await openCatalog(page, "no-preference");
  const container = await showSearchSuggestions(page);
  const afterClear = await page.locator("#qInput").evaluate((input) => {
    input.value = "";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    const node = document.querySelector(".navbar-search-suggestions");
    return { open: node.classList.contains("is-open"), items: node.querySelectorAll(".navbar-search-suggestion").length };
  });
  expect(afterClear.open).toBe(false);
  expect(afterClear.items).toBeGreaterThan(0);
  await expect(container).toBeHidden();
  await expect(container.locator(".navbar-search-suggestion")).toHaveCount(0);
});

test("removing a recently viewed university does not replay the popover entrance", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("unisearch_recent_university_ids_v1", JSON.stringify([
      "stanford-university-usa-ca",
      "nazarbayev-university-kaz-astana",
    ]));
  });
  await openCatalog(page, "no-preference");
  await page.locator("#recentlyViewedBtn").click();
  const popover = page.locator("#recentlyViewedPopover");
  await expect(popover).toBeVisible();
  await expect.poll(() => popover.evaluate((el) => getComputedStyle(el).opacity)).toBe("1");

  await page.evaluate(() => {
    window.__popoverTransitions = 0;
    document.addEventListener("transitionrun", (event) => {
      if (event.target.id === "recentlyViewedPopover") window.__popoverTransitions += 1;
    });
  });
  await popover.locator('[data-action="remove-recent"]').first().click();
  await expect(page.locator('#recentlyViewedPopover [data-action="remove-recent"]')).toHaveCount(1);
  await expect(page.locator("#recentlyViewedPopover")).toBeVisible();
  expect(await page.evaluate(() => window.__popoverTransitions)).toBe(0);
});

test("compare program picker fades out before it is removed", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.addInitScript(() => {
    localStorage.setItem("unisearch_ui_language_v1", "eng");
    localStorage.setItem("unisearch_universities_tour_seen_v1", "1");
  });
  await page.goto("/compare.html?ids=stanford-university-usa-ca,nazarbayev-university-kaz-astana");
  await page.locator('[data-compare-pick="stanford-university-usa-ca"]').click();
  const dialog = page.locator("dialog.compare-picker");
  await expect(dialog).toBeVisible();
  const sample = await closeAndSample(dialog);
  expect(sample.open).toBe(false);
  expect(sample.animations).toBeGreaterThan(0);
  // The `close` event fires on the next task; the dialog must survive it until the fade ends.
  const midExit = await dialog.evaluate(async (el) => {
    await new Promise((resolve) => setTimeout(resolve, 40));
    return { connected: el.isConnected, display: getComputedStyle(el).display };
  });
  expect(midExit.connected).toBe(true);
  expect(midExit.display).not.toBe("none");
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('[data-compare-pick="stanford-university-usa-ca"]')).toBeFocused();
});

test("compare program picker keeps its bottom-sheet entrance on phones", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.addInitScript(() => {
    localStorage.setItem("unisearch_ui_language_v1", "eng");
    localStorage.setItem("unisearch_universities_tour_seen_v1", "1");
  });
  await page.goto("/compare.html?ids=stanford-university-usa-ca,nazarbayev-university-kaz-astana");
  await page.locator('[data-compare-pick="stanford-university-usa-ca"]').click();
  const names = await page.locator("dialog.compare-picker").evaluate((el) => el.getAnimations().map((a) => a.animationName || a.transitionProperty));
  expect(names).toContain("motion-sheet-in");
});
