// Shared helpers for the motion specs (docs/superpowers/specs/2026-11-25-motion-system-design.md).
const { expect } = require("@playwright/test");

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

/** Opens the catalog in English with the tour dismissed and the first cards painted. */
async function openCatalog(page, reducedMotion, path = "/index.html") {
  await page.emulateMedia({ reducedMotion });
  await page.addInitScript(() => {
    localStorage.setItem("unisearch_ui_language_v1", "eng");
    localStorage.setItem("unisearch_universities_tour_seen_v1", "1");
  });
  await page.goto(path);
  await expect(page.locator(".uni-card:not(.is-skeleton)").first()).toBeVisible();
}

/** Records every `motion-*` class added anywhere in the document. */
async function installMotionRecorder(page) {
  await page.evaluate(() => {
    window.__motionSeen = [];
    window.__motionObserver?.disconnect?.();
    window.__motionObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        String(mutation.target?.getAttribute?.("class") || "")
          .split(/\s+/)
          .filter((name) => name.startsWith("motion-"))
          .forEach((name) => window.__motionSeen.push(name));
      });
    });
    window.__motionObserver.observe(document.documentElement, { subtree: true, attributes: true, attributeFilter: ["class"] });
  });
}

async function motionSeen(page, className) {
  return page.evaluate((name) => window.__motionSeen?.includes(name) === true, className);
}

module.exports = { expectAnimating, expectInstant, installMotionRecorder, motionSeen, openCatalog };
