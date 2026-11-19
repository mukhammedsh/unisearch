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
      `${root}javascript/main.js`, `${root}css/shared/01-foundation.css`, `${root}css/university/01-shell-hero.css`,
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
    "/frontend/css/shared/01-foundation.css",
    "/frontend/css/university/01-shell-hero.css",
  ]));
  await expect.poll(() => page.evaluate(() => document.querySelector("base")?.href))
    .toContain("/frontend/");
});

test("client-side SPA navigation to pretty /universities/<id> loads university stylesheets from root", async ({ page }) => {
  const failedCss = [];
  const loadedCss = [];
  page.on("response", (response) => {
    const pathname = new URL(response.url()).pathname;
    if (!pathname.endsWith(".css")) return;
    if (response.ok()) loadedCss.push(pathname);
    else failedCss.push(`${response.status()} ${pathname}`);
  });

  await page.goto("/");
  await expect(page.locator("#universitiesList .uni-card").first()).toBeVisible();

  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent("app:navigate", {
      detail: { href: "/universities/mit-usa-cambridge" },
    }));
  });

  await expect(page).toHaveURL(/\/universities\/mit-usa-cambridge$/);
  await expect(page.locator("body")).toHaveAttribute("data-page", "university");
  await expect(page.locator("#detailCard")).toHaveClass(/is-mounted/);
  await expect(page.locator("#detailName")).not.toHaveText("University Name");

  expect(failedCss).toEqual([]);
  expect(loadedCss).toEqual(expect.arrayContaining([
    "/css/university/01-shell-hero.css",
    "/css/university/02-overview-programs.css",
    "/css/university/03-admissions.css",
    "/css/university/04-finance-aid.css",
    "/css/university/05-admissions-reviewed.css",
    "/css/university/06-qualification-guidance.css",
  ]));
  expect(await page.evaluate(() => new URL(document.baseURI).pathname)).toBe("/");
  const saveReserveHidden = await page.locator("#detailSaveBtn .d-site-link-label-reserve").evaluate((el) => {
    const styles = getComputedStyle(el);
    return styles.visibility === "hidden" || styles.opacity === "0" || styles.display === "none";
  });
  expect(saveReserveHidden).toBe(true);
});
