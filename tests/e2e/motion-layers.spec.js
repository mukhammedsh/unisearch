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
