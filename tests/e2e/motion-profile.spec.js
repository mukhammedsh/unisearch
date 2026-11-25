// Profile and page motion (stage 4 of docs/superpowers/specs/2026-11-25-motion-system-design.md).
const { test, expect } = require("./helpers/coverage-test.cjs");
const { markTourAsSeen } = require("./helpers/personas");
const { openProfileTab, selectors, setNativeSelect } = require("./helpers/selectors");
const { installMotionRecorder } = require("./helpers/motion");

async function openProfileScores(page, reducedMotion) {
  await page.emulateMedia({ reducedMotion });
  await markTourAsSeen(page);
  await page.addInitScript(() => localStorage.setItem("unisearch_ui_language_v1", "eng"));
  await page.goto("/profile.html");
  await expect(page.locator(selectors.profileModal)).toBeVisible();
  await openProfileTab(page, "scores");
  await page.waitForFunction(() => (document.getElementById("examNameSelect")?.options.length || 0) > 1);
}

async function addExam(page, exam, score) {
  await setNativeSelect(page, "examNameSelect", exam);
  await page.fill(selectors.examScoreInput, score);
  const validated = page.waitForResponse((response) => response.url().includes("/exams/validate") && response.request().method() === "POST");
  await page.click(selectors.addExamBtn);
  await validated;
  await expect(page.locator(selectors.examList)).toContainText(exam);
}

async function recordRowKeyframes(page) {
  await page.evaluate(() => {
    window.__rowFrames = [];
    const original = Element.prototype.animate;
    Element.prototype.animate = function animate(keyframes, options) {
      if (this.classList?.contains("profile-exam-item")) window.__rowFrames.push(keyframes);
      return original.call(this, keyframes, options);
    };
  });
}

test("only the exam row that changed moves", async ({ page }) => {
  await openProfileScores(page, "no-preference");
  await addExam(page, "ACT", "33");
  await installMotionRecorder(page);
  await addExam(page, "SAT", "1400");
  const rows = page.locator(`${selectors.examList} .profile-exam-item`);
  await expect(rows).toHaveCount(2);
  const entering = await page.evaluate(() => document.querySelectorAll("#examList .profile-exam-item.motion-list-item-enter").length);
  expect(entering).toBe(1);

  await recordRowKeyframes(page);
  await rows.first().locator("button[data-idx]").click();
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText("SAT");
  const frames = await page.evaluate(() => window.__rowFrames);
  expect(frames.length).toBeGreaterThan(0);
  expect(Object.keys(frames[0][0])).toContain("height");
});

test("exam rows change instantly with reduced motion", async ({ page }) => {
  await openProfileScores(page, "reduce");
  await addExam(page, "ACT", "33");
  await page.locator(`${selectors.examList} .profile-exam-item button[data-idx]`).first().click();
  await expect(page.locator(`${selectors.examList} .profile-exam-item`)).toHaveCount(0);
});
