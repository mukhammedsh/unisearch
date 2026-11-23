const { test, expect } = require("./helpers/coverage-test.cjs");
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
  await page.goto("/index.html");

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

for (const { width, theme, mobile } of [
  { width: 1280, theme: "light", mobile: false },
  { width: 390, theme: "dark", mobile: true },
]) {
  test.describe(`dropdown layout at ${width}px in ${theme} mode`, () => {
    test.use({ viewport: { width, height: 844 }, isMobile: mobile, hasTouch: mobile });

    test("cost options join the trigger and remain selectable", async ({ page }) => {
      await markTourAsSeen(page);
      await page.addInitScript((mode) => localStorage.setItem("unisearch_theme", mode), theme);
      await page.goto("/index.html");
      await expect(page.locator("body")).toHaveAttribute("data-page", "universities");
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      if (mobile) await page.locator("#mobileFilterToggle").tap();

      const field = page.locator(".custom-select-wrapper").filter({ has: page.locator("#costBasisSelect") });
      const trigger = field.getByRole("combobox");
      const panel = field.getByRole("listbox");
      if (mobile) await trigger.tap();
      else await trigger.press("ArrowDown");
      await expect(trigger).toHaveAttribute("aria-expanded", "true");
      await expect(panel.getByRole("option", { selected: true }).locator(".custom-option-check")).toBeVisible();
      expect(await field.evaluate((node) => {
        const button = node.querySelector(".custom-select-trigger");
        const list = node.querySelector(".custom-options");
        const triggerRect = button.getBoundingClientRect();
        const panelRect = list.getBoundingClientRect();
        const seam = node.classList.contains("open-up")
          ? triggerRect.top - panelRect.bottom
          : panelRect.top - triggerRect.bottom;
        return Math.abs(seam) < 1
          && Math.abs(triggerRect.width - panelRect.width) < 1
          && getComputedStyle(button).backgroundColor === getComputedStyle(list).backgroundColor;
      })).toBe(true);

      const tuition = panel.locator('[data-value="tuition"]');
      await expect(tuition).toBeInViewport();
      if (mobile) await tuition.tap();
      else {
        await trigger.press("ArrowDown");
        await trigger.press("Enter");
        await expect(trigger).toBeFocused();
      }
      await expect(page.locator("#costBasisSelect")).toHaveValue("tuition");
      await expect(trigger).toHaveAttribute("aria-expanded", "false");
    });
  });
}
