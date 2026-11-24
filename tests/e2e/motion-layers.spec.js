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

