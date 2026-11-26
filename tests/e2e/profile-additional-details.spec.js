const { test, expect } = require("./helpers/coverage-test.cjs");
const { openProfileTab, setNativeSelect } = require("./helpers/selectors");

test("additional details show relevant fields and preserve saved entries", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("unisearch_ui_language_v1", "rus"));
  await page.goto("/profile.html");
  await page.waitForFunction(() => !!window.__unisearchProfileDraft);
  await openProfileTab(page, "specific");
  await expect(page.locator("#languageEvidenceKind")).toHaveValue("");
  await expect(page.locator("#addLanguageEvidence")).toBeHidden();
  await expect(page.locator("[data-institution-university-field]")).toBeHidden();
  await expect(page.locator("[data-institution-kind-field]")).toBeVisible();
  await expect(page.locator("#addInstitutionEvidence")).toBeHidden();
  await setNativeSelect(page, "languageEvidenceKind", "primary_language");
  await page.locator("#addLanguageEvidence").click();
  await expect(page.locator("#languageEvidenceList")).toContainText("Английский — первый язык");
  await expect(page.locator("#languageEvidenceList")).not.toContainText("EN");
  await expect(page.locator("#languageEvidenceKind")).toHaveValue("");
  await setNativeSelect(page, "institutionEvidenceKind", "credential");
  await expect(page.locator("#addInstitutionEvidence")).toBeVisible();
  await page.locator("#languageEvidenceList [data-remove-language-evidence]").click();
  await expect(page.locator("#languageEvidenceList .profile-exam-item")).toHaveCount(0);
});
