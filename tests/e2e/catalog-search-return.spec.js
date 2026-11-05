const { test, expect } = require("./helpers/coverage-test.cjs");
const { markTourAsSeen } = require("./helpers/personas");

for (const query of ["Nazarbayev", "Nazarbayev University"]) {
  test(`catalog preserves ${query} results after returning from a saved university`, async ({ page }) => {
    await markTourAsSeen(page);
    await page.addInitScript(() => localStorage.setItem("unisearch_ui_language_v1", "rus"));
    await page.goto("/index.html");
    await expect(page.locator("body")).toHaveAttribute("data-page", "universities");
    await expect(page.locator("#universitiesList .uni-card:not(.is-skeleton)").first()).toBeVisible();
    const queries = [];
    page.on("request", request => {
      const url = new URL(request.url());
      if (url.pathname === "/universities/profiled" && request.method() === "POST") {
        queries.push(request.postDataJSON().q || "");
      }
    });
    await page.locator("#qInput").fill(query);
    await page.locator("#qInput").press("Enter");
    await expect.poll(() => new URL(page.url()).searchParams.get("q")).toBe(query);
    await expect.poll(() => queries.includes(query)).toBe(true);
    const cards = page.locator("#universitiesList .uni-card:not(.is-skeleton)");
    await expect(cards.first()).toHaveAttribute("data-uni-id", "nazarbayev-university-kaz-astana");
    await page.locator("#qInput").blur();
    const initialIds = await cards.evaluateAll(nodes => nodes.map(node => node.dataset.uniId));
    const initialTotal = await page.locator("#totalCount").innerText();
    const card = page.locator('.uni-card[data-uni-id="nazarbayev-university-kaz-astana"]');
    await expect(card).toBeVisible();
    await card.locator("a.uni-card-link-overlay").click();
    await expect(page.locator("#admissionsContext")).toHaveAttribute("data-state", "ready");
    await page.locator("#detailSaveBtn").click();
    await expect(page.locator("#detailSaveBtn")).toHaveAttribute("aria-pressed", "true");
    await page.reload();
    await expect(page.locator("#admissionsContext")).toHaveAttribute("data-state", "ready");
    await expect(page.locator("#detailSaveBtn")).toHaveAttribute("aria-pressed", "true");
    queries.length = 0;
    await page.locator("#detailBackBtn").click();
    await expect(page.locator("body")).toHaveAttribute("data-page", "universities");
    await expect(page.locator("#qInput")).toHaveValue(query);
    await expect.poll(() => queries.includes(query)).toBe(true);
    await expect(page.locator("#totalCount")).toHaveText(initialTotal);
    await expect.poll(() => cards.evaluateAll(nodes => nodes.map(node => node.dataset.uniId))).toEqual(initialIds);
    await expect(card).toBeVisible();
  });
}
