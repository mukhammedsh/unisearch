const { test, expect } = require("@playwright/test");
const { markTourAsSeen } = require("./helpers/personas");
const { selectors, setNativeSelect } = require("./helpers/selectors");

test("languages panel validates and saves realistic exam-based language proof", async ({ page }) => {
  await markTourAsSeen(page);
  await page.goto("/index.html");

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
  await expect(page.locator(selectors.langExamScore)).toBeHidden();
  const sectionScores = {
    IELTS_LISTENING: "8.0",
    IELTS_READING: "7.5",
    IELTS_WRITING: "7.0",
    IELTS_SPEAKING: "7.0",
  };
  for (const [exam, score] of Object.entries(sectionScores)) {
    await page.fill(`[data-lang-breakdown-input="${exam}"]`, score);
  }

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

test("languages panel accepts all 9.0 section scores for IELTS", async ({ page }) => {
  await markTourAsSeen(page);
  await page.goto("/index.html");

  await page.click(selectors.profileBtn);
  await expect(page.locator(selectors.profileModal)).toHaveClass(/is-open/);
  await page.click("[data-profile-tab='languages']");
  await page.waitForSelector(selectors.langCode, { state: "attached" });

  await setNativeSelect(page, "langCode", "en");
  await setNativeSelect(page, "langKind", "exam");
  await page.waitForFunction(() => {
    const select = document.getElementById("langExam");
    return !!select && select.options.length > 1;
  });
  await setNativeSelect(page, "langExam", "IELTS");

  for (const exam of ["IELTS_LISTENING", "IELTS_READING", "IELTS_WRITING", "IELTS_SPEAKING"]) {
    await page.fill(`[data-lang-breakdown-input="${exam}"]`, "9");
  }

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
});
