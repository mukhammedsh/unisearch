const { test, expect } = require("@playwright/test");
const { markTourAsSeen } = require("./helpers/personas");

function makeUniversity(index) {
  return {
    id: `map-pagination-${index}`,
    name: `Map Pagination University ${index}`,
    rank: index,
    location: { country: "USA", city: `City ${index}` },
    coordinates: { lat: 30 + ((index % 20) * 0.2), lon: -120 + ((index % 25) * 0.3) },
    finance: { total_cost_year_usd: 20000 + index, currency: "USD" },
    academics: { acceptance_rate_percent: 50 },
  };
}

test("map results rail loads the next 100 universities at the end of the list", async ({ page }) => {
  await markTourAsSeen(page);
  const allItems = Array.from({ length: 250 }, (_, index) => makeUniversity(index + 1));
  const requestedPages = [];

  await page.route("**/universities/map-points?*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ items: allItems, count: allItems.length, total: allItems.length, truncated: false }),
    });
  });

  await page.route("**/universities?*", async (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get("view") !== "map") {
      await route.continue();
      return;
    }
    const pageNumber = Number(url.searchParams.get("page") || 1);
    const limit = Number(url.searchParams.get("limit") || 100);
    requestedPages.push(pageNumber);
    const start = (pageNumber - 1) * limit;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        items: allItems.slice(start, start + limit),
        count: Math.min(limit, Math.max(0, allItems.length - start)),
        total: allItems.length,
        page: pageNumber,
        limit,
      }),
    });
  });

  await page.goto("/index.html");
  await expect(page.locator("#universitiesList .uni-card:not(.is-skeleton)").first()).toBeVisible();
  await expect(page.locator("#mapResultsPanel .uni-card")).toHaveCount(0);
  await page.click("#viewMapBtn");

  const mapList = page.locator("#mapResultsPanel .u-map-results-list");
  await expect(mapList.locator(".uni-card")).toHaveCount(100);
  await expect(mapList.locator(".u-map-results-count")).toContainText("100");
  const firstMapCard = mapList.locator(".uni-card").first();
  await firstMapCard.hover();
  await expect.poll(() => firstMapCard.evaluate((node) => getComputedStyle(node).transform)).toBe("none");

  await mapList.evaluate((node) => { node.scrollTop = node.scrollHeight; });
  await expect(mapList.locator(".uni-card")).toHaveCount(200);
  await expect(mapList.locator(".u-map-results-count")).toContainText("200");
  expect(requestedPages).toContain(1);
  expect(requestedPages).toContain(2);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("#mapStage")).toBeVisible();
  const mobileOverviewButton = page.locator("#mapContainer .u-map-overview-button");
  await expect(mobileOverviewButton).toBeVisible();
  const mobileOverviewBox = await mobileOverviewButton.boundingBox();
  expect(mobileOverviewBox.width).toBeGreaterThanOrEqual(44);
  expect(mobileOverviewBox.height).toBeGreaterThanOrEqual(44);
  const mobileOverflow = await mapList.evaluate((node) => ({
    scrollWidth: node.scrollWidth,
    clientWidth: node.clientWidth,
  }));
  expect(mobileOverflow.scrollWidth).toBeLessThanOrEqual(mobileOverflow.clientWidth + 1);
});

test("map marker opens the complete university card and overview returns to the world", async ({ page }) => {
  await markTourAsSeen(page);
  const railUniversity = makeUniversity(1);
  const markerUniversity = {
    ...makeUniversity(999),
    id: "marker-only-university",
    name: "Marker Only University",
    coordinates: { lat: 0, lon: 0 },
  };
  let detailRequests = 0;

  await page.route("**/universities/map-points?*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ items: [markerUniversity], count: 1, total: 1, truncated: false }),
    });
  });

  await page.route(/\/universities\/marker-only-university(?:\?|$)/, async (route) => {
    detailRequests += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { ETag: '"marker-only"' },
      body: JSON.stringify(markerUniversity),
    });
  });

  await page.route("**/universities?*", async (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get("view") !== "map") {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ items: [railUniversity], count: 1, total: 1, page: 1, limit: 100 }),
    });
  });

  await page.goto("/index.html");
  await expect(page.locator("#universitiesList .uni-card:not(.is-skeleton)").first()).toBeVisible();
  await page.click("#viewMapBtn");

  const marker = page.locator("#mapContainer .custom-div-icon");
  await expect(marker).toBeVisible();

  const map = page.locator("#mapContainer");
  const mapBox = await map.boundingBox();
  for (let index = 0; index < 5; index += 1) {
    await page.mouse.move(mapBox.x + (mapBox.width * 0.25), mapBox.y + (mapBox.height * 0.5));
    await page.mouse.down();
    await page.mouse.move(mapBox.x + (mapBox.width * 0.75), mapBox.y + (mapBox.height * 0.5), { steps: 6 });
    await page.mouse.up();
  }
  await expect.poll(async () => {
    const markerBox = await marker.boundingBox();
    return markerBox
      && markerBox.x >= mapBox.x
      && markerBox.x <= mapBox.x + mapBox.width
      && markerBox.y >= mapBox.y
      && markerBox.y <= mapBox.y + mapBox.height;
  }).toBe(true);

  for (let index = 0; index < 5; index += 1) {
    await page.mouse.move(mapBox.x + (mapBox.width * 0.5), mapBox.y + (mapBox.height * 0.25));
    await page.mouse.down();
    await page.mouse.move(mapBox.x + (mapBox.width * 0.5), mapBox.y + (mapBox.height * 0.75), { steps: 6 });
    await page.mouse.up();
  }
  await expect.poll(async () => {
    const markerBox = await marker.boundingBox();
    return markerBox
      && markerBox.x >= mapBox.x
      && markerBox.x <= mapBox.x + mapBox.width
      && markerBox.y >= mapBox.y
      && markerBox.y <= mapBox.y + mapBox.height;
  }).toBe(true);
  await marker.click();

  const popupCard = page.locator("#mapContainer .custom-map-popup .map-card-wrapper .uni-card");
  await expect(popupCard).toBeVisible();
  await expect(popupCard.locator(".uni-title")).toHaveText("Marker Only University");
  await expect(popupCard.locator(".uni-media")).toBeVisible();
  await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
  const popupSurface = await popupCard.evaluate((node) => {
    const popup = node.closest(".leaflet-popup");
    return {
      content: getComputedStyle(popup.querySelector(".leaflet-popup-content-wrapper")).backgroundColor,
      tip: getComputedStyle(popup.querySelector(".leaflet-popup-tip")).backgroundColor,
    };
  });
  expect(popupSurface.tip).toBe(popupSurface.content);
  await popupCard.hover();
  await expect.poll(() => popupCard.evaluate((node) => getComputedStyle(node).transform)).toBe("none");
  const popupHoverSurface = await popupCard.evaluate((node) => {
    const popup = node.closest(".leaflet-popup");
    return {
      card: getComputedStyle(node).backgroundColor,
      tip: getComputedStyle(popup.querySelector(".leaflet-popup-tip")).backgroundColor,
    };
  });
  expect(popupHoverSurface.tip).toBe(popupHoverSurface.card);
  expect(detailRequests).toBe(1);

  const zoomOut = page.locator("#mapContainer .leaflet-control-zoom-out");
  await expect(zoomOut).not.toHaveClass(/leaflet-disabled/);
  await page.locator("#mapContainer .u-map-overview-button").click();
  await expect(zoomOut).toHaveClass(/leaflet-disabled/);

  await page.locator("#mapContainer").focus();
  await page.keyboard.press("Equal");
  await expect(zoomOut).not.toHaveClass(/leaflet-disabled/);
});
