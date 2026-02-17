const { test, expect } = require("@playwright/test");
const { markTourAsSeen } = require("./helpers/personas");
const { selectors, setNativeSelect } = require("./helpers/selectors");

test("profile accepts realistic user input and persists after reload", async ({ page }) => {
  await markTourAsSeen(page);
  await page.goto("/universities.html");

  await expect(page.locator(selectors.profileBtn)).toBeVisible();
  await page.click(selectors.profileBtn);
  await expect(page.locator(selectors.profileModal)).toHaveClass(/is-open/);

  await page.click(selectors.editNameBtn);
  await page.fill(selectors.nameInput, "Aruzhan Dev");
  await page.fill(selectors.budgetInput, "23000");
  await page.fill(selectors.gpaInput, "95");

  await setNativeSelect(page, "studyModeSelect", "On-campus");
  await setNativeSelect(page, "profileFundingTypeSelect", "grant");
  await setNativeSelect(page, "profileMajorSelect", "Computer Science");

  const naturalInterestText =
    "Хочу сильный AI/ML университет, gamedev и ui/ux направления, желательно research campus в США.";
  await page.fill(selectors.interestsInput, naturalInterestText);
  await page.dispatchEvent(selectors.interestsInput, "change");

  await page.waitForFunction(() => {
    const select = document.getElementById("examNameSelect");
    return !!select && select.options.length > 1;
  });
  await setNativeSelect(page, "examNameSelect", "SAT");
  await page.fill(selectors.examScoreInput, "1480");
  const examValidateResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/exams/validate") &&
      response.request().method() === "POST"
  );
  await page.click(selectors.addExamBtn);
  expect((await examValidateResponse).status()).toBe(200);
  await expect(page.locator(selectors.examList)).toContainText("SAT");

  await page.click(selectors.saveProfileBtn);

  await page.click(selectors.profileCloseBtn);
  await page.reload();
  await page.click(selectors.profileBtn);

  await expect(page.locator(selectors.nameInput)).toHaveValue("Aruzhan Dev");
  await expect(page.locator(selectors.budgetInput)).toHaveValue("23000");
  await expect(page.locator(selectors.gpaInput)).toHaveValue("95");
  await expect(page.locator(selectors.interestsInput)).toHaveValue(naturalInterestText);
  await expect(page.locator(selectors.examList)).toContainText("SAT");
});
