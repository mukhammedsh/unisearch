const { test, expect } = require("@playwright/test");
const { personas, seedProfile } = require("./helpers/personas");

test("admission categories show applicable programs", async ({ page }) => {
  await page.goto("/university.html?id=astana-it-university-kaz-astana");

  await expect(page.locator("#detailCard")).toBeVisible();
  await page.click(".d-tab-btn[data-tab='tab-admission']");

  const majors = page.locator(".admission-applicable-programs .tag");
  await expect(majors.first()).toBeVisible();
  await expect(majors).toContainText(["Computer Science"]);
});

test("admission category major tags are localized in russian", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("unisearch_ui_language_v1", "rus");
  });
  await page.goto("/university.html?id=astana-it-university-kaz-astana");

  await expect(page.locator("#detailCard")).toBeVisible();
  await page.click(".d-tab-btn[data-tab='tab-admission']");

  const majors = page.locator(".admission-applicable-programs .tag");
  await expect(majors.first()).toBeVisible();
  await expect(majors).toContainText(["Компьютерные науки"]);
});

test("nazarbayev university shows one admission category with requirement profiles", async ({ page }) => {
  await page.goto("/university.html?id=nazarbayev-university-kaz-astana");

  await expect(page.locator("#detailCard")).toBeVisible();
  await page.click(".d-tab-btn[data-tab='tab-admission']");

  await expect(page.locator(".admission-category-card")).toHaveCount(1);
  await expect(page.locator(".requirement-profile-tab")).toHaveCount(3);
  await expect(page.locator(".requirement-profile-tab")).toContainText(["SAT", "ACT", "NUET"]);
  await expect(page.locator(".admission-funding-option")).toHaveCount(2);
  await expect(page.locator("#tab-admission .admission-requirement-grid")).toHaveCount(1);
  await expect(page.locator(".admission-funding-option .admission-requirement-grid")).toHaveCount(0);
  await expect(page.locator(".admission-funding-diff-note")).toHaveCount(2);
  await expect(page.locator(".admission-funding-diff-note").first()).toContainText("No separate funding-specific requirements");
  await expect(page.locator(".admission-funding-diff-note").last()).toContainText("The grant is awarded separately");

  await page.locator(".requirement-profile-tab", { hasText: "NUET" }).click();
  await expect(page.locator(".requirement-profile-title")).toContainText("NUET");
  await expect(page.locator(".admission-funding-option")).toHaveCount(2);
  await expect(page.locator("#tab-admission .admission-requirement-grid")).toHaveCount(1);
  await expect(page.locator(".admission-funding-option .admission-requirement-grid")).toHaveCount(0);
});

test("tsinghua admission tab keeps paid and grant options visible when profile prefers grant", async ({ page }) => {
  await seedProfile(page, personas.ruStemGrant.profile);
  await page.goto("/university.html?id=tsinghua-university-cn-beijing");

  await expect(page.locator("#detailCard")).toBeVisible();
  await page.click(".d-tab-btn[data-tab='tab-admission']");

  const optionCards = page.locator(".admission-funding-option");
  await expect(optionCards).toHaveCount(2);
  await expect(optionCards).toContainText(["Paid", "Grant"]);
});

test("oxford admission selector narrows program-specific categories without duplicate profile cards", async ({ page }) => {
  await page.goto("/university.html?id=university-of-oxford-uk-oxford");

  await expect(page.locator("#detailCard")).toBeVisible();
  await page.click(".d-tab-btn[data-tab='tab-admission']");

  await expect(page.locator(".admission-category-card")).toHaveCount(2);
  await expect(page.locator(".requirement-profile-tab")).toHaveCount(6);

  await page.locator(".admission-program-option[data-admission-program='computer_science']").click();
  await expect(page.locator(".admission-category-card")).toHaveCount(1);
  await expect(page.locator(".requirement-profile-tab")).toHaveCount(3);
  await expect(page.locator(".requirement-profile-tab")).toContainText(["A-Level", "IB", "SAT"]);
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
