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
    };
  });
}

test("photo viewer dialog fades out after close", async ({ page }) => {
  const viewer = await openPhotoViewer(page, "no-preference");
  const sample = await closeAndSample(viewer);
  expect(sample.open).toBe(false);
  expect(sample.display).not.toBe("none");
  expect(sample.animations).toBeGreaterThan(0);
  await expect.poll(() => viewer.evaluate((el) => getComputedStyle(el).display), { timeout: 1000 }).toBe("none");
});

test("photo viewer dialog closes instantly with reduced motion", async ({ page }) => {
  const viewer = await openPhotoViewer(page, "reduce");
  await page.waitForTimeout(50);
  await expectInstant(viewer);
  const sample = await closeAndSample(viewer);
  expect(sample).toEqual({ open: false, display: "none", animations: 0 });
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
