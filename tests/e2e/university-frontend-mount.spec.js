const { test, expect } = require("./helpers/coverage-test.cjs");

for (const [name, route, root] of [
  ["root", "/universities/mit-usa-cambridge", "/"],
  ["root trailing slash", "/universities/mit-usa-cambridge/", "/"],
  ["frontend mount", "/frontend/universities/mit-usa-cambridge", "/frontend/"],
]) {
  test(`nested detail URL resolves resources from ${name}`, async ({ page }) => {
    const loadedAssets = [];
    page.on("response", response => {
      if (response.ok() && /\.(?:js|css)(?:\?|$)/.test(response.url())) loadedAssets.push(new URL(response.url()).pathname);
    });
    await page.goto(route);
    await expect(page.locator("#detailCard")).toHaveClass(/is-mounted/);
    await expect(page.locator("#detailName")).not.toHaveText("University Name");
    expect(await page.evaluate(() => new URL(document.baseURI).pathname)).toBe(root);
    expect(loadedAssets).toEqual(expect.arrayContaining([
      `${root}javascript/main.js`, `${root}css/style.css`, `${root}css/university.css`,
    ]));
  });
}

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
