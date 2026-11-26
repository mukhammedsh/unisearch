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

/** Records the pseudo-elements a View Transition animates, read once it is ready. */
async function recordViewTransitions(page) {
  await page.evaluate(() => {
    window.__vtNames = [];
    const original = document.startViewTransition.bind(document);
    document.startViewTransition = (callback) => {
      const transition = original(callback);
      transition.ready.then(() => {
        window.__vtNames.push(...document.getAnimations().map((animation) => animation.effect?.pseudoElement).filter(Boolean));
      }).catch(() => {});
      return transition;
    };
  });
}

async function openCatalogForCards(page, reducedMotion) {
  await page.emulateMedia({ reducedMotion });
  await page.addInitScript(() => {
    localStorage.setItem("unisearch_ui_language_v1", "eng");
    localStorage.setItem("unisearch_universities_tour_seen_v1", "1");
  });
  await page.goto("/index.html");
  await expect(page.locator(".uni-card:not(.is-skeleton) .uni-media-img").first()).toBeVisible();
}

test("opening a university from its card carries the photo into the cover", async ({ page }) => {
  await openCatalogForCards(page, "no-preference");
  const card = page.locator(".uni-card:not(.is-skeleton)").filter({ has: page.locator(".uni-media-img") }).first();
  await expect.poll(() => card.locator(".uni-media-img").evaluate((img) => img.complete && img.naturalWidth > 0)).toBe(true);
  await recordViewTransitions(page);
  const errors = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });

  await card.locator(".uni-card-link-overlay").click();
  await expect(page.locator("body")).toHaveAttribute("data-page", "university");
  await expect.poll(() => page.evaluate(() => window.__vtNames || [])).toContain("::view-transition-group(uni-cover)");

  const cover = page.locator("#detailCover");
  await expect(cover.locator(".d-gallery-preview img")).toBeVisible();
  await expect(cover.locator(".d-cover-handoff")).toHaveCount(0);
  await expect(page.locator(".vt-uni-cover")).toHaveCount(0);
  expect(errors.filter((text) => /view.?transition/i.test(text))).toEqual([]);
});

test("a card without a photo opens with the plain page fade", async ({ page }) => {
  await openCatalogForCards(page, "no-preference");
  const card = page.locator(".uni-card:not(.is-skeleton)").filter({ hasNot: page.locator(".uni-media-img") }).first();
  test.skip(await card.count() === 0, "every catalog card on the first page has a photo");
  await recordViewTransitions(page);
  await card.locator(".uni-card-link-overlay").click();
  await expect(page.locator("body")).toHaveAttribute("data-page", "university");
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => window.__vtNames || [])).not.toContain("::view-transition-group(uni-cover)");
});

test("the loading cover has the same box as the university cover", async ({ page }) => {
  for (const viewport of [{ width: 1280, height: 800 }, { width: 900, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await openUniversity(page, "reduce");
    const heights = await page.evaluate(() => {
      const loading = document.getElementById("detailLoading");
      loading.classList.add("is-visible");
      const skeletonNode = loading.querySelector(".d-loading-cover");
      const skeleton = Math.round(skeletonNode.getBoundingClientRect().height);
      const skeletonRadius = getComputedStyle(skeletonNode).borderTopLeftRadius;
      loading.classList.remove("is-visible");
      const coverNode = document.getElementById("detailCover");
      return {
        skeleton,
        cover: Math.round(coverNode.getBoundingClientRect().height),
        skeletonRadius,
        coverRadius: getComputedStyle(coverNode).borderTopLeftRadius,
      };
    });
    expect(Math.abs(heights.skeleton - heights.cover), `${viewport.width}px`).toBeLessThanOrEqual(1);
    // The carried photo lands with the cover's corners, so nothing snaps when the page mounts.
    expect(heights.skeletonRadius, `${viewport.width}px`).toBe(heights.coverRadius);
  }
});

test("guide sections come in from their direction", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.addInitScript(() => localStorage.setItem("unisearch_ui_language_v1", "eng"));
  await page.goto("/guide.html");
  const next = page.locator(".guide-section-navigation__button--next");
  await expect(next).toBeVisible();
  await installMotionRecorder(page);
  await next.click();
  await expect.poll(() => motionSeen(page, "motion-tab-forward")).toBe(true);
  await page.locator(".guide-section-navigation__button--previous").click();
  await expect.poll(() => motionSeen(page, "motion-tab-back")).toBe(true);
  expect(await motionSeen(page, "motion-state-pulse")).toBe(false);
});
