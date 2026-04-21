const { test, expect } = require("@playwright/test");
const { markTourAsSeen } = require("./helpers/personas");
const { selectors } = require("./helpers/selectors");

test("profile category motion keeps tab state and reduced-motion final states stable", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/index.html");

  await page.click(selectors.profileBtn);
  await expect(page.locator(selectors.profileModal)).toHaveClass(/is-open/);

  await page.click("[data-profile-tab='scores']");
  await expect(page.locator("[data-profile-tab='scores']")).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("[data-profile-section='scores']").first()).not.toHaveClass(/is-section-hidden/);
  await expect(page.locator("[data-profile-section='basics']").first()).toHaveClass(/is-section-hidden/);

  await page.click("[data-profile-tab='preferences']");
  await expect(page.locator("[data-profile-tab='preferences']")).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("[data-profile-section='preferences']").first()).not.toHaveClass(/is-section-hidden/);
  await expect(page.locator(".is-motion-active")).toHaveCount(0);
});

test("universities favorite and compare motion preserves pressed states", async ({ page }) => {
  await markTourAsSeen(page);
  await page.goto("/universities.html");

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
  const recentChip = page.locator("#recentlyViewedBar .u-recent__chip").filter({ hasText: firstUniversityName }).first();
  await expect(recentChip).toBeVisible();

  const favorite = refreshedFirstCard.locator("[data-card-action='save']");
  await favorite.click();
  await expect(favorite).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#savedShortlistBar")).toHaveCount(0);

  const compare = refreshedFirstCard.locator("[data-card-action='compare']");
  await compare.click();
  await expect(compare).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#compareTray")).toBeVisible();
  await expect(recentChip).toBeVisible();

  await expect.poll(async () =>
    page.locator(".motion-press-pop, .motion-pop, .motion-row-exit").count()
  ).toBe(0);
});

test("university detail category switching leaves one active pane", async ({ page }) => {
  await page.goto("/university.html?id=mit-usa-cambridge");
  await expect(page.locator("#detailCard")).toBeVisible();

  await page.click(".d-tab-btn[data-tab='tab-admission']");
  await expect(page.locator(".d-tab-btn[data-tab='tab-admission']")).toHaveClass(/active/);
  await expect(page.locator("#tab-admission")).toHaveClass(/active/);
  await expect(page.locator(".d-tab-pane.active")).toHaveCount(1);

  await page.click(".d-tab-btn[data-tab='tab-finance']");
  await expect(page.locator(".d-tab-btn[data-tab='tab-finance']")).toHaveClass(/active/);
  await expect(page.locator("#tab-finance")).toHaveClass(/active/);
  await expect(page.locator(".d-tab-pane.active")).toHaveCount(1);
});
