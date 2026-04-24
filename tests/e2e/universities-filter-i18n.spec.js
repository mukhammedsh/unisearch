const { test, expect } = require("@playwright/test");
const { markTourAsSeen } = require("./helpers/personas");
const { selectors } = require("./helpers/selectors");

async function switchLanguage(page, value) {
  await page.evaluate((lang) => {
    const select = document.getElementById("languageSelect");
    if (!select) return;
    select.value = lang;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
}

async function snapshotFilterOptions(page) {
  return page.evaluate(() => {
    const snapshotSelect = (id) => {
      const select = document.getElementById(id);
      if (!select) return null;
      const wrapper = select.closest(".custom-select-wrapper");
      return {
        value: select.value,
        nativeOptionTexts: Array.from(select.options).map((option) => option.text.trim()),
        customOptionTexts: Array.from(wrapper?.querySelectorAll(".custom-option") || []).map((option) =>
          option.textContent.trim()
        ),
        triggerText: wrapper?.querySelector(".custom-select-trigger")?.textContent?.trim() || "",
        nativeSelectedText: select.options[select.selectedIndex]?.text?.trim() || "",
        disabled: !!select.disabled,
      };
    };

    const countrySelect = document.getElementById("countrySelect");
    if (!countrySelect) return null;

    const countryValues = Array.from(countrySelect.options)
      .map((option) => option.value)
      .filter(Boolean);

    let selectedCountry = countrySelect.value || "";
    let selectedState = "";

    for (const country of countryValues) {
      countrySelect.value = country;
      countrySelect.dispatchEvent(new Event("change", { bubbles: true }));

      const stateSelect = document.getElementById("stateSelect");
      const citySelect = document.getElementById("citySelect");
      const stateOptions = Array.from(stateSelect?.options || []).map((option) => option.value).filter(Boolean);
      const cityTexts = Array.from(citySelect?.options || []).map((option) => option.text.trim()).filter(Boolean);

      if (cityTexts.length > 1) {
        selectedCountry = country;
        break;
      }

      if (stateOptions.length > 0) {
        stateSelect.value = stateOptions[0];
        stateSelect.dispatchEvent(new Event("change", { bubbles: true }));
        const nestedCityTexts = Array.from(citySelect?.options || []).map((option) => option.text.trim()).filter(Boolean);
        if (nestedCityTexts.length > 1) {
          selectedCountry = country;
          selectedState = stateOptions[0];
          break;
        }
      }
    }

    return {
      country: snapshotSelect("countrySelect"),
      state: snapshotSelect("stateSelect"),
      city: snapshotSelect("citySelect"),
      selectedCountry,
      selectedState,
    };
  });
}

test("universities filter dropdowns update translated option text after language change", async ({ page }) => {
  await markTourAsSeen(page);
  await page.goto("/universities.html");

  await expect.poll(async () => {
    const snapshot = await snapshotFilterOptions(page);
    return snapshot?.country?.nativeOptionTexts?.length || 0;
  }).toBeGreaterThan(1);

  const before = await snapshotFilterOptions(page);
  expect(before).not.toBeNull();
  expect(before.country.customOptionTexts).toEqual(before.country.nativeOptionTexts);

  await switchLanguage(page, "rus");
  await page.waitForTimeout(1000); // Wait for custom select to re-render

  await expect.poll(async () => {
    const snapshot = await snapshotFilterOptions(page);
    if (!snapshot) return false;
    const countryChanged =
      JSON.stringify(snapshot.country.nativeOptionTexts) !== JSON.stringify(before.country.nativeOptionTexts);
    const countrySynced =
      JSON.stringify(snapshot.country.customOptionTexts) === JSON.stringify(snapshot.country.nativeOptionTexts);
    const citySynced =
      JSON.stringify(snapshot.city.customOptionTexts) === JSON.stringify(snapshot.city.nativeOptionTexts);
    return countryChanged && countrySynced && citySynced;
  }, { timeout: 30000 }).toBe(true);

  const after = await snapshotFilterOptions(page);
  expect(after).not.toBeNull();
  expect(after.country.customOptionTexts).toEqual(after.country.nativeOptionTexts);
  expect(after.city.customOptionTexts).toEqual(after.city.nativeOptionTexts);
  expect(after.country.nativeOptionTexts).not.toEqual(before.country.nativeOptionTexts);
});
