const { test, expect } = require("./helpers/coverage-test.cjs");

test("university detail loads its page resources under the /frontend mount", async ({ page }) => {
  const frontendRequests = [];
  page.on("request", (request) => {
    const pathname = new URL(request.url()).pathname;
    if (pathname.startsWith("/frontend/")) frontendRequests.push(pathname);
  });

  await page.goto("/frontend/university.html?id=suleyman-demirel-university-kaz-kaskelen");
  await expect(page.locator("#detailCard")).toBeVisible();
  await expect(page.locator("#detailName")).not.toHaveText("University Name");

  expect(frontendRequests).toEqual(expect.arrayContaining([
    "/frontend/javascript/main.js",
    "/frontend/css/style.css",
    "/frontend/css/university.css",
  ]));
  await expect.poll(() => page.evaluate(() => document.querySelector("base")?.href))
    .toContain("/frontend/");
});
