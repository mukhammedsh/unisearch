const { test, expect } = require("@playwright/test");
const { markTourAsSeen } = require("./helpers/personas");
const { openProfileTab, selectors, setNativeSelect } = require("./helpers/selectors");

async function openScores(page) {
  await markTourAsSeen(page);
  await page.goto("/profile.html");
  await page.waitForFunction(() => !!window.__unisearchProfileDraft);
  await openProfileTab(page, "scores");
  await page.waitForFunction(() => document.getElementById("examNameSelect")?.options.length > 1);
}

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
