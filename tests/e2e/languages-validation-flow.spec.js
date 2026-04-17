const { test, expect } = require("@playwright/test");
const { markTourAsSeen } = require("./helpers/personas");
const { selectors, setNativeSelect } = require("./helpers/selectors");

test("languages panel validates and saves realistic exam-based language proof", async ({ page }) => {
  await markTourAsSeen(page);
  await page.goto("/universities.html");

  await page.click(selectors.profileBtn);
  await expect(page.locator(selectors.profileModal)).toHaveClass(/is-open/);
  await page.click("[data-profile-tab='languages']");
  await page.waitForSelector(selectors.langCode, { state: "attached" });

  await page.waitForFunction(() => {
    const code = document.getElementById("langCode");
    const kind = document.getElementById("langKind");
    return !!code && !!kind && code.options.length > 1 && kind.options.length > 1;
  });

  await setNativeSelect(page, "langCode", "en");
  await setNativeSelect(page, "langKind", "exam");
  await page.waitForFunction(() => {
    const code = document.getElementById("langCode");
    const kind = document.getElementById("langKind");
    const select = document.getElementById("langExam");
    return (
      !!code &&
      !!kind &&
      code.value === "en" &&
      kind.value === "exam" &&
      !!select &&
      select.options.length > 1
    );
  });
  await setNativeSelect(page, "langExam", "IELTS");
  await page.fill(selectors.langExamScore, "7.5");

  const validationResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/languages/validate") &&
      response.request().method() === "POST"
  );
  await page.click(selectors.langAddBtn);
  expect((await validationResponse).status()).toBe(200);

  const entries = page.locator("#langList .lang-item");
  await expect(entries).toHaveCount(1);
  await expect(entries.first()).toContainText("IELTS");

  await page.click("#langList .lang-item .profile-delete");
  await expect(entries).toHaveCount(0);
});
