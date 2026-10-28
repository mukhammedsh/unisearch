const { test, expect } = require("./helpers/coverage-test.cjs");

async function openPrograms(page, universityId, { language = "eng", theme = "light", width = 1280 } = {}) {
  await page.setViewportSize({ width, height: 900 });
  const backendPort = Number(process.env.UNISEARCH_E2E_BACKEND_PORT);
  if (Number.isInteger(backendPort) && backendPort > 0 && backendPort < 65536) {
    await page.route("http://127.0.0.1:8000/**", (route) => route.continue({
      url: route.request().url().replace(":8000/", `:${backendPort}/`),
    }));
  }
  await page.addInitScript(({ language, theme }) => {
    if (!sessionStorage.getItem("legacy-program-cards-init")) {
      localStorage.setItem("unisearch_ui_language_v1", language);
      localStorage.setItem("unisearch_theme", theme);
      localStorage.setItem("unisearch_universities_tour_seen_v1", "1");
      sessionStorage.setItem("legacy-program-cards-init", "1");
    }
  }, { language, theme });
  await page.goto(`/university.html?id=${universityId}`);
  await expect(page.locator("body")).toHaveAttribute("data-page", "university");
  await expect(page.locator("#detailCard")).toHaveClass(/is-mounted/);
  await page.locator('[data-tab="tab-programs"]').click();
  await expect(page.locator("#detailPrograms .program-card:visible").first()).toBeVisible();
}

test("name-only catalog programs use the same independent cards and keep the selected one first", async ({ page }) => {
  await openPrograms(page, "eth-zurich-ch-zurich");
  const computerScience = page.locator("#detailPrograms .program-card").filter({ has: page.locator(".program-card__title", { hasText: "Computer Science" }) }).first();
  const softwareEngineering = page.locator("#detailPrograms .program-card").filter({ has: page.locator(".program-card__title", { hasText: "Software Engineering" }) }).first();
  await expect(computerScience).toBeVisible();
  await expect(softwareEngineering).toBeVisible();
  const initialUrl = page.url();
  await computerScience.locator("[data-program-toggle]").click();
  await expect(computerScience.locator("[data-program-toggle]")).toHaveAttribute("aria-expanded", "true");
  await expect(computerScience.locator(".program-card__description")).toContainText("computer science");
  expect(page.url()).toBe(initialUrl);
  const animated = await softwareEngineering.evaluate((card) => {
    card.querySelector("[data-program-toggle]").click();
    return card.querySelector(".program-card__body").getAnimations().some((animation) =>
      animation.effect?.getKeyframes().some((frame) => "height" in frame));
  });
  expect(animated).toBe(true);
  await expect(computerScience.locator(".program-card__body")).toBeVisible();
  await expect(softwareEngineering.locator(".program-card__body")).toBeVisible();
  await softwareEngineering.locator("[data-program-admission]").click();
  await expect(page.locator("#tab-programs")).toHaveClass(/active/);
  await expect(softwareEngineering.locator("[data-selected-program]")).toBeVisible();
  await expect(computerScience.locator(".program-card__body")).toBeVisible();
  await expect(softwareEngineering.locator(".program-card__body")).toBeVisible();
  expect(new URL(page.url()).searchParams.get("admission_program")).toBe("Software Engineering");
  await expect(page.locator("#detailPrograms .program-card:visible").first().locator(".program-card__title")).toHaveText("Software Engineering");
  await page.reload();
  await expect(page.locator("#detailCard")).toHaveClass(/is-mounted/);
  await page.locator('[data-tab="tab-programs"]').click();
  await expect(page.locator("#detailPrograms .program-card:visible").first().locator(".program-card__title")).toHaveText("Software Engineering");
  await expect(page.locator("#detailPrograms .program-card:visible").first().locator("[data-selected-program]")).toBeVisible();
  await page.evaluate(() => localStorage.setItem("unisearch_ui_language_v1", "rus"));
  await page.reload();
  await expect(page.locator("#detailCard")).toHaveClass(/is-mounted/);
  await page.locator('[data-tab="tab-programs"]').click();
  const selected = page.locator("#detailPrograms .program-card:visible").first();
  await expect(selected.locator("[data-selected-program]")).toBeVisible();
  await expect(selected.locator(".admissions-programs__original")).toHaveText("Software Engineering");
  await page.locator('[data-tab="tab-admission"]').click();
  await expect(page.locator('#detailRequirements [data-admission-program="software_engineering"].is-active')).toBeVisible();
});

test("Oxford cards show only stored facts and keep the bottom selection offset on mobile", async ({ page }) => {
  await openPrograms(page, "university-of-oxford-uk-oxford", { language: "rus", theme: "dark", width: 390 });
  const card = page.locator("#detailPrograms .program-card").filter({ has: page.locator(".program-card__title", { hasText: "Компьютерные науки" }) }).first();
  await expect(card).toBeVisible();
  await expect(card.locator(".program-card__kicker")).not.toBeEmpty();
  await card.locator("[data-program-toggle]").click();
  await expect(card.locator(".program-card__body")).toBeVisible();
  await expect(card.locator(".program-card__body")).not.toContainText("Подробное описание пока не добавлено");
  await expect.poll(() => card.locator(".program-card__body").evaluate((body) => body.getAnimations().length)).toBe(0);
  const references = card.locator(".admissions-programs__references");
  await references.locator(":scope > summary").click();
  await expect(references).toHaveAttribute("open", "");
  await expect(card.locator('.program-card__source[href^="https://www.ox.ac.uk/"]')).toBeVisible();
  await card.locator("[data-program-admission]").click();
  await expect(card.locator("[data-selected-program]")).toBeVisible();
  const bottom = await card.evaluate((element) => {
    const action = element.querySelector(".program-card__selection-state").getBoundingClientRect();
    return Math.round(element.getBoundingClientRect().bottom - action.bottom);
  });
  expect(bottom).toBe(12);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test("catalog program essentials are plain text below the description on desktop", async ({ page }) => {
  await openPrograms(page, "university-of-oxford-uk-oxford");
  const card = page.locator("#detailPrograms .program-card").filter({ has: page.locator(".program-card__title", { hasText: "Computer Science" }) }).first();
  await card.locator("[data-program-toggle]").click();
  const overview = card.locator(".admissions-programs__overview");
  const directions = overview.locator(".program-card__description").last();
  const essentials = overview.locator(".admissions-programs__essentials");
  await expect(directions).toBeVisible();
  await expect(essentials).toBeVisible();
  await expect(essentials.locator(".program-tag, .program-pill")).toHaveCount(0);
  const positions = await overview.evaluate((element) => {
    const description = element.querySelector(".program-card__description").getBoundingClientRect();
    const table = element.querySelector(".admissions-programs__essentials").getBoundingClientRect();
    return { descriptionBottom: description.bottom, descriptionLeft: description.left, tableTop: table.top, tableLeft: table.left };
  });
  expect(positions.tableTop).toBeGreaterThanOrEqual(positions.descriptionBottom);
  expect(Math.abs(positions.tableLeft - positions.descriptionLeft)).toBeLessThanOrEqual(1);
});

test("catalog search uses the reviewed toolbar layout and finds stored program names", async ({ page }) => {
  await openPrograms(page, "university-of-oxford-uk-oxford", { language: "rus", theme: "dark" });
  const form = page.locator("#detailPrograms [data-program-search-form]");
  const label = form.locator('label[for="program-search-input"]');
  const search = form.locator("[data-program-search]");
  const submit = form.locator("[data-program-search-submit]");
  await expect(label).toHaveText("Программа или предмет");
  await expect(search).toHaveAttribute("placeholder", "Поиск программ...");
  await expect(submit).toHaveText("Найти");
  const positions = await form.evaluate((element) => {
    const caption = element.querySelector("label").getBoundingClientRect();
    const input = element.querySelector("input").getBoundingClientRect();
    return { captionBottom: caption.bottom, inputTop: input.top };
  });
  expect(positions.inputTop).toBeGreaterThan(positions.captionBottom);
  await search.fill("PPE");
  await submit.click();
  const cards = page.locator("#detailPrograms .program-list .program-card:visible");
  await expect(cards).toHaveCount(1);
  await expect(cards.first().locator(".program-card__title")).toContainText("PPE");
  await form.locator("[data-program-search-clear]").click();
  await expect(cards).not.toHaveCount(1);
});

for (const { university, option, search, hasEssentials } of [
  { university: "mit-usa-cambridge", option: "mit-course-6-3-bachelor", search: "Computer Science", hasEssentials: true },
  { university: "imperial-college-london-uk", option: "imperial-option-computing-meng", search: "Computing", hasEssentials: true },
  { university: "stanford-university-usa-ca", option: "stanford-option-cs-bs", search: "Computer Science", hasEssentials: false },
]) {
  test(`${university} keeps its study overview in one column`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem("unisearch_ui_language_v1", "eng");
      localStorage.setItem("unisearch_theme", "light");
      localStorage.setItem("unisearch_universities_tour_seen_v1", "1");
    });
    await page.goto(`/university.html?id=${university}`);
    await expect(page.locator("body")).toHaveAttribute("data-page", "university");
    await expect(page.locator("#admissionsContext")).toHaveAttribute("data-state", "ready");
    await page.locator('[data-tab="tab-programs"]').click();
    await page.locator("#admissionsSearch").fill(search);
    await page.locator("#admissionsSearchSubmit").click();
    const toggle = page.locator(`[data-study-option="${option}"]`);
    await expect(toggle).toBeVisible();
    await toggle.click();
    await toggle.locator("xpath=..").locator("[data-select-study-option]").click();
    const overview = page.locator("#admissionsStudyOverview");
    const description = overview.locator(":scope > .program-card__description");
    const essentials = overview.locator(":scope > .admissions-programs__essentials");
    await expect(description).toBeVisible();
    expect(await overview.evaluate((element) => getComputedStyle(element).gridTemplateColumns.trim().split(/\s+/).length)).toBe(1);
    if (!hasEssentials) return;
    await expect(essentials).toBeVisible();
    const positions = await overview.evaluate((element) => {
      const text = element.querySelector(".program-card__description").getBoundingClientRect();
      const table = element.querySelector(".admissions-programs__essentials").getBoundingClientRect();
      return { textBottom: text.bottom, textLeft: text.left, tableTop: table.top, tableLeft: table.left };
    });
    expect(positions.tableTop).toBeGreaterThanOrEqual(positions.textBottom);
    expect(Math.abs(positions.tableLeft - positions.textLeft)).toBeLessThanOrEqual(1);
  });
}
