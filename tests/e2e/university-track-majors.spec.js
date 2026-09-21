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

  await expect(page.locator(".admission-category-card")).toHaveCount(3);
  await expect(page.locator(".requirement-profile-tab")).toHaveCount(9);

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

test("programs tab search filters the list and shows empty state", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("unisearch_ui_language_v1", "rus");
  });
  await page.goto("/university.html?id=mit-usa-cambridge");

  await expect(page.locator("#detailCard")).toBeVisible();
  await page.click(".d-tab-btn[data-tab='tab-programs']");

  const search = page.locator("#tab-programs [data-program-search]");
  await expect(search).toBeVisible();
  await expect(page.locator("#tab-programs [data-program-empty]")).toBeHidden();

  await search.fill("Физика");
  await expect(page.locator("#tab-programs .program-card:not([hidden])")).toHaveCount(1);
  await expect(
    page.locator("#tab-programs .program-card:not([hidden]) .program-card__title").first()
  ).toContainText("Физика");

  await search.fill("");
  await expect(page.locator("#tab-programs .program-card:not([hidden])")).toHaveCount(12);

  await search.fill("zzz-no-such-program");
  await expect(page.locator("#tab-programs [data-program-empty]")).toBeVisible();
  await expect(page.locator("#tab-programs .program-card:not([hidden])")).toHaveCount(0);
});

test("profile major pins and highlights matching programs first", async ({ page }) => {
  await seedProfile(page, personas.ruStemGrant.profile);
  await page.addInitScript(() => {
    localStorage.setItem("unisearch_ui_language_v1", "eng");
  });

  await page.goto("/university.html?id=mit-usa-cambridge");

  await expect(page.locator("#detailCard")).toBeVisible();
  await page.click(".d-tab-btn[data-tab='tab-programs']");

  const cards = page.locator("#tab-programs .program-card");
  await expect(cards.first()).toHaveClass(/program-card--major/);
  await expect(cards.first().locator(".program-card__title")).toContainText(
    "Computer Science and Engineering"
  );
  await expect(page.locator("#tab-programs .program-card--major")).toHaveCount(3);
  await expect(
    page.locator("#tab-programs .program-card--major .program-card__major-badge").first()
  ).toBeVisible();
});

test("abai university admission card layout invariants", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("unisearch_ui_language_v1", "rus");
    localStorage.setItem("unisearch_theme", "dark");
  });
  await page.goto("/university.html?id=abai-kazakh-national-pedagogical-university-kaz-almaty");
  await expect(page.locator("#detailCard")).toBeVisible();
  await page.click(".d-tab-btn[data-tab='tab-admission']");

  const applicablePrograms = page.locator(".admission-applicable-programs").first();
  await expect(applicablePrograms).toBeVisible();

  const fundingOption = page.locator(".admission-funding-option").first();
  await expect(fundingOption).toBeVisible();

  const header = fundingOption.locator(".admission-funding-option-header");
  await expect(header).toBeVisible();

  const side = header.locator(".admission-funding-option-side");
  await expect(side).toBeVisible();

  const chanceChip = fundingOption.locator(".chance-track-chip").first();
  await expect(chanceChip).toBeVisible();
  const paddingLeft = await chanceChip.evaluate((el) => window.getComputedStyle(el).paddingLeft);
  expect(paddingLeft).toBe("0px");

  const fundingMain = fundingOption.locator(".admission-funding-option-main").first();
  await expect(fundingMain).toBeVisible();
  const mainHeight = await fundingMain.evaluate((el) => el.getBoundingClientRect().height);
  expect(mainHeight).toBeLessThan(150);

  const card = page.locator(".admission-category-card").first();
  await card.screenshot({ path: "C:/Users/aigul/.gemini/antigravity/brain/696e06cd-77ec-4b07-95ef-f1c938a602f4/scratch/admission_card_abai.png" });
});

test("abai university general tab layout invariants and spacing", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("unisearch_ui_language_v1", "rus");
    localStorage.setItem("unisearch_theme", "dark");
  });
  await page.goto("/university.html?id=abai-kazakh-national-pedagogical-university-kaz-almaty");
  await expect(page.locator("#detailCard")).toBeVisible();

  const generalTab = page.locator("#tab-general");
  await expect(generalTab).toBeVisible();

  const boxes = generalTab.locator(".d-box");
  await expect(boxes).toHaveCount(2);

  const secondBoxBorderTop = await boxes.nth(1).evaluate((el) => window.getComputedStyle(el).borderTopWidth);
  expect(secondBoxBorderTop).toBe("0px");

  const firstBoxPaddingBottom = await boxes.nth(0).evaluate((el) => window.getComputedStyle(el).paddingBottom);
  expect(firstBoxPaddingBottom).toBe("8px");

  const secondBoxPaddingTop = await boxes.nth(1).evaluate((el) => window.getComputedStyle(el).paddingTop);
  expect(secondBoxPaddingTop).toBe("20px");

  await generalTab.screenshot({ path: "C:/Users/aigul/.gemini/antigravity/brain/696e06cd-77ec-4b07-95ef-f1c938a602f4/scratch/general_tab_preview.png" });
});
