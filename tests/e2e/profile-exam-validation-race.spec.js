const { test, expect } = require("./helpers/coverage-test.cjs");
const { markTourAsSeen } = require("./helpers/personas");
const { openProfileTab, selectors, setNativeSelect } = require("./helpers/selectors");

test("pending exam validation prevents duplicate submits and keeps newer input", async ({ page }) => {
  await markTourAsSeen(page);
  await page.goto("/profile.html");
  await expect(page.locator("#profilePage")).toBeVisible();
  await page.waitForFunction(() => !!window.__unisearchProfileDraft);
  await openProfileTab(page, "scores");
  await page.waitForFunction(() => document.getElementById("examNameSelect")?.options.length > 1);

  let requestCount = 0;
  let releaseResponse;
  const responseGate = new Promise((resolve) => { releaseResponse = resolve; });
  await page.route("**/exams/validate", async (route) => {
    requestCount += 1;
    const payload = route.request().postDataJSON();
    await responseGate;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, exam: payload.exam, score: payload.score }),
    });
  });

  try {
    await setNativeSelect(page, "examNameSelect", "ACT");
    await page.locator(selectors.examScoreInput).fill("32");
    await page.locator(selectors.addExamBtn).click();
    await expect(page.locator(selectors.addExamBtn)).toBeDisabled();
    await expect.poll(() => requestCount).toBe(1);

    await page.locator(selectors.examScoreInput).fill("34");
    await page.locator(selectors.addExamBtn).dispatchEvent("click");
    await expect.poll(() => requestCount).toBe(1);

    releaseResponse();
    await expect(page.locator("#examList .profile-exam-item")).toHaveCount(1);
    await expect(page.locator(selectors.examScoreInput)).toHaveValue("34");
    await expect(page.locator(selectors.addExamBtn)).toBeEnabled();
    await expect(page.locator("#examList")).toContainText("32");
  } finally {
    releaseResponse();
  }
});

test("a stale exam validation error does not invalidate or clear newer input", async ({ page }) => {
  await markTourAsSeen(page);
  await page.goto("/profile.html");
  await expect(page.locator("#profilePage")).toBeVisible();
  await page.waitForFunction(() => !!window.__unisearchProfileDraft);
  await openProfileTab(page, "scores");
  await page.waitForFunction(() => document.getElementById("examNameSelect")?.options.length > 1);

  let releaseResponse;
  const responseGate = new Promise((resolve) => { releaseResponse = resolve; });
  await page.route("**/exams/validate", async (route) => {
    await responseGate;
    await route.fulfill({
      status: 400,
      contentType: "application/json",
      body: JSON.stringify({ detail: "Invalid submitted score" }),
    });
  });

  try {
    await setNativeSelect(page, "examNameSelect", "ACT");
    await page.locator(selectors.examScoreInput).fill("32");
    await page.locator(selectors.addExamBtn).click();
    await expect(page.locator(selectors.addExamBtn)).toBeDisabled();
    await page.locator(selectors.examScoreInput).fill("34");
    releaseResponse();

    await expect(page.locator(selectors.examScoreInput)).toHaveValue("34");
    await expect(page.locator(".toast.error")).toHaveCount(0);
    await expect(page.locator(selectors.addExamBtn)).toBeEnabled();
  } finally {
    releaseResponse();
  }
});
