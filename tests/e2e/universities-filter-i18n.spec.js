const { test, expect } = require("./helpers/coverage-test.cjs");
const { markTourAsSeen } = require("./helpers/personas");

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

async function filterComboboxNames(page) {
  return page.evaluate(() => ["countrySelect", "citySelect", "sortSelect"].map((id) => {
    const select = document.getElementById(id);
    const label = select?.labels?.[0];
    return {
      expected: label?.querySelector("[data-i18n]")?.textContent?.trim() || label?.textContent?.trim(),
      actual: select?.closest(".custom-select-wrapper")?.querySelector(".custom-select-trigger")?.getAttribute("aria-label"),
    };
  }));
}

test("universities filter dropdowns update translated option text after language change", async ({ page }) => {
  await markTourAsSeen(page);
  await page.goto("/index.html");

  await expect.poll(async () => {
    const snapshot = await snapshotFilterOptions(page);
    return snapshot?.country?.nativeOptionTexts?.length || 0;
  }).toBeGreaterThan(1);

  const before = await snapshotFilterOptions(page);
  expect(before).not.toBeNull();
  expect(before.country.customOptionTexts).toEqual(before.country.nativeOptionTexts);
  expect(await page.locator("#languageSelect").evaluate((select) => {
    const menu = select.closest(".custom-select-wrapper").querySelector(".custom-options");
    return getComputedStyle(menu).borderTopWidth;
  })).toBe("0px");
  expect(await filterComboboxNames(page)).toEqual([
    { expected: "Country", actual: "Country" },
    { expected: "City", actual: "City" },
    { expected: "Sort Strategy", actual: "Sort Strategy" },
  ]);

  await switchLanguage(page, "rus");

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
  await expect(page.getByRole("group", { name: "Режим отображения" })).toBeVisible();

  const after = await snapshotFilterOptions(page);
  expect(after).not.toBeNull();
  expect(after.country.customOptionTexts).toEqual(after.country.nativeOptionTexts);
  expect(after.city.customOptionTexts).toEqual(after.city.nativeOptionTexts);
  expect(after.country.nativeOptionTexts).not.toEqual(before.country.nativeOptionTexts);
  expect(await filterComboboxNames(page)).toEqual(await page.evaluate(() => ["countrySelect", "citySelect", "sortSelect"].map((id) => {
    const select = document.getElementById(id);
    const label = select?.labels?.[0];
    const expected = label?.querySelector("[data-i18n]")?.textContent?.trim() || label?.textContent?.trim();
    return { expected, actual: select?.closest(".custom-select-wrapper")?.querySelector(".custom-select-trigger")?.getAttribute("aria-label") };
  })));

  const budgetSlider = page.locator(".budget-control-wrapper .dual-slider-container");
  expect(await budgetSlider.evaluate((element) => getComputedStyle(element).marginTop)).toBe("0px");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator("#mobileFilterToggle").click();
  await expect(budgetSlider).toBeVisible();
  expect(await budgetSlider.evaluate((element) => getComputedStyle(element).marginTop)).toBe("0px");
});

test("open selected custom select keeps readable text in dark mode", async ({ page }) => {
  await markTourAsSeen(page);
  await page.addInitScript(() => localStorage.setItem("unisearch_theme", "dark"));
  await page.goto("/index.html");
  const wrapper = page.locator(".custom-select-wrapper:has(#countrySelect)");
  const trigger = wrapper.locator(".custom-select-trigger");
  await expect(trigger).toBeVisible();
  await expect.poll(() => page.locator("#countrySelect option").count()).toBeGreaterThan(1);
  await trigger.click();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  const selected = wrapper.locator(".custom-option.selected");
  await expect(selected).toBeVisible();

  const contrasts = await page.evaluate(() => {
    const ratio = (element) => {
      const channels = (value) => value.match(/[\d.]+/g).slice(0, 3).map(Number);
      const luminance = (color) => channels(color).map((value) => {
        const channel = value / 255;
        return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
      }).reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
      const style = getComputedStyle(element);
      const [lighter, darker] = [luminance(style.color), luminance(style.backgroundColor)].sort((a, b) => b - a);
      return (lighter + 0.05) / (darker + 0.05);
    };
    return [
      ratio(document.querySelector("#countrySelect + .custom-select-trigger")),
      ratio(document.querySelector("#countrySelect ~ .custom-options .custom-option.selected")),
    ];
  });
  for (const contrast of contrasts) expect(contrast).toBeGreaterThanOrEqual(4.5);
});
