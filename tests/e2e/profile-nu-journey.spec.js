const { test, expect } = require("./helpers/coverage-test.cjs");
const { markTourAsSeen } = require("./helpers/personas");
const { setNativeSelect } = require("./helpers/selectors");

const NU = "nazarbayev-university-kaz-astana";

async function openProfileEditor(page, section) {
  await page.addInitScript(() => localStorage.setItem("unisearch_ui_language_v1", "eng"));
  await page.goto("/profile.html");
  await expect(page.locator("#profileBudgetUnit")).toHaveAttribute("aria-label", /Change budget currency/);
  await page.locator(`[data-profile-tab='${section}']`).click();
}

test("pending catalog search cannot replace the university destination during SPA navigation", async ({ page }) => {
  await markTourAsSeen(page);
  await page.addInitScript(() => localStorage.setItem("unisearch_ui_language_v1", "eng"));
  await page.goto("/index.html");
  await expect(page.locator("#universitiesList .uni-card:not(.is-skeleton)").first()).toBeVisible();
  await page.route("**/university.html?**", async route => {
    const response = await route.fetch();
    await new Promise(resolve => setTimeout(resolve, 600));
    await route.fulfill({ response });
  });
  await page.locator("#qInput").fill("NU");
  await page.locator(`#universitiesList a[href*='id=${NU}']`).click();
  await expect(page.locator("#admissionsContext")).toHaveAttribute("data-state", "ready");
  expect(new URL(page.url()).searchParams.get("id")).toBe(NU);
  await expect(page.locator("#detailName")).toHaveText("Nazarbayev University");
  await page.locator("#qInput").fill("Nazarbayev");
  // Allow the retired catalog's search debounce to fire on the shared navbar.
  await page.waitForTimeout(450);
  expect(new URL(page.url()).searchParams.get("id")).toBe(NU);
  await expect(page.locator("#detailName")).toHaveText("Nazarbayev University");
});

test("an empty profile keeps advanced evidence fields hidden until their type is selected", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("unisearch_ui_language_v1", "eng"));
  await page.goto("/profile.html");
  await expect(page.locator("#profileBudgetUnit")).toHaveAttribute("aria-label", /Change budget currency/);
  await expect(page.locator("#saveProfileBtn")).toBeDisabled();
  await page.locator(".profile-admission-evidence > summary").click();
  await expect(page.locator("#institutionEvidenceKind")).toHaveValue("");
  await expect(page.locator("[data-institution-evidence-kind='gpa']").first()).toBeHidden();
  await expect(page.locator("[data-institution-evidence-kind='enrollment']").first()).toBeHidden();
  await expect(page.locator("#institutionEvidenceCredentialScoreField")).toBeHidden();
  await setNativeSelect(page, "institutionEvidenceUniversity", "mit-usa-cambridge");
  await setNativeSelect(page, "institutionEvidenceKind", "gpa");
  await expect(page.locator("[data-institution-evidence-kind='gpa']").first()).toBeVisible();
  await expect(page.locator("[data-institution-evidence-kind='enrollment']").first()).toBeHidden();
  await expect(page.locator("#institutionEvidenceCredentialScoreField")).toBeHidden();
});

test("profile money entry accepts group spaces and keeps optional reference data outside matching", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("unisearch_ui_language_v1", "eng"));
  await page.goto("/profile.html");
  await expect(page.locator("#profileBudgetUnit")).toHaveAttribute("aria-label", /Change budget currency/);
  await expect(page.locator(".profile-page-intro")).toContainText("All fields are optional");
  await page.locator("#budgetInput").fill("1 000 000");
  await expect(page.locator("#budgetInput")).toHaveValue("1 000 000");
  await page.locator("#budgetInput").press("Enter");
  await expect(page.locator("#budgetInput")).toHaveValue("1000000");
  await expect(page.locator("#saveProfileBtn")).toBeDisabled();
  await expect(page.locator("#familyIncomeInput")).toBeHidden();
  await page.locator("#familyIncomeDetails > summary").click();
  await expect(page.locator("#familyIncomeDetails")).toContainText("not used in UniFit");
  await page.locator("#familyIncomeInput").fill("85 000,50");
  await page.locator("#familyIncomeInput").press("Enter");
  await expect(page.locator("#familyIncomeInput")).toHaveValue("85000.5");
  await expect(page.locator("#saveProfileBtn")).toBeDisabled();
  await page.reload();
  await expect(page.locator("#budgetInput")).toHaveValue("1000000");
  await expect(page.locator("#familyIncomeInput")).toHaveValue("85000.5");
});

test("currency settings do not silently save unrelated profile drafts", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("unisearch_ui_language_v1", "eng"));
  await page.goto("/profile.html");
  await expect(page.locator("#profileBudgetUnit")).toHaveAttribute("aria-label", /Change budget currency/);
  await page.locator("#budgetInput").fill("20000");
  await page.locator("#budgetInput").press("Enter");
  await expect(page.locator("#saveProfileBtn")).toBeDisabled();
  await page.getByRole("tab", { name: "Preferences", exact: true }).click();
  await page.locator("#profileInterestsInput").fill("robotics and campus research");
  await expect(page.locator("#saveProfileBtn")).toBeEnabled();
  await page.getByRole("tab", { name: "General", exact: true }).click();
  await page.locator("#budgetInput").fill("30000");
  await page.locator("#profileBudgetUnit").click();
  await setNativeSelect(page, "settingPreferredCurrency", "KZT");
  await expect(page.locator("#settingPreferredCurrency")).toHaveValue("KZT");
  await page.locator("#settingsCloseBtn").click();
  await expect(page.locator("#profileBudgetUnit")).toContainText("KZT");
  await expect.poll(async () => Number(await page.locator("#budgetInput").inputValue())).toBeGreaterThan(1000000);
  await expect(page.locator("#saveProfileBtn")).toBeEnabled();
  await expect(page.locator("#profileBudgetUnit")).toBeFocused();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("unisearch_profile")));
  expect(saved.interests || "").toBe("");
  expect(saved.budgetCurrency).toBe("KZT");
  expect(saved.budget).toBeLessThan(Number(await page.locator("#budgetInput").inputValue()));
});

test("saving a profile keeps university choices saved by another tab", async ({ page, context }) => {
  await openProfileEditor(page, "basics");
  await page.locator("#budgetInput").fill("20000");
  await page.locator("#saveProfileBtn").click();
  const university = await context.newPage();
  try {
    await university.goto(`/university.html?id=${NU}&admission_option=nu-a-study-nu-foundation-year-program&admission_application_route=nu-a-route-financial-support&admission_level=preparation`);
    await expect(university.locator("#admissionsContext")).toHaveAttribute("data-state", "ready");
    await university.locator(".d-tab-btn[data-tab='tab-admission']").click();
    await university.locator("#admissionsSaveChoice").click();
    await expect(university.locator("#admissionsSaveStatus")).not.toBeEmpty();
    await page.locator("#budgetInput").fill("25000");
    await page.locator("#saveProfileBtn").click();
    await expect(page.locator("#saveProfileBtn")).toBeDisabled();
    await university.goto(`/university.html?id=${NU}`);
    await expect(university.locator("#admissionsContext")).toHaveAttribute("data-state", "ready");
    await expect(university.locator("#admissionsReferenceSummary")).toContainText("Post-offer financial-support consideration");
    await page.reload();
    await expect(page.locator("#budgetInput")).toHaveValue("25000");
  } finally {
    await university.close();
  }
});

test("a saved NU Foundation choice can be compared with another university on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => localStorage.setItem("unisearch_ui_language_v1", "eng"));
  await page.goto(`/university.html?id=${NU}&admission_option=nu-a-study-nu-foundation-year-program&admission_application_route=nu-a-route-regular-foundation-undergraduate&admission_level=preparation`);
  await expect(page.locator("#admissionsContext")).toHaveAttribute("data-state", "ready");
  await page.locator(".d-tab-btn[data-tab='tab-admission']").click();
  await page.locator("#admissionsSaveChoice").click();
  await expect(page.locator("#admissionsSaveStatus")).not.toBeEmpty();
  const stanford = "stanford-university-usa-ca";
  const loaded = page.waitForResponse(response => response.url().includes(`/universities/${stanford}/admissions-context`));
  await page.goto(`/compare.html?stage=configure&ids=${NU},${stanford}`);
  expect((await loaded).status()).toBe(200);
  const chooser = page.locator(`#compare-options-${stanford}`);
  await chooser.getByText("Choose a program or route", { exact: true }).click();
  await expect(chooser.getByRole("alert")).toHaveCount(0);
  await chooser.getByRole("combobox", { name: "University-wide application route", exact: true }).click();
  await chooser.getByRole("option", { name: "First-year admission after school · Undergraduate", exact: true }).click();
  await chooser.getByRole("button", { name: "Apply filters", exact: true }).click();
  await expect(chooser.locator(".compare-context-current__value")).toContainText("First-year admission");
  await page.locator('[data-action="build-compare-results"]').click();
  await expect(page.locator("[data-reviewed-comparison]")).toContainText("12,000");
  await expect(page.locator("[data-reviewed-comparison]")).toContainText("Stanford");
});

test("an unadded academic report survives translation, blocks false saving, and submits with Enter", async ({ page }) => {
  await openProfileEditor(page, "scores");
  await expect(page.locator("#examNameSelect option[value='NUET']")).toBeAttached();
  await setNativeSelect(page, "examNameSelect", "NUET");
  await page.locator("#examScoreInput").fill("120");
  await page.locator("#examTakenOnInput").fill("2026-03-15");
  await page.locator("[data-breakdown-fixed-row='NUET_MATH'] input").fill("60");
  await page.locator("#saveProfileBtn").click();
  await expect(page.locator("#addExamBtn")).toBeFocused();
  await expect(page.locator("#profileSaveState")).toContainText("Add or update");
  await expect(page.locator("#examList .profile-exam-item")).toHaveCount(0);

  await setNativeSelect(page, "languageSelect", "rus");
  await expect(page.locator("html")).toHaveAttribute("lang", "ru");
  await expect(page.locator("#profileSaveState")).toContainText("Добавьте или обновите");
  await expect(page.locator("#examScoreInput")).toHaveValue("120");
  await expect(page.locator("#examTakenOnInput")).toHaveValue("2026-03-15");
  await expect(page.locator("[data-breakdown-fixed-row='NUET_MATH'] input")).toHaveValue("60");
  await expect(page.locator("#profileModal")).not.toContainText("{max}");
  await page.locator("#profileCloseBtn").click();
  await expect(page.locator("#profileUnsavedModal")).toHaveClass(/is-open/);
  await page.locator("#profileSaveAndCloseBtn").click();
  await expect(page.locator("#profileUnsavedModal")).not.toHaveClass(/is-open/);
  await expect(page.locator("#addExamBtn")).toBeFocused();
  await page.locator("#examScoreInput").press("Enter");
  await expect(page.locator("#examList .profile-exam-item")).toHaveCount(1);
  await expect(page.locator("#examList")).toContainText("120");
  await page.locator("#saveProfileBtn").click();
  await expect(page.locator("#saveProfileBtn")).toBeDisabled();
  await page.reload();
  await expect(page.locator("#profileBudgetUnit[aria-label]")).toBeAttached();
  await page.locator("[data-profile-tab='scores']").click();
  await page.locator("#examList [data-edit-idx='0']").click();
  await expect(page.locator("#examTakenOnInput")).toHaveValue("2026-03-15");
});

test("language editor preserves raw sections and newer pending edits without saving unrelated fields", async ({ page }) => {
  await openProfileEditor(page, "languages");
  await expect(page.locator("#langCode option[value='en']")).toBeAttached();
  await setNativeSelect(page, "langCode", "en");
  await setNativeSelect(page, "langKind", "exam");
  await setNativeSelect(page, "langExam", "IELTS");
  const listening = page.locator("[data-lang-breakdown-input='IELTS_LISTENING']");
  await listening.fill("6.5");
  await page.locator("#langExamTakenOn").fill("2026-03-15");
  await setNativeSelect(page, "languageSelect", "kaz");
  await expect(page.locator("html")).toHaveAttribute("lang", "kk");
  await expect(listening).toHaveValue("6.5");
  await expect(page.locator("#langExamTakenOn")).toHaveValue("2026-03-15");
  await page.locator("#saveProfileBtn").click();
  await expect(page.locator("#langAddBtn")).toBeFocused();
  await expect(page.locator("#langList .lang-item")).toHaveCount(0);
  for (const id of ["IELTS_READING", "IELTS_WRITING", "IELTS_SPEAKING"]) {
    await page.locator(`[data-lang-breakdown-input='${id}']`).fill("6.5");
  }
  let releaseResponse;
  const gate = new Promise(resolve => { releaseResponse = resolve; });
  await page.route("**/languages/validate", async route => {
    const response = await route.fetch();
    await gate;
    await route.fulfill({ response });
  });
  try {
    await listening.press("Enter");
    await expect(page.locator("#langAddBtn")).toBeDisabled();
    await listening.fill("7");
    await page.locator("[data-profile-tab='basics']").click();
    await page.locator("#budgetInput").fill("12345");
    releaseResponse();
    await expect(page.locator("#langList .lang-item")).toHaveCount(1);
    await expect(page.locator("#budgetInput")).toHaveValue("12345");
    await page.locator("[data-profile-tab='languages']").click();
    await expect(listening).toHaveValue("7");
    await expect(page.locator("#langList")).toContainText("6.5");
    await page.locator("#clearLanguageDraftBtn").press("Enter");
    await expect(listening).toHaveCount(0);
    await expect(page.locator("#langList .lang-item")).toHaveCount(1);
    await page.locator("#saveProfileBtn").click();
    await expect(page.locator("#saveProfileBtn")).toBeDisabled();
    await page.reload();
    await expect(page.locator("#budgetInput")).toHaveValue("12345");
    await page.locator("[data-profile-tab='languages']").click();
    await expect(page.locator("#langList .lang-item")).toHaveCount(1);
    await page.locator("#langList [data-edit-idx='0']").click();
    await listening.fill("7");
    await page.unroute("**/languages/validate");
    await page.route("**/languages/validate", route => route.fulfill({
      status: 503, contentType: "application/json", body: JSON.stringify({ detail: "service_unavailable" }),
    }));
    await page.locator("#langAddBtn").click();
    await expect(page.locator("#langAddBtn")).toBeEnabled();
    await expect(page.locator("#langList")).toContainText("6.5");
    await expect(listening).toHaveValue("7");
    await expect(page.locator(".toast.error")).toBeVisible();
    await page.locator("#clearLanguageDraftBtn").click();
    await expect(page.locator("#saveProfileBtn")).toBeDisabled();
  } finally {
    releaseResponse();
  }
});

for (const language of [false, true]) {
  test(`reset ignores a late ${language ? "language" : "academic"} validation response`, async ({ page }) => {
    await openProfileEditor(page, language ? "languages" : "scores");
    if (language) {
      await expect(page.locator("#langCode option[value='en']")).toBeAttached();
      await setNativeSelect(page, "langCode", "en");
      await setNativeSelect(page, "langKind", "native");
    } else {
      await expect(page.locator("#examNameSelect option[value='ACT']")).toBeAttached();
      await setNativeSelect(page, "examNameSelect", "ACT");
      await page.locator("#examScoreInput").fill("32");
    }
    let releaseResponse;
    const gate = new Promise(resolve => { releaseResponse = resolve; });
    await page.route(`**/${language ? "languages" : "exams"}/validate`, async route => {
      const response = await route.fetch();
      await gate;
      await route.fulfill({ response });
    });
    const add = page.locator(language ? "#langAddBtn" : "#addExamBtn");
    try {
      await add.click();
      await expect(add).toBeDisabled();
      await page.locator("#resetProfileBtn").click();
      await page.locator("#profileResetConfirmBtn").click();
      await expect(page.locator("#profileResetModal")).not.toHaveClass(/is-open/);
      releaseResponse();
      await expect(add).toBeEnabled();
      await expect(page.locator("#examList .profile-exam-item, #langList .lang-item")).toHaveCount(0);
      await expect(page.locator("#saveProfileBtn")).toBeDisabled();
    } finally {
      releaseResponse();
    }
  });
}
