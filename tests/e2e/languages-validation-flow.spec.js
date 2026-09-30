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


test("Cambridge C2 remains a distinct certificate after profile save and reload", async ({ page }) => {
  const { openProfileTab } = require("./helpers/selectors");
  await markTourAsSeen(page);
  await page.goto("/profile.html");
  await page.waitForFunction(() => !!window.__unisearchProfileDraft);
  await openProfileTab(page, "languages");
  await page.waitForFunction(() => document.getElementById("langCode")?.options.length > 1);
  await setNativeSelect(page, "langCode", "en");
  await setNativeSelect(page, "langKind", "exam");
  await page.waitForFunction(() => document.getElementById("langExam")?.options.length > 1);
  await setNativeSelect(page, "langExam", "Cambridge_C2_Proficiency");
  await expect(page.locator(selectors.langExamScore)).toHaveAttribute("min", "162");
  await expect(page.locator(selectors.langExamScore)).toHaveAttribute("max", "230");
  await page.locator(selectors.langExamScore).fill("231");
  await page.locator(selectors.langAddBtn).click();
  await expect(page.locator(".toast.error")).toHaveCount(1);
  await expect(page.locator("#langList .lang-item")).toHaveCount(0);
  await page.locator(selectors.langExamScore).fill("220");
  const validated = page.waitForResponse((response) => response.url().includes("/languages/validate") && response.request().method() === "POST");
  await page.locator(selectors.langAddBtn).click();
  expect((await validated).status()).toBe(200);
  await expect(page.locator("#langList")).toContainText("Cambridge C2 Proficiency");
  await page.locator(selectors.saveProfileBtn).click();
  await expect(page.locator(selectors.saveProfileBtn)).toBeDisabled();
  await page.reload();
  await page.waitForFunction(() => !!window.__unisearchProfileDraft);
  await openProfileTab(page, "languages");
  await expect(page.locator("#langList")).toContainText("Cambridge C2 Proficiency");
  await expect(page.locator("#langList")).toContainText("220");
  expect(await page.evaluate(() => window.__unisearchProfileDraft.get().languages[0].exam)).toBe("Cambridge_C2_Proficiency");
});
