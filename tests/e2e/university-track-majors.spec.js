const { test, expect } = require("@playwright/test");

test("admission tracks show applicable programs", async ({ page }) => {
  await page.goto("/university.html?id=astana-it-university-kaz-astana");

  await expect(page.locator("#detailCard")).toBeVisible();
  await page.click(".d-tab-btn[data-tab='tab-admission']");

  const majors = page.locator(".track-major-chip");
  await expect(majors.first()).toBeVisible();
  await expect(majors).toContainText(["Computer Science"]);
});

test("admission track major tags are localized in russian", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("unisearch_ui_language_v1", "rus");
  });
  await page.goto("/university.html?id=astana-it-university-kaz-astana");

  await expect(page.locator("#detailCard")).toBeVisible();
  await page.click(".d-tab-btn[data-tab='tab-admission']");

  const majors = page.locator(".track-major-chip");
  await expect(majors.first()).toBeVisible();
  await expect(majors).toContainText(["Компьютерные науки"]);
});

test("program card major tags are localized in russian", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("unisearch_ui_language_v1", "rus");
  });
  await page.goto("/university.html?id=mit-usa-cambridge");

  await expect(page.locator("#detailCard")).toBeVisible();
  await page.click(".d-tab-btn[data-tab='tab-programs']");

  const programTags = page.locator("#tab-programs .program-card .program-tag");
  await expect(programTags.first()).toBeVisible();
  await expect(page.locator("#tab-programs")).toContainText("Компьютерные науки");
});
