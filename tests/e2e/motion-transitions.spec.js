// Transition motion (stage 3 of docs/superpowers/specs/2026-11-25-motion-system-design.md).
const { test, expect } = require("./helpers/coverage-test.cjs");
const { installMotionRecorder, motionSeen } = require("./helpers/motion");

async function openUniversity(page, reducedMotion, id = "mit-usa-cambridge") {
  await page.emulateMedia({ reducedMotion });
  await page.addInitScript(() => {
    localStorage.setItem("unisearch_ui_language_v1", "eng");
    localStorage.setItem("unisearch_universities_tour_seen_v1", "1");
  });
  await page.goto(`/university.html?id=${id}`);
  await expect(page.locator("#siteInitialLoader")).toBeHidden();
  await expect(page.locator(".d-tab-btn").nth(1)).toBeVisible();
}

test("university tabs slide in from the side they come from", async ({ page }) => {
  await openUniversity(page, "no-preference");
  await installMotionRecorder(page);
  await page.locator(".d-tab-btn").nth(1).click();
  await expect.poll(() => motionSeen(page, "motion-tab-forward")).toBe(true);
  await page.locator(".d-tab-btn").nth(1).press("Home");
  await expect.poll(() => motionSeen(page, "motion-tab-back")).toBe(true);
});

test("university tabs switch instantly with reduced motion", async ({ page }) => {
  await openUniversity(page, "reduce");
  await page.locator(".d-tab-btn").nth(1).click();
  const running = await page.locator(".d-tab-pane.active").evaluate((el) => el.getAnimations().length);
  expect(running).toBe(0);
});

test("comparison steps move in their direction and re-renders stay still", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.addInitScript(() => {
    localStorage.setItem("unisearch_ui_language_v1", "eng");
    localStorage.setItem("unisearch_universities_tour_seen_v1", "1");
  });
  await page.goto("/compare.html?lang=eng&ids=university-of-oxford-uk-oxford,kimep-university-kaz-almaty");
  const back = page.locator('[data-action="back-to-tracks"]');
  await expect(back).toBeVisible();
  await installMotionRecorder(page);

  await back.click();
  await expect(page.locator(".compare-config-column").first()).toBeVisible();
  await expect.poll(() => motionSeen(page, "motion-tab-back")).toBe(true);

  await page.evaluate(() => { window.__motionSeen = []; });
  await page.goBack();
  await expect(back).toBeVisible();
  await expect.poll(() => motionSeen(page, "motion-tab-forward")).toBe(true);
});
