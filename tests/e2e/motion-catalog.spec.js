// Catalog motion (stage 2 of docs/superpowers/specs/2026-11-25-motion-system-design.md).
const { test, expect } = require("./helpers/coverage-test.cjs");
const { setNativeSelect } = require("./helpers/selectors");
const { expectAnimating, expectInstant, installMotionRecorder, motionSeen, openCatalog } = require("./helpers/motion");

test("choosing a country with states reveals the state field in height", async ({ page }) => {
  await openCatalog(page, "no-preference");
  const stateField = page.locator("#stateDiv");
  await expect(stateField).toBeHidden();
  await setNativeSelect(page, "countrySelect", "USA");
  await expectAnimating(stateField);
  await expect(stateField).toBeVisible();
  await expect(stateField).not.toHaveClass(/motion-revealing/);
});

test("choosing a country without states collapses the state field", async ({ page }) => {
  await openCatalog(page, "no-preference");
  const stateField = page.locator("#stateDiv");
  await setNativeSelect(page, "countrySelect", "USA");
  await expect(stateField).not.toHaveClass(/motion-revealing/);
  await setNativeSelect(page, "countrySelect", "");
  const display = await stateField.evaluate((el) => getComputedStyle(el).display);
  expect(display).not.toBe("none");
  await expect(stateField).toBeHidden({ timeout: 500 });
});

test("filters restored on load appear without animation", async ({ page }) => {
  await openCatalog(page, "no-preference", "/index.html?country=USA");
  const stateField = page.locator("#stateDiv");
  await expect(stateField).toBeVisible();
  expect(await stateField.evaluate((el) => el.getAnimations().length)).toBe(0);
});

test("dependent filters reveal instantly with reduced motion", async ({ page }) => {
  await openCatalog(page, "reduce");
  await setNativeSelect(page, "countrySelect", "USA");
  await expectInstant(page.locator("#stateDiv"));
});

test("catalog disclosures grow open instead of jumping", async ({ page }) => {
  await openCatalog(page, "no-preference");
  await setNativeSelect(page, "sortSelect", "uni_ai");
  const prefs = page.locator("details#unifitPreferencesPanel");
  await expect(prefs).toBeVisible();
  await expect(prefs).not.toHaveClass(/motion-revealing/);
  // getAnimations() does not report ::details-content transitions, so sample its height instead.
  const sizes = await prefs.evaluate(async (el) => {
    const height = () => Number.parseFloat(getComputedStyle(el, "::details-content").blockSize) || 0;
    el.open = true;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const early = height();
    await new Promise((resolve) => setTimeout(resolve, 400));
    return { early, final: height() };
  });
  expect(sizes.final).toBeGreaterThan(0);
  expect(sizes.early).toBeLessThan(sizes.final);
  await expect(prefs.locator("#aiSliderContainer")).toBeVisible();
});

/** Clicks a view button and reports the incoming container's animations and position right away. */
async function switchViewAndSample(page, buttonId, containerId) {
  await page.locator(`#${buttonId}`).click();
  return page.locator(`#${containerId}`).evaluate((el) => ({
    properties: el.getAnimations().map((animation) => Object.keys(animation.effect.getKeyframes()[0] || {})).flat(),
    top: Math.round(el.getBoundingClientRect().top),
  }));
}

test("switching between list and map crossfades without movement", async ({ page }) => {
  await openCatalog(page, "no-preference");
  await expect(page.locator("#viewMapBtn")).toBeEnabled();

  const toMap = await switchViewAndSample(page, "viewMapBtn", "mapStage");
  expect(toMap.properties).toContain("opacity");
  expect(toMap.properties).not.toContain("transform");
  await page.waitForTimeout(300);
  expect(Math.round(await page.locator("#mapStage").evaluate((el) => el.getBoundingClientRect().top))).toBe(toMap.top);

  const toList = await switchViewAndSample(page, "viewListBtn", "universitiesList");
  expect(toList.properties).toContain("opacity");
});

test("view switches are instant with reduced motion", async ({ page }) => {
  await openCatalog(page, "reduce");
  await expect(page.locator("#viewMapBtn")).toBeEnabled();
  const toMap = await switchViewAndSample(page, "viewMapBtn", "mapStage");
  expect(toMap.properties).toEqual([]);
});

async function resetMotionLog(page) {
  await page.evaluate(() => { window.__motionSeen = []; });
}

async function chipMotionCount(page, className) {
  return page.evaluate((name) => document.querySelectorAll(`#compareTray .compare-tray__chip.${name}`).length, className);
}

test("compare tray animates only what changed", async ({ page }) => {
  await openCatalog(page, "no-preference");
  await page.locator("#compareModeBtn").click();
  await expect(page.locator("body")).toHaveClass(/universities-compare-mode/);
  const cards = page.locator("#universitiesList .uni-card:not(.is-skeleton)");
  await installMotionRecorder(page);

  await cards.nth(0).click();
  await expect(page.locator("#compareTray")).toBeVisible();
  await expect.poll(() => motionSeen(page, "motion-panel-enter")).toBe(true);
  await expect(page.locator("#compareTray")).not.toHaveClass(/motion-panel-enter/);

  await resetMotionLog(page);
  await cards.nth(1).click();
  await expect(page.locator("#compareTray .compare-tray__chip")).toHaveCount(2);
  // Only the new chip enters; the tray itself stays put.
  expect(await chipMotionCount(page, "motion-list-item-enter")).toBe(1);
  expect(await motionSeen(page, "motion-panel-enter")).toBe(false);

  await resetMotionLog(page);
  await cards.nth(1).click();
  await expect.poll(() => motionSeen(page, "motion-chip-remove")).toBe(true);
  await expect(page.locator("#compareTray .compare-tray__chip")).toHaveCount(1);
  expect(await motionSeen(page, "motion-panel-enter")).toBe(false);

  await page.locator('#compareTray [data-action="clear-compare"]').click();
  await expect.poll(() => motionSeen(page, "motion-tray-exit")).toBe(true);
  await expect(page.locator("#compareTray")).toBeHidden();
});

test("compare tray appears and leaves instantly with reduced motion", async ({ page }) => {
  await openCatalog(page, "reduce");
  await page.locator("#compareModeBtn").click();
  const cards = page.locator("#universitiesList .uni-card:not(.is-skeleton)");
  await cards.nth(0).click();
  await expect(page.locator("#compareTray")).toBeVisible();
  await page.locator('#compareTray [data-action="clear-compare"]').click();
  expect(await page.locator("#compareTray").evaluate((el) => el.hidden)).toBe(true);
});

test("results count fades when filters change", async ({ page }) => {
  await openCatalog(page, "no-preference");
  const count = page.locator("#totalCount");
  const before = await count.textContent();
  await page.evaluate(() => {
    const node = document.getElementById("totalCount");
    window.__countAnimations = 0;
    new MutationObserver(() => { window.__countAnimations += node.getAnimations().length; })
      .observe(node, { childList: true, characterData: true, subtree: true });
  });
  await setNativeSelect(page, "countrySelect", "USA");
  await expect(count).not.toHaveText(before);
  expect(await page.evaluate(() => window.__countAnimations)).toBeGreaterThan(0);
});

async function recordBannerKeyframes(page) {
  await page.evaluate(() => {
    window.__bannerFrames = [];
    const original = Element.prototype.animate;
    Element.prototype.animate = function animate(keyframes, options) {
      if (this.id === "unifitContextBar") window.__bannerFrames.push(keyframes);
      return original.call(this, keyframes, options);
    };
  });
}

test("UniFit toolbar context reveals smoothly to its final size and collapses when leaving UniFit sort", async ({ page }) => {
  await openCatalog(page, "no-preference");
  await recordBannerKeyframes(page);
  const banner = page.locator("#unifitContextBar");
  await setNativeSelect(page, "sortSelect", "uni_ai");
  await expect(banner).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__bannerFrames.length)).toBeGreaterThan(0);
  await expect(banner).not.toHaveClass(/motion-revealing/);
  const reveal = await page.evaluate(() => {
    const firstCall = window.__bannerFrames[0];
    const lastCall = window.__bannerFrames[window.__bannerFrames.length - 1];
    const node = document.getElementById("unifitContextBar");
    return { first: firstCall[0], last: lastCall[lastCall.length - 1], finalHeight: node.getBoundingClientRect().height };
  });
  // Padding and margins travel with the height, so nothing snaps when the reveal ends.
  expect(reveal.first).toMatchObject({ paddingTop: "0px", paddingBottom: "0px", marginBottom: "0px" });
  expect(Math.abs(Number.parseFloat(reveal.last.height) - reveal.finalHeight)).toBeLessThan(1);

  await page.evaluate(() => { window.__bannerFrames = []; });
  await setNativeSelect(page, "sortSelect", "name_asc");
  await expect.poll(() => page.evaluate(() => window.__bannerFrames.length)).toBeGreaterThan(0);
  await expect(banner).toBeHidden();
});
