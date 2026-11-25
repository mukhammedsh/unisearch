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

async function openPage(page, path) {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await markTourAsSeen(page);
  await page.addInitScript(() => localStorage.setItem("unisearch_ui_language_v1", "eng"));
  await page.goto(path);
  await expect(page.locator("#siteInitialLoader")).toBeHidden();
}

test("page disclosures opt into smooth opening", async ({ page }) => {
  for (const path of ["/university.html?id=mit-usa-cambridge", "/guide.html"]) {
    await openPage(page, path);
    await page.waitForTimeout(500);
    // Excluded on purpose: references inside program cards (their card animates its own height) and the
    // admissions route and context controls, which code opens and then reads at once.
    const missing = await page.evaluate(() => Array.from(
      document.querySelectorAll("details:not(.motion-disclosure, .admissions-programs__references, .admissions-context__advanced, .admissions-special-routes)"),
      (el) => el.className,
    ));
    expect(missing, path).toEqual([]);
  }
});

test("a university disclosure grows open", async ({ page }) => {
  await openPage(page, "/university.html?id=mit-usa-cambridge");
  await page.waitForTimeout(500);
  const sizes = await page.evaluate(async () => {
    const el = Array.from(document.querySelectorAll("details.motion-disclosure:not([open])"))
      .find((node) => node.getClientRects().length > 0);
    if (!el) return null;
    el.scrollIntoView({ block: "center" });
    const height = () => Number.parseFloat(getComputedStyle(el, "::details-content").blockSize) || 0;
    el.open = true;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const early = height();
    await new Promise((resolve) => setTimeout(resolve, 400));
    return { early, final: height() };
  });
  expect(sizes).not.toBeNull();
  expect(sizes.final).toBeGreaterThan(0);
  expect(sizes.early).toBeLessThan(sizes.final);
});
