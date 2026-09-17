const { test, expect } = require("@playwright/test");
const { markTourAsSeen } = require("./helpers/personas");
const { openProfileTab, selectors, setNativeSelect } = require("./helpers/selectors");
const { mockAllExpensiveEndpoints } = require("./helpers/mocks");

test.describe("Profile completion progress", () => {
  test("reaches 100% strictly when budget, study mode, funding type, GPA, exam, language, and major are filled", async ({ page }) => {
    await mockAllExpensiveEndpoints(page);
    await markTourAsSeen(page);
    await page.goto("/profile.html");

    await expect(page.locator(selectors.profileModal)).toBeVisible();

    const progressFill = page.locator("#profileProgressFill");
    const progressText = page.locator("#profileProgressText");

    // Fresh profile starts with default study mode ("Any") and funding type ("any") -> 2/7 (29%)
    await expect(progressFill).toHaveAttribute("style", /width:\s*29%;/);
    await expect(progressText).toContainText("2/7");

    // 1. Fill Budget -> 3/7 (43%)
    await page.fill(selectors.budgetInput, "30000");
    await expect(page.locator(selectors.budgetInput)).toHaveValue("30000");
    await page.dispatchEvent(selectors.budgetInput, "input");
    await expect(progressFill).toHaveAttribute("style", /width:\s*43%;/);
    await expect(progressText).toContainText("3/7");

    // 2. Fill GPA -> 4/7 (57%)
    await openProfileTab(page, "scores");
    await page.fill(selectors.gpaInput, "3.85");
    await page.dispatchEvent(selectors.gpaInput, "input");
    await expect(progressFill).toHaveAttribute("style", /width:\s*57%;/);
    await expect(progressText).toContainText("4/7");

    // 3. Add Exam -> 5/7 (71%)
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
    await expect(progressFill).toHaveAttribute("style", /width:\s*71%;/);
    await expect(progressText).toContainText("5/7");

    // 4. Add Language -> 6/7 (86%)
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
    await expect(progressFill).toHaveAttribute("style", /width:\s*86%;/);
    await expect(progressText).toContainText("6/7");

    // 5. Select Major -> 7/7 (100%!)
    await openProfileTab(page, "preferences");
    await page.waitForFunction(() => {
      const select = document.getElementById("profileMajorSelect");
      return !!select && select.options.length > 1;
    });
    await setNativeSelect(page, "profileMajorSelect", "Computer Science");
    await expect(progressFill).toHaveAttribute("style", /width:\s*100%;/);
    await expect(progressText).toContainText("7/7");

    // Entering interests does not alter 100% completion
    await page.fill(selectors.interestsInput, "machine learning, research, robotics");
    await page.dispatchEvent(selectors.interestsInput, "input");
    await page.dispatchEvent(selectors.interestsInput, "change");
    await expect(progressFill).toHaveAttribute("style", /width:\s*100%;/);
    await expect(progressText).toContainText("7/7");
  });
});
