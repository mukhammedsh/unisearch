const { test, expect } = require("./helpers/coverage-test.cjs");
const { markTourAsSeen } = require("./helpers/personas");
const { openProfileTab, selectors, setNativeSelect } = require("./helpers/selectors");
const { expectNoStackedGapMargins } = require("./helpers/design");

async function openScores(page) {
  await markTourAsSeen(page);
  await page.goto("/profile.html");
  await page.waitForFunction(() => !!window.__unisearchProfileDraft);
  await openProfileTab(page, "scores");
  await page.waitForFunction(() => document.getElementById("examNameSelect")?.options.length > 1);
  await expectNoStackedGapMargins(page, ".profile-main-content");
}

test("invalid NUET sections identify and focus one named field without saving", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("unisearch_ui_language_v1", "eng"));
  await openScores(page);
  await setNativeSelect(page, "examNameSelect", "NUET");
  const math = page.getByRole("spinbutton", { name: "NUET Mathematics", exact: true });
  const thinking = page.getByRole("spinbutton", { name: "NUET Critical Thinking and Problem Solving", exact: true });
  await page.locator(selectors.examScoreInput).fill("120");
  await math.fill("121");
  await thinking.fill("-1");
  await page.locator(selectors.addExamBtn).click();
  await expect(page.locator("#toast-container .toast.error")).toHaveCount(1);
  await expect(page.locator("#toast-container .toast.error")).toContainText("NUET Mathematics");
  await expect(math).toBeFocused();
  await expect(math).toHaveAttribute("aria-invalid", "true");
  await expect(page.locator(selectors.examList)).not.toContainText("121");
  await math.fill("40");
  await thinking.fill("80");
  await expect(math).not.toHaveAttribute("aria-invalid", "true");
  await page.locator(selectors.addExamBtn).click();
  await expect(page.locator(selectors.examList)).toContainText("NUET");
});

test("reported five-point GPA survives save and reaches admissions in its original scale", async ({ page }) => {
  await openScores(page);
  await expect(page.locator(selectors.gpaInput)).toHaveValue("");
  await page.locator("#gpaUnit").click();
  await expect(page.locator("#gpaUnit")).toHaveText("/ 5.0");
  await page.fill(selectors.gpaInput, "4.85");
  await page.click(selectors.saveProfileBtn);
  await expect(page.locator(selectors.saveProfileBtn)).toBeDisabled();
  await page.reload();
  await page.waitForFunction(() => !!window.__unisearchProfileDraft);
  await openProfileTab(page, "scores");
  await expect(page.locator(selectors.gpaInput)).toHaveValue("4.85");
  await expect(page.locator("#gpaUnit")).toHaveText("/ 5.0");

  const response = page.waitForResponse(item => item.url().includes("/universities/mit-usa-cambridge/admissions-context") && item.request().method() === "POST");
  await page.goto("/university.html?id=mit-usa-cambridge&admission_option=mit-course-6-3-bachelor&admission_application_route=mit-first-year&admission_level=undergraduate&admission_route=first_year&admission_cycle=Fall%202027%20entry");
  const evaluated = await response;
  expect(evaluated.status()).toBe(200);
  expect(evaluated.request().postDataJSON().profile).toEqual(expect.objectContaining({ gpa: 4.85, gpa_scale: 5 }));
  await expect(page.locator("#admissionsContext")).toHaveAttribute("data-state", "ready");
});

test("NUET preserves total-only history, validates input, and saves real sections", async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem("nuet-report-seeded")) return;
    sessionStorage.setItem("nuet-report-seeded", "1");
    localStorage.setItem("unisearch_ui_language_v1", "eng");
    localStorage.setItem("unisearch_theme", "light");
    localStorage.setItem("unisearch_config_cache_v2:exams", JSON.stringify({ savedAt: Date.now(), data: { NUET: { label: "NUET", input_mode: "number", min: 0, max: 240 } } }));
    localStorage.setItem("unisearch_profile", JSON.stringify({ _v: 2, exams: [
      { id: "NUET", exam: "NUET", score: 120 },
      { id: "NUET", exam: "NUET", score: 130, taken_on: "2025-12-01", details: { components: [{ exam: "NUET_MATH", score: 80 }, { exam: "NUET_CRITICAL_THINKING", score: 50 }] } },
    ] }));
  });
  await openScores(page);
  await setNativeSelect(page, "examNameSelect", "NUET");
  const math = page.locator("[data-breakdown-fixed-row='NUET_MATH'] [data-breakdown-value='number']");
  const thinking = page.locator("[data-breakdown-fixed-row='NUET_CRITICAL_THINKING'] [data-breakdown-value='number']");
  await expect(page.locator(selectors.examScoreInput)).toHaveValue("120");
  await expect(math).toHaveValue("");
  await expect(thinking).toHaveValue("");

  await page.fill(selectors.examScoreInput, "999");
  await page.click(selectors.addExamBtn);
  await expect(page.locator("#toast-container .toast.error")).toHaveCount(1);
  await expect(page.locator(selectors.examList)).not.toContainText("999");

  await page.fill(selectors.examScoreInput, "");
  await math.fill("70");
  await thinking.fill("50");
  const validation = page.waitForResponse(response => response.url().includes("/exams/validate") && response.request().method() === "POST");
  await page.click(selectors.addExamBtn);
  const response = await validation;
  expect(response.status()).toBe(200);
  expect(response.request().postDataJSON().score).toBeUndefined();
  const result = await response.json();
  expect(result.score).toBe(120);
  expect(result.details.components.map(row => [row.exam, row.score])).toEqual([["NUET_MATH", 70], ["NUET_CRITICAL_THINKING", 50]]);
  await page.click(selectors.saveProfileBtn);
  await expect(page.locator(selectors.saveProfileBtn)).toBeDisabled();
  await page.reload();
  await page.waitForFunction(() => !!window.__unisearchProfileDraft);
  await openProfileTab(page, "scores");
  await setNativeSelect(page, "examNameSelect", "NUET");
  await expect(math).toHaveValue("70");
  await expect(thinking).toHaveValue("50");
  await expect(page.locator(selectors.examScoreInput)).toHaveValue("120");
  await page.locator("[data-edit-idx='1']").click();
  await expect(page.locator("#examTakenOnInput")).toHaveValue("2025-12-01");
  await expect(math).toHaveValue("80");
  await expect(thinking).toHaveValue("50");
  await page.locator("#examSpecialInputContainer").scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("nuet-sections-restored.png") });
});

test("Nursing NAT keeps independent partial results and ALEKS uses its reporting scale", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    localStorage.setItem("unisearch_ui_language_v1", "rus");
    localStorage.setItem("unisearch_theme", "dark");
  });
  await openScores(page);
  await expect(page.locator("html")).toHaveAttribute("lang", "ru");
  const examPicker = page.locator(".custom-select-wrapper:has(#examNameSelect)");
  await examPicker.locator(".custom-select-trigger").click();
  const nursingOption = examPicker.locator(".custom-option[data-value='NURSING_NAT']");
  await expect(nursingOption).toBeVisible();
  expect(await nursingOption.evaluate(option => option.scrollWidth <= option.clientWidth + 1)).toBe(true);
  await nursingOption.click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
  const formBounds = await page.locator(".profile-exam-form").evaluate(form => ({
    right: form.getBoundingClientRect().right,
    selectRight: form.querySelector(".profile-exam-select-wrap").getBoundingClientRect().right,
    buttonRight: form.querySelector("#addExamBtn").getBoundingClientRect().right,
  }));
  expect(formBounds.selectRight).toBeLessThanOrEqual(formBounds.right + 1);
  expect(formBounds.buttonRight).toBeLessThanOrEqual(formBounds.right + 1);
  await expect(page.locator(selectors.examScoreInput)).toBeHidden();
  await page.click(selectors.addExamBtn);
  await expect(page.locator("#toast-container .toast.error")).toHaveCount(1);
  const knowledge = page.locator("[data-breakdown-fixed-row='NAT_KNOWLEDGE'] [data-breakdown-value='number']");
  const clinical = page.locator("[data-breakdown-fixed-row='NAT_CLINICAL_SKILLS'] [data-breakdown-value='number']");
  await knowledge.fill("70");
  let validation = page.waitForResponse(response => response.url().includes("/exams/validate") && response.request().method() === "POST");
  await page.click(selectors.addExamBtn);
  let result = await (await validation).json();
  expect(result.score).toBeUndefined();
  expect(result.details.components).toHaveLength(1);
  await setNativeSelect(page, "examNameSelect", "NURSING_NAT");
  await expect(clinical).toHaveValue("");
  await clinical.fill("69");
  validation = page.waitForResponse(response => response.url().includes("/exams/validate") && response.request().method() === "POST");
  await page.click(selectors.addExamBtn);
  result = await (await validation).json();
  expect(result.score).toBeUndefined();
  expect(result.details.components.map(row => row.score)).toEqual([70, 69]);

  await setNativeSelect(page, "examNameSelect", "ALEKS");
  await expect(page.locator(selectors.examScoreInput)).toHaveAttribute("min", "1");
  await expect(page.locator(selectors.examScoreInput)).toHaveAttribute("max", "100");
  await page.fill(selectors.examScoreInput, "70");
  validation = page.waitForResponse(response => response.url().includes("/exams/validate") && response.request().method() === "POST");
  await page.click(selectors.addExamBtn);
  expect((await validation).status()).toBe(200);
  await page.click(selectors.saveProfileBtn);
  await expect(page.locator(selectors.saveProfileBtn)).toBeDisabled();
  await page.reload();
  await page.waitForFunction(() => !!window.__unisearchProfileDraft);
  await openProfileTab(page, "scores");
  await setNativeSelect(page, "examNameSelect", "NURSING_NAT");
  await expect(knowledge).toHaveValue("70");
  await expect(clinical).toHaveValue("69");
  await page.locator("#examSpecialInputContainer").scrollIntoViewIfNeeded();
  const scrolledParents = await page.locator("#examSpecialInputContainer").evaluate(element => {
    const parents = [];
    for (let node = element; node; node = node.parentElement) {
      if (node.scrollLeft) parents.push({ className: node.className, scrollLeft: node.scrollLeft, width: node.clientWidth, contentWidth: node.scrollWidth });
    }
    return parents;
  });
  expect(scrolledParents).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath("nursing-partial-results.png") });
});

test("residency evidence records dated IFOM and USMLE reports without asserting a pass", async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    localStorage.setItem("unisearch_ui_language_v1", "kaz");
    localStorage.setItem("unisearch_theme", "dark");
    if (sessionStorage.getItem("residency-report-seeded")) return;
    sessionStorage.setItem("residency-report-seeded", "1");
    localStorage.setItem("unisearch_profile", JSON.stringify({ _v: 2, exams: [{ id: "IFOM_BSE", exam: "IFOM_BSE", score: 0, taken_on: "2025-12-01" }] }));
  });
  await openScores(page);
  await expect(page.locator("html")).toHaveAttribute("lang", "kk");
  await expect(page.locator(selectors.examList)).toContainText("Қосылмаған");
  for (const exam of ["IFOM_BSE", "USMLE_STEP_1"]) {
    await setNativeSelect(page, "examNameSelect", exam);
    await expect(page.locator(selectors.examScoreInput)).toBeHidden();
    await page.locator("#examTakenOnInput").fill("2025-12-01");
    const validation = page.waitForResponse(response => response.url().includes("/exams/validate") && response.request().method() === "POST");
    await page.click(selectors.addExamBtn);
    const result = await (await validation).json();
    expect(result.score).toBe(1);
    expect(result.taken_on).toBe("2025-12-01");
  }
  await expect(page.locator(selectors.examList)).not.toContainText(/\bpass(?:ed)?\b/i);
  await page.click(selectors.saveProfileBtn);
  await expect(page.locator(selectors.saveProfileBtn)).toBeDisabled();
  await page.reload();
  await page.waitForFunction(() => !!window.__unisearchProfileDraft);
  await openProfileTab(page, "scores");
  await expect(page.locator(selectors.examList)).toContainText("IFOM");
  await expect(page.locator(selectors.examList)).toContainText("USMLE");
  const reports = await page.evaluate(() => JSON.parse(localStorage.getItem("unisearch_profile")).exams);
  expect(reports.map(row => [row.id, row.score, row.taken_on])).toEqual([["IFOM_BSE", 1, "2025-12-01"], ["USMLE_STEP_1", 1, "2025-12-01"]]);
  await page.locator(selectors.examList).scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("residency-reports.png") });
});

test("profile adds SAT and UNT from their component scores", async ({ page }) => {
  await openScores(page);

  await setNativeSelect(page, "examNameSelect", "SAT");
  await expect(page.locator("#examSpecialInputContainer")).toBeVisible();
  await page.locator("[data-breakdown-fixed-row='SAT_MATH'] [data-breakdown-value='number']").fill("780");
  await page.locator("[data-breakdown-fixed-row='SAT_EBRW'] [data-breakdown-value='number']").fill("760");
  const satResponse = page.waitForResponse((response) => response.url().includes("/exams/validate"));
  await page.click(selectors.addExamBtn);
  expect((await satResponse).status()).toBe(200);
  await expect(page.locator(selectors.examList)).toContainText("SAT");
  await expect(page.locator(selectors.examList)).toContainText("SAT Math 780");

  await setNativeSelect(page, "examNameSelect", "UNT");
  await page.locator("[data-breakdown-fixed-row='UNT_HISTORY_OF_KAZAKHSTAN'] [data-breakdown-value='number']").fill("18");
  await page.locator("[data-breakdown-fixed-row='UNT_READING_LITERACY'] [data-breakdown-value='number']").fill("9");
  await page.locator("[data-breakdown-fixed-row='UNT_MATHEMATICAL_LITERACY'] [data-breakdown-value='number']").fill("9");
  await page.locator("[data-breakdown-subject-select='0']").selectOption("UNT_PROFILE_MATHEMATICS");
  await page.locator("[data-breakdown-slot='selectable-0'][data-breakdown-value='number']").fill("45");
  await page.locator("[data-breakdown-subject-select='1']").selectOption("UNT_PROFILE_PHYSICS");
  await page.locator("[data-breakdown-slot='selectable-1'][data-breakdown-value='number']").fill("45");
  const untResponse = page.waitForResponse((response) => response.url().includes("/exams/validate"));
  await page.click(selectors.addExamBtn);
  expect((await untResponse).status()).toBe(200);
  await expect(page.locator(selectors.examList)).toContainText("UNT");
  await expect(page.locator(selectors.examList)).toContainText("UNT Mathematics 45");
});

test("graduate exams validate separate scales and restore GRE sections after saving", async ({ page }) => {
  await openScores(page);
  await setNativeSelect(page, "examNameSelect", "GRE");
  for (const [exam, score] of [["GRE_VERBAL", "160"], ["GRE_QUANTITATIVE", "168"], ["GRE_ANALYTICAL_WRITING", "4.5"]]) {
    await page.locator(`[data-breakdown-fixed-row='${exam}'] [data-breakdown-value='number']`).fill(score);
  }
  const response = page.waitForResponse((res) => res.url().includes("/exams/validate") && res.request().method() === "POST");
  await page.click(selectors.addExamBtn);
  const gre = await (await response).json();
  expect(gre.score).toBeUndefined();
  await expect(page.locator(selectors.examList)).toContainText("160");
  await expect(page.locator(selectors.examList)).toContainText("168");
  await expect(page.locator(selectors.examList)).toContainText("4.5");
  await setNativeSelect(page, "examNameSelect", "GMAT_FOCUS");
  await page.fill(selectors.examScoreInput, "650");
  await page.click(selectors.addExamBtn);
  await expect(page.locator(".toast.error")).toHaveCount(1);
  await expect(page.locator(selectors.examList)).not.toContainText("GMAT");
  await page.fill(selectors.examScoreInput, "655");
  await page.click(selectors.addExamBtn);
  await expect(page.locator(selectors.examList)).toContainText("655");
  await page.click(selectors.saveProfileBtn);
  await expect(page.locator(selectors.saveProfileBtn)).toBeDisabled();
  await page.reload();
  await page.waitForFunction(() => !!window.__unisearchProfileDraft);
  await openProfileTab(page, "scores");
  await expect(page.locator(selectors.examList)).toContainText("168");
  await expect(page.locator(selectors.examList)).toContainText("655");
});
