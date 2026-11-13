const { test, expect } = require("./helpers/coverage-test.cjs");
const { markTourAsSeen } = require("./helpers/personas");
const { selectors, setNativeSelect } = require("./helpers/selectors");
const { mockAllExpensiveEndpoints } = require("./helpers/mocks");

const REMOVED_CONTROLS = ["countryOfEducationSelect", "countryOfEducationOtherInput", "educationCredentialSelect", "educationCredentialOtherInput", "applicantRouteSelect"];
const REMOVED_KEYS = [
  "countryOfEducation", "countryOfEducationOther", "educationCredential", "educationCredentialOther", "applicantRoute",
  "country_of_education", "country_of_education_other", "education_credential", "education_credential_other", "applicant_route",
];

test.describe("Applicant profile application details", () => {
  test("saves the intended entry cycle and fee status without the removed education and route inputs", async ({ page }) => {
    await mockAllExpensiveEndpoints(page);
    await markTourAsSeen(page);
    await page.goto("/profile.html");
    await expect(page.locator(selectors.profileModal)).toBeVisible();
    await page.waitForFunction(() => !!window.__unisearchProfileDraft);

    for (const id of REMOVED_CONTROLS) await expect(page.locator(`#${id}`)).toHaveCount(0);
    const section = page.locator('[data-profile-section="preferences"]');
    await expect(section.locator('label[for="intendedEntryCycleInput"]')).toHaveText("When do you plan to start?");
    await expect(section.locator('label[for="feeStatusContextSelect"]')).toHaveText("Fee status, if you know it");
    await expect(section.locator("#feeStatusHint")).toContainText("home or overseas price");

    await page.fill("#intendedEntryCycleInput", "2027 Fall");
    await setNativeSelect(page, "feeStatusContextSelect", "self_reported_international_overseas");
    await page.click(selectors.saveProfileBtn);
    await expect.poll(async () => page.evaluate(() => {
      const profile = JSON.parse(localStorage.getItem("unisearch_profile") || "{}");
      return [profile.intendedEntryCycle, profile.feeStatusContext];
    })).toEqual(["2027 Fall", "self_reported_international_overseas"]);
  });

  test("a saved profile that still has the removed inputs loads, drops them, and never sends them to the API", async ({ page }) => {
    await mockAllExpensiveEndpoints(page);
    await markTourAsSeen(page);
    await page.addInitScript((removed) => {
      if (sessionStorage.getItem("removed-inputs-seeded")) return;
      sessionStorage.setItem("removed-inputs-seeded", "1");
      const profile = { _v: 2, intendedEntryCycle: "2028 Fall", feeStatusContext: "self_reported_home_domestic" };
      for (const key of removed) profile[key] = key.endsWith("Route") || key.endsWith("_route") ? "transfer" : "KZ";
      profile.selectedAdmissionChoices = { "mit-usa-cambridge": { studyOptionId: "mit-course-6-3-bachelor", applicationRouteId: "mit-first-year", applicantRoute: "first_year" } };
      localStorage.setItem("unisearch_profile", JSON.stringify(profile));
    }, REMOVED_KEYS);
    await page.goto("/profile.html");
    await expect(page.locator(selectors.profileModal)).toBeVisible();
    await page.waitForFunction(() => !!window.__unisearchProfileDraft);
    await expect(page.locator("#intendedEntryCycleInput")).toHaveValue("2028 Fall");
    await expect(page.locator("#feeStatusContextSelect")).toHaveValue("self_reported_home_domestic");

    const { stored, payload } = await page.evaluate(async () => {
      const { loadProfileForApi } = await import("/javascript/utils/persistence.js");
      return { stored: JSON.parse(localStorage.getItem("unisearch_profile") || "{}"), payload: loadProfileForApi() };
    });
    for (const key of REMOVED_KEYS) {
      expect(stored, `${key} must be removed from the stored profile`).not.toHaveProperty(key);
      expect(payload, `${key} must not be sent to the API`).not.toHaveProperty(key);
    }
    expect(stored.selectedAdmissionChoices["mit-usa-cambridge"].applicantRoute).toBe("first_year");
    expect(payload.selectedAdmissionChoices["mit-usa-cambridge"].applicantRoute).toBe("first_year");
  });

  for (const [language, title] of [["rus", "Когда вы планируете начать?"], ["kaz", "Оқуды қашан бастауды жоспарлайсыз?"]]) {
    test(`the intended start question is labelled in ${language}`, async ({ page }) => {
      await markTourAsSeen(page);
      await page.addInitScript((value) => localStorage.setItem("unisearch_ui_language_v1", value), language);
      await page.goto("/profile.html");
      await expect(page.locator("body")).toHaveAttribute("data-page", "profile");
      await expect(page.locator(selectors.profileModal)).toBeVisible();
      await expect(page.locator("html")).toHaveAttribute("lang", language === "kaz" ? "kk" : "ru");
      await expect(page.locator('label[for="intendedEntryCycleInput"]')).toHaveText(title);
    });
  }
});
