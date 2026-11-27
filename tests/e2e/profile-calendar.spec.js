const { test, expect } = require("./helpers/coverage-test.cjs");
const { openProfileTab } = require("./helpers/selectors");

test("profile calendar selects and clears a date", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => localStorage.setItem("unisearch_ui_language_v1", "eng"));
  await page.goto("/profile.html");
  await openProfileTab(page, "scores");
  const input = page.locator("#examTakenOnInput");
  const trigger = input.locator("+ button");
  await trigger.click();
  const calendar = page.locator("dialog.profile-calendar");
  await expect(calendar).toBeVisible();
  const year = calendar.getByRole("spinbutton");
  await expect(year).toHaveCSS("appearance", "textfield");
  await year.fill("2024");
  await year.press("Tab");
  const month = calendar.getByRole("combobox");
  await month.click();
  await calendar.getByRole("option", { name: "February" }).click();
  await expect(month).toBeFocused();
  const february = await calendar.boundingBox();
  await month.click();
  await calendar.getByRole("option", { name: "September" }).click();
  const september = await calendar.boundingBox();
  expect(september.height).toBe(february.height);
  expect(september.y).toBe(february.y);
  await calendar.locator('[data-date="2024-09-17"]').click();
  await expect(input).toHaveValue("");
  await expect(calendar.locator('[data-date="2024-09-17"]')).toHaveAttribute("aria-pressed", "true");
  await calendar.locator("[data-save]").click();
  await expect(input).toHaveValue("2024-09-17");
  await expect(trigger).toBeFocused();
  await trigger.click();
  await calendar.locator("[data-clear]").click();
  await expect(input).toHaveValue("2024-09-17");
  await calendar.locator("[data-save]").click();
  await expect(input).toHaveValue("");
});


test("calendar animates closing with Escape and restores focus", async ({ page }) => {
  await page.goto("/profile.html");
  await openProfileTab(page, "scores");
  const trigger = page.locator("#examTakenOnInput + button");
  await trigger.click();
  const calendar = page.locator("dialog.profile-calendar");
  await expect(calendar).toBeVisible();
  const month = calendar.getByRole("combobox");
  await month.press("Enter");
  await expect(month).toHaveAttribute("aria-expanded", "true");
  await month.press("Escape");
  await expect(month).toHaveAttribute("aria-expanded", "false");
  await expect(calendar).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(calendar).toHaveClass(/is-closing/);
  await expect(calendar).not.toBeVisible();
  await expect(trigger).toBeFocused();
});

test("profile dates and university deadlines share the calendar controls on a narrow screen", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/profile.html?lang=eng");
  await openProfileTab(page, "scores");
  await page.locator("#examTakenOnInput + button").click();
  const picker = page.locator(".profile-calendar");
  await picker.locator("[data-date]").first().click();
  await page.mouse.move(0, 0);

  const style = (locator) => locator.evaluate((node) => {
    const { backgroundColor, color, borderRadius } = getComputedStyle(node);
    return { backgroundColor, color, borderRadius };
  });
  const pickerDay = await style(picker.locator('[aria-pressed="true"]'));
  const pickerArrow = await style(picker.locator('[data-step="1"]'));
  await expect(picker.locator(".ui-calendar__weekday")).toHaveCount(7);
  expect(await picker.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);

  await page.keyboard.press("Escape");
  await page.goto("/university.html?id=imperial-college-london-uk&admission_option=imperial-option-computing-meng&admission_application_route=procedure-computing-meng&admission_level=undergraduate&lang=eng#tab-deadlines");
  await expect(page.locator("#admissionsContext")).toHaveAttribute("data-state", "ready");
  const deadlines = page.locator("#detailDeadlines .deadline-calendar");
  await expect(deadlines.locator(".ui-calendar__weekday")).toHaveCount(7);
  const deadlineDay = deadlines.locator('[data-calendar-day][aria-pressed="true"]');
  expect(await style(deadlineDay)).toEqual(pickerDay);
  const dayNumber = Number((await deadlineDay.getAttribute("data-calendar-day")).slice(-2));
  await expect(deadlineDay).toHaveText(String(dayNumber));
  expect(await deadlineDay.evaluate((node) => getComputedStyle(node, "::after").width)).toBe("4px");
  expect(await style(deadlines.locator('[data-calendar-month="next"]'))).toEqual(pickerArrow);
  expect(await deadlines.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
});
