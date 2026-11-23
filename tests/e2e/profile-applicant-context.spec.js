const { test, expect } = require("./helpers/coverage-test.cjs");
const { markTourAsSeen } = require("./helpers/personas");
const { selectors } = require("./helpers/selectors");
const { mockAllExpensiveEndpoints } = require("./helpers/mocks");

const REMOVED_CONTROLS = ["countryOfEducationSelect", "countryOfEducationOtherInput", "educationCredentialSelect", "educationCredentialOtherInput", "applicantRouteSelect"];
const REMOVED_KEYS = [
  "countryOfEducation", "countryOfEducationOther", "educationCredential", "educationCredentialOther", "applicantRoute",
  "country_of_education", "country_of_education_other", "education_credential", "education_credential_other", "applicant_route",
];

test.describe("Applicant profile application details", () => {
  test("offers neither the removed education and route inputs nor the per-university entry cycle and fee status", async ({ page }) => {
    await mockAllExpensiveEndpoints(page);
    await markTourAsSeen(page);
    await page.goto("/profile.html");
    await expect(page.locator(selectors.profileModal)).toBeVisible();
    await page.waitForFunction(() => !!window.__unisearchProfileDraft);

    for (const id of [...REMOVED_CONTROLS, "intendedEntryCycleInput", "feeStatusContextSelect"]) await expect(page.locator(`#${id}`)).toHaveCount(0);
    await page.fill("#budgetInput", "12000");
    await page.click(selectors.saveProfileBtn);
    await expect.poll(async () => page.evaluate(() => {
      const profile = JSON.parse(localStorage.getItem("unisearch_profile") || "{}");
      return [profile.budget, "intendedEntryCycle" in profile, "feeStatusContext" in profile];
    })).toEqual([12000, false, false]);
  });

  test("a saved profile that still has the removed inputs loads, drops them, and never sends them to the API", async ({ page }) => {
    await mockAllExpensiveEndpoints(page);
    await markTourAsSeen(page);
    await page.addInitScript((removed) => {
      if (sessionStorage.getItem("removed-inputs-seeded")) return;
      sessionStorage.setItem("removed-inputs-seeded", "1");
      const profile = { _v: 2, intendedEntryCycle: "2028 Fall", feeStatusContext: "self_reported_home_domestic", intended_entry_cycle: "2028 Fall", fee_status_context: "other" };
      for (const key of removed) profile[key] = key.endsWith("Route") || key.endsWith("_route") ? "transfer" : "KZ";
      profile.selectedAdmissionChoices = { "mit-usa-cambridge": { studyOptionId: "mit-course-6-3-bachelor", applicationRouteId: "mit-first-year", applicantRoute: "first_year", intendedEntryCycle: "2029 entry", feeStatusContext: "self_reported_home_domestic" } };
      localStorage.setItem("unisearch_profile", JSON.stringify(profile));
    }, REMOVED_KEYS);
    await page.goto("/profile.html");
    await expect(page.locator(selectors.profileModal)).toBeVisible();
    await page.waitForFunction(() => !!window.__unisearchProfileDraft);

    const { stored, payload } = await page.evaluate(async () => {
      const { loadProfileForApi } = await import("/javascript/utils/persistence.js");
      return { stored: JSON.parse(localStorage.getItem("unisearch_profile") || "{}"), payload: loadProfileForApi() };
    });
    for (const key of [...REMOVED_KEYS, "intendedEntryCycle", "feeStatusContext", "intended_entry_cycle", "fee_status_context"]) {
      expect(stored, `${key} must be removed from the stored profile`).not.toHaveProperty(key);
      expect(payload, `${key} must not be sent to the API`).not.toHaveProperty(key);
    }
    expect(stored.selectedAdmissionChoices["mit-usa-cambridge"].applicantRoute).toBe("first_year");
    expect(payload.selectedAdmissionChoices["mit-usa-cambridge"].applicantRoute).toBe("first_year");
    // The per-university choice keeps its own cycle and fee status.
    expect(stored.selectedAdmissionChoices["mit-usa-cambridge"].intendedEntryCycle).toBe("2029 entry");
    expect(payload.selectedAdmissionChoices["mit-usa-cambridge"].feeStatusContext).toBe("self_reported_home_domestic");
  });
});
