const { test, expect } = require("./helpers/coverage-test.cjs");
const { markTourAsSeen } = require("./helpers/personas");
const { openProfileTab, selectors, setNativeSelect } = require("./helpers/selectors");
const { mockAllExpensiveEndpoints } = require("./helpers/mocks");

const rowState = (page, id) => page.locator(`[data-summary-row="${id}"]`);

test.describe("Profile summary follows the draft", () => {
  test("each answer switches its summary row to used before saving", async ({ page }) => {
    await mockAllExpensiveEndpoints(page);
    await markTourAsSeen(page);
    await page.addInitScript(() => localStorage.setItem("unisearch_ui_language_v1", "eng"));
    await page.goto("/profile.html");

    await expect(page.locator(selectors.profileModal)).toBeVisible();
    await expect(page.locator("#profileSummaryList li")).toHaveCount(5);
    for (const id of ["level", "subject", "budget", "format", "requirements"]) {
      await expect(rowState(page, id)).toHaveAttribute("data-state", "not_used");
    }

    await page.fill(selectors.budgetInput, "30000");
    await expect(rowState(page, "budget")).toHaveAttribute("data-state", "used");

    await openProfileTab(page, "scores");
    await page.fill(selectors.gpaInput, "3.85");
    await expect(rowState(page, "requirements")).toHaveAttribute("data-state", "used");
    await expect(rowState(page, "requirements")).toContainText("GPA");

    await page.waitForFunction(() => {
      const select = document.getElementById("examNameSelect");
      return !!select && select.options.length > 1;
    });
    await setNativeSelect(page, "examNameSelect", "ACT");
    await page.fill(selectors.examScoreInput, "33");
    const examValidateResponse = page.waitForResponse(
      (response) => response.url().includes("/exams/validate") && response.request().method() === "POST"
    );
    await page.click(selectors.addExamBtn);
    expect((await examValidateResponse).status()).toBe(200);
    await expect(page.locator(selectors.examList)).toContainText("ACT");
    await expect(rowState(page, "requirements")).toContainText("exams");

    await openProfileTab(page, "languages");
    await page.waitForFunction(() => {
      const select = document.getElementById("langCode");
      return !!select && select.options.length > 1;
    });
    await setNativeSelect(page, "langCode", "en");
    await setNativeSelect(page, "langKind", "native");
    const langValidateResponse = page.waitForResponse(
      (response) => response.url().includes("/languages/validate") && response.request().method() === "POST"
    );
    await page.click(selectors.langAddBtn);
    expect((await langValidateResponse).status()).toBe(200);
    await expect(page.locator("#langList .lang-item")).toHaveCount(1);
    await expect(rowState(page, "requirements")).toContainText("languages");

    await openProfileTab(page, "basics");
    await page.waitForFunction(() => {
      const select = document.getElementById("profileMajorSelect");
      return !!select && select.options.length > 1;
    });
    await setNativeSelect(page, "profileMajorSelect", "Computer Science");
    await expect(rowState(page, "subject")).toHaveAttribute("data-state", "used");
    await setNativeSelect(page, "studyLevelSelect", "Bachelor");
    await expect(rowState(page, "level")).toHaveAttribute("data-state", "used");

    // Interests alone keep the subject row used.
    await page.fill(selectors.interestsInput, "machine learning, research, robotics");
    await expect(rowState(page, "subject")).toHaveAttribute("data-state", "used");
    await expect(page.locator("#profileSummarySentence")).toContainText("of 5");
  });
});
