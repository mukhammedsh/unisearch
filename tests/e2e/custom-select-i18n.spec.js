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

async function readCustomSelectSnapshot(page, selectId) {
  return page.evaluate((id) => {
    const select = document.getElementById(id);
    if (!select) return null;
    const wrapper = select.closest(".custom-select-wrapper");
    const trigger = wrapper?.querySelector(".custom-select-trigger");
    const optionTexts = Array.from(select.options).map((option) => option.text.trim());
    const customOptionTexts = Array.from(wrapper?.querySelectorAll(".custom-option") || []).map((option) =>
      option.textContent.trim()
    );

    return {
      nativeSelectedText: select.options[select.selectedIndex]?.text?.trim() || "",
      triggerText: trigger?.textContent?.trim() || "",
      nativeOptionTexts: optionTexts,
      customOptionTexts,
    };
  }, selectId);
}

test("custom dropdown text updates immediately after language change", async ({ page }) => {
  await markTourAsSeen(page);
  await page.goto("/universities.html");

  await expect(page.locator(selectors.profileBtn)).toBeVisible();
  await page.click(selectors.profileBtn);
  await expect(page.locator(selectors.profileModal)).toHaveClass(/is-open/);

  const before = await readCustomSelectSnapshot(page, "studyModeSelect");
  expect(before).not.toBeNull();
  expect(before.triggerText).toBe(before.nativeSelectedText);
  expect(before.customOptionTexts).toEqual(before.nativeOptionTexts);

  await switchLanguage(page, "rus");

  await expect.poll(async () => {
    const snapshot = await readCustomSelectSnapshot(page, "studyModeSelect");
    if (!snapshot) return false;
    return (
      snapshot.triggerText === snapshot.nativeSelectedText &&
      JSON.stringify(snapshot.customOptionTexts) === JSON.stringify(snapshot.nativeOptionTexts) &&
      JSON.stringify(snapshot.nativeOptionTexts) !== JSON.stringify(before.nativeOptionTexts)
    );
  }).toBe(true);

  const after = await readCustomSelectSnapshot(page, "studyModeSelect");
  expect(after).not.toBeNull();
  expect(after.triggerText).toBe(after.nativeSelectedText);
  expect(after.customOptionTexts).toEqual(after.nativeOptionTexts);
  expect(after.nativeOptionTexts).not.toEqual(before.nativeOptionTexts);
});
