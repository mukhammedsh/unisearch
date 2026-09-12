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

test("profile keeps the edit-name control beside its input", async ({ page }) => {
  await openScores(page);
  await page.setViewportSize({ width: 320, height: 700 });
  await page.click(selectors.editNameBtn);

  const positions = await page.evaluate(() => {
    const input = document.getElementById("profileNameInput")?.getBoundingClientRect();
    const button = document.getElementById("editNameBtn")?.getBoundingClientRect();
    return { input: { top: input.top, right: input.right }, button: { top: button.top, left: button.left } };
  });
  expect(Math.abs(positions.button.top - positions.input.top)).toBeLessThanOrEqual(1);
  expect(positions.button.left).toBeGreaterThanOrEqual(positions.input.right);
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
