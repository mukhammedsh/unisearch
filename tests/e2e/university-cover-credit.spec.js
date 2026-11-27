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
  const credit = page.locator(".d-gallery-cover-credit .d-cover-credit");
  await expect(credit).toBeVisible();
  await expect(credit).toHaveText(/^Photo: .+, CC BY-SA 3\.0 \(cropped\)$/);
  await expect(credit).toHaveCSS("color", "rgb(255, 255, 255)");
  await expect(credit).toHaveAttribute("href", /^https:\/\/commons\.wikimedia\.org\/wiki\/File:/);
  await expect(credit).toHaveAttribute("target", "_blank");

  // The full attribution stays inside the photo on a phone.
  await page.setViewportSize({ width: 375, height: 812 });
  const coverBox = await page.locator("#detailCover").boundingBox();
  const creditBox = await credit.boundingBox();
  expect(creditBox.x + creditBox.width).toBeLessThanOrEqual(coverBox.x + coverBox.width);
  expect(creditBox.y).toBeGreaterThan(coverBox.y);
  expect(creditBox.y + creditBox.height).toBeLessThan(coverBox.y + coverBox.height);
  // The text sits in the middle of the touch-sized badge instead of leaving a gap below.
  const textBox = await credit.locator(".d-cover-credit-text").boundingBox();
  expect(textBox.y + textBox.height / 2).toBeCloseTo(creditBox.y + creditBox.height / 2, 0);
});

test("the credit follows the interface language", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("unisearch_ui_language_v1", "ru"));
  await page.goto("/university.html?id=nazarbayev-university-kaz-astana");
  await expect(page.locator("#detailCard")).toBeVisible();
  await expect(page.locator(".d-gallery-cover-credit .d-cover-credit")).toHaveText(/^Фото: .+, CC BY-SA 4\.0 \(кадрировано\)$/);
  await expect(page.getByRole("button", { name: "Увеличить фото" })).toBeVisible();
});

test("a university without a reusable photo shows an embedded campus map in the cover", async ({ page }) => {
  const assetRequests = [];
  page.on("request", (request) => {
    if (request.url().includes("kimep-university-kaz-almaty")) assetRequests.push(request.url());
  });
  await openUniversity(page, "kimep-university-kaz-almaty");
  const cover = page.locator("#detailCover");
  await expect(cover).toBeVisible();
  await expect(cover).toHaveClass(/\bis-cover-map\b/);
  await expect(cover.locator(".d-cover-map")).toBeVisible();
  await expect(cover.locator("#detailBackBtn")).toBeVisible();
  const mapLink = cover.locator(".d-cover-map-link");
  await expect(mapLink).toBeVisible();
  await expect(mapLink).toHaveAttribute("href", /view=map&focus_uni=kimep-university-kaz-almaty/);
  await expect(page.locator(".d-gallery-cover-credit .d-cover-credit")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Enlarge photo" })).toHaveCount(0);
  expect(assetRequests.filter((url) => url.includes("/assets/thumbnails"))).toEqual([]);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.evaluate(() => document.documentElement.dataset.theme = "dark");
  await expect(cover.locator(".d-cover-map")).toBeVisible();
  await expect(cover.locator("#detailBackBtn")).toBeVisible();
});

test("a university with a photo lets the user switch the cover between Photo and Map", async ({ page }) => {
  await openUniversity(page, "mit-usa-cambridge");
  const cover = page.locator("#detailCover");
  const modeSwitch = cover.locator(".d-cover-mode");
  const photoBtn = modeSwitch.getByRole("button", { name: "Photo" });
  const mapBtn = modeSwitch.getByRole("button", { name: "Map" });

  await expect(photoBtn).toHaveAttribute("aria-pressed", "true");
  await expect(mapBtn).toHaveAttribute("aria-pressed", "false");
  await expect(cover.locator(".d-cover-map")).toHaveCount(0);
  await expect(cover.locator(".d-gallery-preview")).toBeVisible();

  await mapBtn.click();
  await expect(mapBtn).toHaveAttribute("aria-pressed", "true");
  await expect(photoBtn).toHaveAttribute("aria-pressed", "false");
  await expect(cover.locator(".d-cover-map")).toBeVisible();
  await expect(cover.locator(".d-cover-map-link")).toBeVisible();
  await expect(cover.locator(".d-gallery-cover-credit")).toBeHidden();
  await expect(cover.locator(".d-gallery-preview")).toBeHidden();

  await photoBtn.click();
  await expect(photoBtn).toHaveAttribute("aria-pressed", "true");
  await expect(cover.locator(".d-cover-map")).toBeHidden();
  await expect(cover.locator(".d-cover-map-link")).toBeHidden();
  await expect(cover.locator(".d-cover-map-recenter")).toBeHidden();
  await expect(cover.locator(".d-gallery-cover-credit")).toBeVisible();
  await expect(cover.locator(".d-gallery-preview")).toBeVisible();
});

test("clicking the campus marker on the cover map centers and zooms back to the campus", async ({ page }) => {
  await openUniversity(page, "mit-usa-cambridge");
  const cover = page.locator("#detailCover");
  await cover.locator(".d-cover-mode").getByRole("button", { name: "Map" }).click();
  const mapStage = cover.locator(".d-cover-map");
  await expect(mapStage).toHaveClass(/\bis-mounted\b/);

  const pin = cover.getByRole("button", { name: /Center on campus/ });
  await expect(pin).toBeVisible();

  async function currentMapZoom() {
    return mapStage.evaluate((root) => {
      const containers = Array.from(root.querySelectorAll(".leaflet-tile-container"));
      const active = containers.find((el) => {
        const transform = el.style.transform || "";
        return (!transform.includes("scale(") || /scale\(1(?:\.0+)?\)/.test(transform))
          && Boolean(el.querySelector(".leaflet-tile"));
      });
      const tile = active?.querySelector(".leaflet-tile");
      const zoom = Number(tile?.getAttribute("src")?.match(/\/(\d+)\/\d+\/\d+\.png$/)?.[1]);
      return Number.isFinite(zoom) ? zoom : null;
    });
  }

  async function pinDistanceFromCenter(coverBox) {
    const pinBox = await pin.boundingBox();
    if (!pinBox) return Infinity;
    const coverCenterX = coverBox.x + coverBox.width / 2;
    const coverCenterY = coverBox.y + coverBox.height / 2;
    return Math.hypot(
      pinBox.x + pinBox.width / 2 - coverCenterX,
      pinBox.y + pinBox.height / 2 - coverCenterY,
    );
  }

  const coverBox = await cover.boundingBox();
  const zoomOut = cover.locator(".leaflet-control-zoom-out");
  await expect.poll(currentMapZoom).toBe(15);

  // Zoom out and drag slightly so the campus pin stays visible but off-center and zoomed out.
  await zoomOut.click({ modifiers: ["Shift"] });
  await expect.poll(currentMapZoom).toBe(12);

  const dragStartX = coverBox.x + coverBox.width * 0.72;
  const dragStartY = coverBox.y + coverBox.height * 0.65;
  await page.mouse.move(dragStartX, dragStartY);
  await page.mouse.down();
  await page.mouse.move(dragStartX - 140, dragStartY - 60, { steps: 6 });
  await page.mouse.up();

  await expect(cover.locator(".d-cover-map-recenter")).toBeHidden();
  await expect.poll(() => pinDistanceFromCenter(coverBox)).toBeGreaterThan(40);

  await pin.click();

  await expect.poll(() => pinDistanceFromCenter(coverBox)).toBeLessThan(8);
  await expect.poll(currentMapZoom).toBe(15);

  // Also verify keyboard activation (Space) recenters and zooms after zooming out and dragging.
  await zoomOut.click({ modifiers: ["Shift"] });
  await expect.poll(currentMapZoom).toBe(12);

  await page.mouse.move(dragStartX, dragStartY);
  await page.mouse.down();
  await page.mouse.move(dragStartX - 110, dragStartY - 40, { steps: 6 });
  await page.mouse.up();
  await expect.poll(() => pinDistanceFromCenter(coverBox)).toBeGreaterThan(40);

  await pin.focus();
  await page.keyboard.press("Space");

  await expect.poll(() => pinDistanceFromCenter(coverBox)).toBeLessThan(8);
  await expect.poll(currentMapZoom).toBe(15);
});

test("the cover gallery and full-size viewer keep the same photo and attribution", async ({ page }) => {
  await page.setViewportSize({ width: 2200, height: 1400 });
  await openUniversity(page, "australian-national-university-au-canberra");
  const cover = page.locator("#detailCover");
  const preview = cover.getByRole("button", { name: /Enlarge photo/ });
  const credit = page.locator(".d-gallery-cover-credit .d-cover-credit");
  const next = page.getByRole("button", { name: "Next photo" });
  const count = cover.locator(".d-gallery-count");
  await expect(count).toHaveText("1 / 3");
  await expect(preview.locator("img")).toHaveAttribute("src", /thumbnails\/australian-national-university-au-canberra\.webp$/);
  await next.click();
  await expect(next).toBeFocused();
  await expect(count).toHaveText("2 / 3");
  await expect(credit).toContainText("-wuppertaler");
  await expect(preview.locator("img")).toBeVisible();
  await preview.press("Enter");

  const viewer = page.getByRole("dialog", { name: "Campus photos" });
  const viewerCount = viewer.locator(".d-gallery-count");
  await expect(viewer).toHaveCSS("background-color", "rgb(0, 0, 0)");
  await expect(page.locator("html")).toHaveCSS("scrollbar-gutter", "auto");
  await expect(viewer.getByRole("button", { name: "Close" })).toBeFocused();
  await expect(viewerCount).toHaveText("2 / 3");
  const image = viewer.getByRole("img");
  await expect(image).toHaveAttribute("src", /campus-entrance-sign\.jpg$/);
  await expect(viewer.locator(".d-cover-credit")).toContainText("-wuppertaler");
  await expect(viewer.locator(".d-cover-credit")).toHaveCSS("color", "rgb(255, 255, 255)");
  const desktopPhoto = await image.evaluate((photo) => ({
    renderedWidth: photo.width,
    naturalWidth: photo.naturalWidth,
  }));
  expect(desktopPhoto.renderedWidth).toBe(desktopPhoto.naturalWidth);
  await page.keyboard.press("ArrowRight");
  await expect(image).toHaveAttribute("src", /old-canberra-house\.jpg$/);
  await expect(viewerCount).toHaveText("3 / 3");
  await page.keyboard.press("Escape");
  await expect(viewer).toHaveCount(0);
  await expect(preview).toBeFocused();
  await expect(preview).toHaveAccessibleName("Enlarge photo · Photo 3 of 3");
  await expect(count).toHaveText("3 / 3");
  await next.click();
  await expect(preview).toHaveAccessibleName("Enlarge photo · Photo 1 of 3");
});

test("a single campus photo opens on a small screen without carousel controls", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await openUniversity(page, "mit-usa-cambridge", "dark");
  await expect(page.locator(".d-gallery-cover-credit .d-cover-credit")).toBeVisible();
  await expect(page.getByRole("button", { name: "Next photo" })).toHaveCount(0);
  await expect(page.locator("#detailCover .d-gallery-count")).toBeHidden();
  const preview = page.getByRole("button", { name: "Enlarge photo" });
  await expect(preview.locator("img")).toBeVisible();
  await expect(page.locator("#detailCover").getByText("Campus photo unavailable")).toBeHidden();
  await preview.click();
  const viewer = page.getByRole("dialog", { name: "Campus photos" });
  await expect(viewer.getByRole("button", { name: "Next photo" })).toHaveCount(0);
  await expect(viewer.locator(".d-gallery-count")).toBeHidden();
  const image = viewer.getByRole("img");
  await expect(image).toBeVisible();
  const box = await image.boundingBox();
  expect(box.x + box.width / 2).toBeCloseTo(375 / 2, 0);
  expect(box.y + box.height / 2).toBeCloseTo(667 / 2, 0);
  expect(box.width).toBeLessThan(await image.evaluate((photo) => photo.naturalWidth));
  await viewer.getByRole("button", { name: "Close" }).click();
  await expect(preview).toBeFocused();
});

test("the viewer zooms around the pointer and resets when changing photos", async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 700 });
  await openUniversity(page, "australian-national-university-au-canberra");
  const preview = page.getByRole("button", { name: /Enlarge photo/ });
  await preview.click();
  const viewer = page.getByRole("dialog", { name: "Campus photos" });
  const image = viewer.getByRole("img", { name: "Photo 1 of 3" });
  const zoomIn = viewer.getByRole("button", { name: "Zoom in" });
  const zoomOut = viewer.getByRole("button", { name: "Zoom out" });
  await expect(image).toBeVisible();
  await expect(zoomOut).toBeDisabled();
  const fit = await image.boundingBox();
  const x = fit.x + fit.width / 2;
  const y = fit.y + fit.height / 2;

  await page.mouse.move(x, y);
  await page.mouse.wheel(0, -160);
  await expect.poll(async () => (await image.boundingBox()).width).toBeGreaterThan(fit.width);
  const beforeDrag = await image.boundingBox();
  await page.mouse.down();
  await page.mouse.move(x + 70, y, { steps: 4 });
  await page.mouse.up();
  const afterDrag = await image.boundingBox();
  expect(afterDrag.x).toBeGreaterThan(beforeDrag.x + 25);
  await page.keyboard.press("Shift+ArrowRight");
  await expect.poll(async () => (await image.boundingBox()).x).toBeLessThan(afterDrag.x - 20);

  await page.keyboard.press("0");
  await expect(zoomOut).toBeDisabled();
  expect((await image.boundingBox()).width).toBeCloseTo(fit.width, 0);
  await page.mouse.dblclick(x, y);
  await expect(zoomOut).toBeEnabled();
  await zoomIn.press("ArrowRight");
  await expect(viewer.getByRole("img", { name: "Photo 2 of 3" })).toBeVisible();
  await expect(zoomOut).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(preview).toBeFocused();
});

test("clicking the dark backdrop closes the viewer while clicking or panning the photo keeps it open", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 800 });
  await openUniversity(page, "australian-national-university-au-canberra");
  const preview = page.getByRole("button", { name: /Enlarge photo/ });
  await preview.click();
  const viewer = page.getByRole("dialog", { name: "Campus photos" });
  const canvas = viewer.locator(".d-photo-canvas");
  const image = viewer.getByRole("img", { name: "Photo 1 of 3" });
  await expect(image).toBeVisible();

  const fit = await image.boundingBox();
  const centerX = fit.x + fit.width / 2;
  const centerY = fit.y + fit.height / 2;

  // Hovering the photo uses zoom cursor; hovering dark space resets it and clicking the photo stays open.
  await page.mouse.move(centerX, centerY);
  await expect(canvas).toHaveCSS("cursor", "zoom-in");
  await page.mouse.click(centerX, centerY);
  await expect(viewer).toBeVisible();

  // Dragging from the photo into the dark margin when zoomed must not dismiss the viewer.
  await page.mouse.dblclick(centerX, centerY);
  await expect(viewer.getByRole("button", { name: "Zoom out" })).toBeEnabled();
  await page.mouse.move(centerX, centerY);
  await page.mouse.down();
  await page.mouse.move(10, centerY, { steps: 4 });
  await page.mouse.up();
  await expect(viewer).toBeVisible();

  // Reset zoom, verify dark space inside canvas shows default cursor, and click it to close.
  await page.keyboard.press("0");
  const resetBox = await image.boundingBox();
  expect(resetBox.x).toBeGreaterThan(80);
  const darkX = Math.floor(resetBox.x / 2);
  const darkY = centerY - 64;
  await page.mouse.move(darkX, darkY);
  await expect(canvas).toHaveCSS("cursor", "auto");
  await page.mouse.click(darkX, darkY);
  await expect(viewer).toHaveCount(0);
  await expect(preview).toBeFocused();

  // Re-open and close by clicking dark space away from controls and attribution.
  await preview.click();
  await expect(image).toBeVisible();
  await page.mouse.click(24, 780);
  await expect(viewer).toHaveCount(0);
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
    await expect(page.locator("#detailCover").getByText("Campus photo unavailable")).toBeVisible();
    await page.getByRole("button", { name: /Enlarge photo/ }).click();
    const viewer = page.getByRole("dialog", { name: "Campus photos" });
    await expect(viewer.getByText("Photo unavailable", { exact: true })).toBeVisible();
    shouldFail = false;
    await viewer.getByRole("button", { name: "Retry" }).click();
    await expect(viewer.getByRole("img")).toBeVisible();
  });
});

test.describe("touch navigation", () => {
  test.use({ isMobile: true, hasTouch: true, viewport: { width: 320, height: 667 } });

  test("phone controls overlay the photo and respond to taps", async ({ page }) => {
    await openUniversity(page, "australian-national-university-au-canberra", "dark");
    const preview = page.getByRole("button", { name: /Enlarge photo/ });
    await expect(preview).toHaveAccessibleName("Enlarge photo · Photo 1 of 3");
    const cover = page.locator("#detailCover");
    const count = cover.locator(".d-gallery-count");
    await expect(count).toHaveText("1 / 3");
    const photo = await cover.boundingBox();
    const arrow = await cover.getByRole("button", { name: "Previous photo" }).boundingBox();
    const counter = await count.boundingBox();
    const credit = await cover.locator(".d-cover-credit").boundingBox();
    expect(Math.min(arrow.width, arrow.height)).toBeGreaterThanOrEqual(44);
    expect(arrow.y + arrow.height / 2).toBeCloseTo(photo.y + photo.height / 2, 0);
    expect(counter.y + counter.height).toBeLessThan(photo.y + photo.height);
    expect(counter.y).toBeGreaterThan(arrow.y + arrow.height);
    expect(credit.y).toBeGreaterThan(photo.y);
    expect(credit.y + credit.height).toBeLessThan(arrow.y);

    await page.getByRole("button", { name: "Next photo" }).tap();
    await expect(count).toHaveText("2 / 3");
    await page.getByRole("button", { name: "Previous photo" }).tap();
    await expect(preview).toHaveAccessibleName("Enlarge photo · Photo 1 of 3");

    await preview.tap();
    const viewer = page.getByRole("dialog", { name: "Campus photos" });
    await viewer.getByRole("button", { name: "Zoom in" }).tap();
    const zoomOut = viewer.getByRole("button", { name: "Zoom out" });
    await expect(zoomOut).toBeEnabled();
    await zoomOut.tap();
    await expect(zoomOut).toBeDisabled();
    await viewer.getByRole("button", { name: "Next photo" }).tap();
    await expect(viewer.getByRole("img", { name: "Photo 2 of 3" })).toBeVisible();
    await expect(viewer.locator(".d-gallery-count")).toHaveText("2 / 3");
    await viewer.getByRole("button", { name: "Next photo" }).tap();
    await expect(viewer.getByRole("img", { name: "Photo 3 of 3" })).toBeVisible();
  });

  test("pinching zooms the photo and dragging pans it without changing the frame", async ({ page }) => {
    await openUniversity(page, "australian-national-university-au-canberra", "dark");
    await page.getByRole("button", { name: /Enlarge photo/ }).tap();
    const viewer = page.getByRole("dialog", { name: "Campus photos" });
    const image = viewer.getByRole("img", { name: "Photo 1 of 3" });
    await expect(image).toBeVisible();
    const fit = await image.boundingBox();
    const y = Math.round(fit.y + fit.height / 2);
    const session = await page.context().newCDPSession(page);

    await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 125, y, id: 1 }, { x: 195, y, id: 2 }] });
    await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 65, y, id: 1 }, { x: 255, y, id: 2 }] });
    await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expect.poll(async () => (await image.boundingBox()).width).toBeGreaterThan(fit.width * 2);
    const beforePan = await image.boundingBox();

    await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 120, y }] });
    await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 200, y }] });
    await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expect.poll(async () => (await image.boundingBox()).x).toBeGreaterThan(beforePan.x + 40);
    await expect(image).toBeVisible();
  });

  test("a swipe changes the photo and a tap opens it", async ({ page }) => {
    await openUniversity(page, "australian-national-university-au-canberra", "dark");
    const preview = page.getByRole("button", { name: /Enlarge photo/ });
    await expect(preview).toHaveAccessibleName("Enlarge photo · Photo 1 of 3");

    const session = await page.context().newCDPSession(page);
    async function swipeLeftAt(y) {
      await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 235, y }] });
      await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 170, y }] });
      await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 90, y }] });
      await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    }
    async function omitNextNativeClick(locator) {
      await locator.evaluate((button) => {
        function omitClick(event) {
          if (!event.isTrusted || !button.contains(event.target)) return;
          window.removeEventListener("click", omitClick, true);
          event.stopImmediatePropagation();
        }
        window.addEventListener("click", omitClick, true);
      });
    }
    const box = await preview.boundingBox();
    await swipeLeftAt(Math.round(box.y + box.height / 2));

    const viewer = page.getByRole("dialog", { name: "Campus photos" });
    await expect(preview).toHaveAccessibleName("Enlarge photo · Photo 2 of 3");
    await expect(viewer).toHaveCount(0);
    // Some Chromium touch streams omit the synthesized click after a swipe.
    await omitNextNativeClick(preview);
    await preview.tap();
    await expect(viewer.getByRole("img", { name: "Photo 2 of 3" })).toBeVisible();
    await swipeLeftAt(333);
    const enlargedPhoto = viewer.getByRole("img", { name: "Photo 3 of 3" });
    await expect(enlargedPhoto).toBeVisible();
    const portraitPhoto = await enlargedPhoto.boundingBox();
    const portraitCounter = await viewer.locator(".d-gallery-count").boundingBox();
    expect(portraitPhoto.width).toBeCloseTo(320, 0);
    expect(portraitCounter.y).toBeGreaterThan(portraitPhoto.y);
    expect(portraitCounter.y + portraitCounter.height).toBeLessThan(portraitPhoto.y + portraitPhoto.height);

    await page.setViewportSize({ width: 667, height: 320 });
    const photo = await enlargedPhoto.boundingBox();
    const arrow = await viewer.getByRole("button", { name: "Next photo" }).boundingBox();
    const license = await viewer.locator(".d-cover-credit").boundingBox();
    const close = viewer.getByRole("button", { name: "Close" });
    const closeBox = await close.boundingBox();
    const counter = await viewer.locator(".d-gallery-count").boundingBox();
    expect(photo.height).toBeGreaterThan(220);
    expect(closeBox.x + closeBox.width).toBeLessThan(license.x);
    expect(arrow.y + arrow.height / 2).toBeCloseTo(photo.y + photo.height / 2, 0);
    expect(counter.y + counter.height).toBeLessThan(photo.y + photo.height);
    expect(license.y + license.height).toBeLessThan(counter.y);

    await omitNextNativeClick(close);
    await close.tap();
    await expect(viewer).toHaveCount(0);
    await expect(preview).toHaveAccessibleName("Enlarge photo · Photo 3 of 3");

    // Re-open on phone portrait, verify dark-zone swipe changes photo without closing, and dark-zone tap closes.
    await page.setViewportSize({ width: 320, height: 667 });
    await preview.tap();
    const reopenedImage = viewer.getByRole("img", { name: "Photo 3 of 3" });
    await expect(reopenedImage).toBeVisible();
    const phoneBox = await reopenedImage.boundingBox();
    const darkAboveY = Math.round(phoneBox.y - 40);
    expect(darkAboveY).toBeGreaterThan(64);
    expect(darkAboveY).toBeLessThan(phoneBox.y);
    await swipeLeftAt(darkAboveY);
    await expect(viewer.getByRole("img", { name: "Photo 1 of 3" })).toBeVisible();
    await page.touchscreen.tap(160, darkAboveY);
    await expect(viewer).toHaveCount(0);
    await expect(preview).toHaveAccessibleName("Enlarge photo · Photo 1 of 3");
  });
});
