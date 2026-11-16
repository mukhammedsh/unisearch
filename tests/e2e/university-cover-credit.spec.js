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
  await expect(page.locator("#siteInitialLoader")).toBeHidden();
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
  await expect(page.getByRole("button", { name: "Увеличить фото" })).toBeVisible();
});

test("a university without a reusable photo shows no credit", async ({ page }) => {
  // Wait for the credits file so the absence is not a race with its loading.
  const creditsLoaded = page.waitForResponse((response) => response.url().endsWith("/universities/assets/credits.json"));
  await openUniversity(page, "kimep-university-kaz-almaty");
  expect((await creditsLoaded).ok()).toBe(true);
  await expect(page.locator("#detailCover")).toBeVisible();
  await expect(page.locator("#detailCover .d-cover-credit")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Enlarge photo" })).toHaveCount(0);
});

test("the cover gallery and full-size viewer keep the same photo and attribution", async ({ page }) => {
  await page.setViewportSize({ width: 2200, height: 1400 });
  await openUniversity(page, "australian-national-university-au-canberra");
  const cover = page.locator("#detailCover");
  const preview = cover.getByRole("button", { name: /Enlarge photo/ });
  const credit = cover.locator(".d-cover-credit");
  const next = cover.getByRole("button", { name: "Next photo" });
  const dot = page.getByRole("button", { name: "Photo 2 of 3", exact: true });
  await expect(preview.locator("img")).toHaveAttribute("src", /thumbnails\/australian-national-university-au-canberra\.webp$/);
  await next.click();
  await expect(dot).toHaveAttribute("aria-current", "true");
  await expect(credit).toContainText("-wuppertaler");
  await expect(preview.locator("img")).toBeVisible();
  await preview.click();

  const viewer = page.getByRole("dialog", { name: "Campus photos" });
  await expect(viewer).toHaveCSS("background-color", "rgb(0, 0, 0)");
  await expect(viewer.getByRole("button", { name: "Close" })).toBeFocused();
  const image = viewer.getByRole("img");
  await expect(image).toHaveAttribute("src", /campus-entrance-sign\.jpg$/);
  await expect(viewer.locator(".d-cover-credit")).toContainText("-wuppertaler");
  const desktopPhoto = await image.evaluate((photo) => ({
    renderedWidth: photo.width,
    naturalWidth: photo.naturalWidth,
  }));
  expect(desktopPhoto.renderedWidth).toBe(desktopPhoto.naturalWidth);
  await page.keyboard.press("ArrowRight");
  await expect(image).toHaveAttribute("src", /old-canberra-house\.jpg$/);
  await page.keyboard.press("Escape");
  await expect(viewer).toHaveCount(0);
  await expect(preview).toBeFocused();
  await expect(preview).toHaveAccessibleName("Enlarge photo · Photo 3 of 3");
  await dot.click();
  await expect(preview).toHaveAccessibleName("Enlarge photo · Photo 2 of 3");
});

test("a single campus photo opens on a small screen without carousel controls", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await openUniversity(page, "mit-usa-cambridge", "dark");
  await expect(page.locator("#detailCover .d-cover-credit")).toBeVisible();
  await expect(page.getByRole("button", { name: "Next photo" })).toHaveCount(0);
  const preview = page.getByRole("button", { name: "Enlarge photo" });
  await preview.click();
  const viewer = page.getByRole("dialog", { name: "Campus photos" });
  await expect(viewer.getByRole("button", { name: "Next photo" })).toHaveCount(0);
  const image = viewer.getByRole("img");
  await expect(image).toBeVisible();
  const box = await image.boundingBox();
  expect(box.x + box.width / 2).toBeCloseTo(375 / 2, 0);
  expect(box.y + box.height / 2).toBeCloseTo(667 / 2, 0);
  expect(box.width).toBeLessThan(await image.evaluate((photo) => photo.naturalWidth));
  await viewer.getByRole("button", { name: "Close" }).click();
  await expect(preview).toBeFocused();
});

test.describe("image recovery", () => {
  test.use({ serviceWorkers: "block" });

  test("the gallery lets the user retry a photo that failed to load", async ({ page }) => {
    let shouldFail = true;
    await page.route(/\/gallery\/[^/]+\/campus-entrance-sign\.jpg$/, (route) =>
      shouldFail ? route.fulfill({ status: 503 }) : route.continue(),
    );
    await openUniversity(page, "australian-national-university-au-canberra");
    await page.getByRole("button", { name: "Next photo" }).click();
    await page.getByRole("button", { name: /Enlarge photo/ }).click();
    const viewer = page.getByRole("dialog", { name: "Campus photos" });
    await expect(viewer.getByText("Photo unavailable")).toBeVisible();
    shouldFail = false;
    await viewer.getByRole("button", { name: "Retry" }).click();
    await expect(viewer.getByRole("img")).toBeVisible();
  });
});

test.describe("touch navigation", () => {
  test.use({ isMobile: true, hasTouch: true, viewport: { width: 320, height: 667 } });

  test("a swipe changes the photo and a tap opens it", async ({ page }) => {
    await openUniversity(page, "australian-national-university-au-canberra", "dark");
    const cover = page.locator("#detailCover");
    const preview = cover.getByRole("button", { name: /Enlarge photo/ });
    await expect(preview).toHaveAccessibleName("Enlarge photo · Photo 1 of 3");
    const overlap = await cover.evaluate((element) => {
      const arrow = element.querySelector(".d-gallery-button--previous").getBoundingClientRect();
      const logo = element.querySelector("#detailLogo").getBoundingClientRect();
      return arrow.bottom - logo.top;
    });
    expect(overlap).toBeLessThanOrEqual(0);

    const session = await page.context().newCDPSession(page);
    async function swipeLeftAt(y) {
      await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 235, y }] });
      await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 170, y }] });
      await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 90, y }] });
      await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    }
    const box = await preview.boundingBox();
    await swipeLeftAt(Math.round(box.y + box.height / 2));

    const viewer = page.getByRole("dialog", { name: "Campus photos" });
    await expect(preview).toHaveAccessibleName("Enlarge photo · Photo 2 of 3");
    await expect(viewer).toHaveCount(0);
    await preview.tap();
    await expect(viewer.getByRole("img", { name: "Photo 2 of 3" })).toBeVisible();
    await swipeLeftAt(333);
    await expect(viewer.getByRole("img", { name: "Photo 3 of 3" })).toBeVisible();
    await viewer.getByRole("button", { name: "Close" }).tap();
    await expect(preview).toHaveAccessibleName("Enlarge photo · Photo 3 of 3");
  });
});
