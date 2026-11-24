// Catalog motion (stage 2 of docs/superpowers/specs/2026-11-25-motion-system-design.md).
const { test, expect } = require("./helpers/coverage-test.cjs");
const { setNativeSelect } = require("./helpers/selectors");
const { expectAnimating, expectInstant, openCatalog } = require("./helpers/motion");

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
  const help = page.locator("details.catalog-cost-help");
  // getAnimations() does not report ::details-content transitions, so sample its height instead.
  const sizes = await help.evaluate(async (el) => {
    const height = () => Number.parseFloat(getComputedStyle(el, "::details-content").blockSize) || 0;
    el.open = true;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const early = height();
    await new Promise((resolve) => setTimeout(resolve, 400));
    return { early, final: height() };
  });
  expect(sizes.final).toBeGreaterThan(0);
  expect(sizes.early).toBeLessThan(sizes.final);
  await expect(help.locator("p")).toBeVisible();
});
