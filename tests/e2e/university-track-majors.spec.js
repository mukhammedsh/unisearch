const { test, expect } = require("@playwright/test");
const { personas, seedProfile } = require("./helpers/personas");

test("admission tracks show applicable programs", async ({ page }) => {
  await page.goto("/university.html?id=astana-it-university-kaz-astana");

  await expect(page.locator("#detailCard")).toBeVisible();
  await page.click(".d-tab-btn[data-tab='tab-admission']");

  const majors = page.locator(".track-applicable-majors .tag");
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

  const majors = page.locator(".track-applicable-majors .tag");
  await expect(majors.first()).toBeVisible();
  await expect(majors).toContainText(["Компьютерные науки"]);
});

test("nazarbayev university keeps compact tracks and shows funding options inside each track", async ({ page }) => {
  await page.goto("/university.html?id=nazarbayev-university-kaz-astana");

  await expect(page.locator("#detailCard")).toBeVisible();
  await page.click(".d-tab-btn[data-tab='tab-admission']");

  await expect(page.locator(".track-card")).toHaveCount(2);
  await expect(page.locator(".admission-option-card")).toHaveCount(4);
  await expect(page.locator(".track-title")).toContainText(["Direct Admission (SAT)", "NUET Applicants"]);
});

test("tsinghua admission tab keeps paid and grant options visible when profile prefers grant", async ({ page }) => {
  await seedProfile(page, personas.ruStemGrant.profile);
  await page.goto("/university.html?id=tsinghua-university-cn-beijing");

  await expect(page.locator("#detailCard")).toBeVisible();
  await page.click(".d-tab-btn[data-tab='tab-admission']");

  const optionCards = page.locator(".admission-option-card");
  await expect(optionCards).toHaveCount(2);
  await expect(optionCards).toContainText(["Paid", "Grant"]);
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
  await expect(programTags).toContainText(["Компьютерные науки"]);
});
