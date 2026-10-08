const { test, expect } = require("@playwright/test");
const { markTourAsSeen } = require("./helpers/personas");
const { selectors, setNativeSelect } = require("./helpers/selectors");
const { mockAllExpensiveEndpoints } = require("./helpers/mocks");

test.describe("World applicant profile context", () => {
  test("saves country of education, credential, route, cycle, and residence independently of citizenship", async ({ page }) => {
    await mockAllExpensiveEndpoints(page);
    await markTourAsSeen(page);
    await page.goto("/profile.html");
    await expect(page.locator(selectors.profileModal)).toBeVisible();
    await page.waitForFunction(() => document.querySelectorAll("#countryOfEducationSelect option[data-country-code]").length > 100);

    await setNativeSelect(page, "citizenshipCountrySelect", "OTHER");
    await expect(page.locator("#citizenshipOtherInput")).toHaveAccessibleName("Enter country name...");
    await setNativeSelect(page, "citizenshipCountrySelect", "");
    await setNativeSelect(page, "countryOfEducationSelect", "OTHER");
    await expect(page.locator("#countryOfEducationOtherInput")).toHaveAccessibleName("Enter country");
    await setNativeSelect(page, "countryOfEducationSelect", "KZ");
    await setNativeSelect(page, "educationCredentialSelect", "other");
    await expect(page.locator("#educationCredentialOtherInput")).toHaveAccessibleName("Describe your credential or curriculum");
    await page.fill("#educationCredentialOtherInput", "NIS Grade 12 certificate");
    await setNativeSelect(page, "applicantRouteSelect", "first_year");
    await page.fill("#intendedEntryCycleInput", "2027 Fall");
    await setNativeSelect(page, "currentResidenceCountrySelect", "OTHER");
    await expect(page.locator("#currentResidenceOtherInput")).toHaveAccessibleName("Enter country");
    await setNativeSelect(page, "currentResidenceCountrySelect", "US");
    await setNativeSelect(page, "feeStatusContextSelect", "self_reported_international_overseas");

    await page.click(selectors.saveProfileBtn);
    await expect.poll(async () => page.evaluate(() => {
      const profile = JSON.parse(localStorage.getItem("unisearch_profile") || "{}");
      return [
        profile.countryOfEducation,
        profile.educationCredential,
        profile.educationCredentialOther,
        profile.applicantRoute,
        profile.intendedEntryCycle,
        profile.currentResidenceCountry,
        profile.feeStatusContext,
        profile.citizenship,
      ];
    })).toEqual(["KZ", "other", "NIS Grade 12 certificate", "first_year", "2027 Fall", "US", "self_reported_international_overseas", ""]);
  });
});
