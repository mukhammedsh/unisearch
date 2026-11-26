const { test, expect } = require("./helpers/coverage-test.cjs");
const { markTourAsSeen } = require("./helpers/personas");
const { openProfileTab, selectors, setNativeSelect } = require("./helpers/selectors");
const { mockAllExpensiveEndpoints } = require("./helpers/mocks");

const tabState = (page, id) => page.locator(`[data-profile-tab="${id}"]`);

test.describe("Profile section markers follow the draft", () => {
  test("each answer marks its section before saving", async ({ page }) => {
    await mockAllExpensiveEndpoints(page);
    await markTourAsSeen(page);
    await page.addInitScript(() => localStorage.setItem("unisearch_ui_language_v1", "eng"));
    await page.goto("/profile.html");

    await expect(page.locator(selectors.profileModal)).toBeVisible();
    await expect(tabState(page, "preferences")).toHaveAttribute("data-filled", "false");

    await page.fill(selectors.budgetInput, "30000");
    await expect(tabState(page, "preferences")).toHaveAttribute("data-filled", "true");

    await openProfileTab(page, "scores");
    await page.fill(selectors.gpaInput, "3.85");
    await expect(tabState(page, "scores")).toHaveAttribute("data-filled", "true");

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

    await openProfileTab(page, "basics");
    await page.waitForFunction(() => {
      const select = document.getElementById("profileMajorSelect");
      return !!select && select.options.length > 1;
    });
    await setNativeSelect(page, "profileMajorSelect", "Computer Science");
    await expect(tabState(page, "basics")).toHaveAttribute("data-filled", "true");
    await setNativeSelect(page, "studyLevelSelect", "Bachelor");
    await expect(tabState(page, "basics")).toHaveAttribute("data-filled", "true");

    // Interests alone keep the subject row used.
    await page.fill(selectors.interestsInput, "machine learning, research, robotics");
    await expect(tabState(page, "basics")).toHaveAttribute("data-filled", "true");
  });
});
