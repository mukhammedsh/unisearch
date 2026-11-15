const { test, expect } = require("./helpers/coverage-test.cjs");

async function openUniversity(page, id, theme = "light") {
  await page.addInitScript((value) => {
    localStorage.setItem("unisearch_ui_language_v1", "eng");
    localStorage.setItem("unisearch_theme", value);
    localStorage.setItem("unisearch_universities_tour_seen_v1", "1");
  }, theme);
  await page.goto(`/university.html?id=${id}`);
  await expect(page.locator("#detailCard")).toBeVisible();
  await expect(page.locator("#detailName")).not.toBeEmpty();
}

test("the university cover credits the photo's author and license and links its Commons page", async ({ page }) => {
  await openUniversity(page, "mit-usa-cambridge");
  const credit = page.locator("#detailCover .d-cover-credit");
  await expect(credit).toBeVisible();
  await expect(credit).toHaveText(/^Photo: .+, CC BY-SA 3\.0 \(cropped\)$/);
  await expect(credit).toHaveAttribute("href", /^https:\/\/commons\.wikimedia\.org\/wiki\/File:/);
  await expect(credit).toHaveAttribute("target", "_blank");

  // The credit stays inside the cover and clear of the logo badge on a phone.
  await page.setViewportSize({ width: 375, height: 812 });
  const coverBox = await page.locator("#detailCover").boundingBox();
  const creditBox = await credit.boundingBox();
  const logoBox = await page.locator("#detailLogo").boundingBox();
  expect(creditBox.x + creditBox.width).toBeLessThanOrEqual(coverBox.x + coverBox.width);
  expect(creditBox.y + creditBox.height).toBeLessThanOrEqual(coverBox.y + coverBox.height);
  expect(creditBox.x).toBeGreaterThanOrEqual(logoBox.x + logoBox.width);
});

test("the credit follows the interface language", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("unisearch_ui_language_v1", "ru"));
  await page.goto("/university.html?id=nazarbayev-university-kaz-astana");
  await expect(page.locator("#detailCard")).toBeVisible();
  await expect(page.locator("#detailCover .d-cover-credit")).toHaveText(/^Фото: .+, CC BY-SA 4\.0 \(кадрировано\)$/);
});

test("a university without a reusable photo shows no credit", async ({ page }) => {
  // Wait for the credits file so the absence is not a race with its loading.
  const creditsLoaded = page.waitForResponse((response) => response.url().endsWith("/universities/assets/credits.json"));
  await openUniversity(page, "kimep-university-kaz-almaty");
  expect((await creditsLoaded).ok()).toBe(true);
  await expect(page.locator("#detailCover")).toBeVisible();
  await expect(page.locator("#detailCover .d-cover-credit")).toHaveCount(0);
});
