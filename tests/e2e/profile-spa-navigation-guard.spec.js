const { test, expect } = require("./helpers/coverage-test.cjs");
const { markTourAsSeen } = require("./helpers/personas");
const { selectors } = require("./helpers/selectors");

const PROFILE_LISTENER_TYPES = [
  "examConfigLoaded",
  "languageChanged",
  "currencyChanged",
  "beforeunload",
  "profileModalOpened",
  "profileUpdated",
];

test("SPA navigation keeps the dirty profile until discard and disposes its global listeners", async ({ page }) => {
  await markTourAsSeen(page);
  await page.addInitScript((types) => {
    const tracked = new Map(types.map((type) => [type, new Set()]));
    const add = window.addEventListener.bind(window);
    const remove = window.removeEventListener.bind(window);
    window.addEventListener = (type, listener, options) => {
      tracked.get(type)?.add(listener);
      return add(type, listener, options);
    };
    window.removeEventListener = (type, listener, options) => {
      tracked.get(type)?.delete(listener);
      return remove(type, listener, options);
    };
    window.__profileListenerNames = () => Object.fromEntries(
      Array.from(tracked, ([type, listeners]) => [type, Array.from(listeners, (listener) => listener.name).sort()])
    );
  }, PROFILE_LISTENER_TYPES);

  await page.goto("/index.html");
  await expect(page.locator(selectors.profileBtn)).toBeVisible();
  const profileHandlersPresent = async () => page.evaluate(() => {
    const names = window.__profileListenerNames();
    return [
      names.beforeunload.includes("handleBeforeUnload"),
      names.languageChanged.includes("handleLanguageChanged"),
      names.currencyChanged.includes("handleCurrencyChanged"),
      names.profileModalOpened.includes("onProfileModalOpened"),
      names.profileUpdated.includes("onProfileUpdated"),
    ];
  });

  await page.locator(selectors.profileBtn).click();
  await expect(page.locator("#profilePage")).toBeVisible();
  await page.waitForFunction(() => !!window.__unisearchProfileDraft);
  await expect.poll(profileHandlersPresent).toEqual([true, true, true, true, true]);

  await page.locator(selectors.budgetInput).fill("45000");
  await page.locator(".navbar-logo-link").click();
  await expect(page.locator("#profileUnsavedModal")).toHaveClass(/is-open/);
  await page.locator("#profileCancelCloseBtn").click();
  await expect(page).toHaveURL(/profile/);
  await expect(page.locator(selectors.budgetInput)).toHaveValue("45000");

  await page.locator(".navbar-logo-link").click();
  await expect(page.locator("#profileUnsavedModal")).toHaveClass(/is-open/);
  await page.locator("#profileDiscardBtn").click();
  await expect(page.locator("#profilePage")).toHaveCount(0);
  await expect.poll(profileHandlersPresent).toEqual([false, false, false, false, false]);
});

test("browser back waits for the profile decision and can restore the canceled route", async ({ page }) => {
  await markTourAsSeen(page);
  await page.goto("/index.html");
  await page.locator(selectors.profileBtn).click();
  await expect(page.locator("#profilePage")).toBeVisible();
  await page.waitForFunction(() => !!window.__unisearchProfileDraft);
  await page.locator(selectors.budgetInput).fill("45000");

  await page.goBack();
  await expect(page.locator("#profileUnsavedModal")).toHaveClass(/is-open/);
  await page.locator("#profileCancelCloseBtn").click();
  await expect(page).toHaveURL(/profile/);
  await expect(page.locator(selectors.budgetInput)).toHaveValue("45000");

  await page.locator(".navbar-logo-link").click();
  await expect(page.locator("#profileUnsavedModal")).toHaveClass(/is-open/);
  await page.locator("#profileSaveAndCloseBtn").click();
  await expect(page.locator("#profilePage")).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("unisearch_profile") || "{}").budget))
    .toBe(45000);
});

test("only the latest SPA destination proceeds after a shared profile-close prompt", async ({ page }) => {
  await markTourAsSeen(page);
  await page.goto("/index.html");
  await page.locator(selectors.profileBtn).click();
  await expect(page.locator("#profilePage")).toBeVisible();
  await page.waitForFunction(() => !!window.__unisearchProfileDraft);
  await page.locator(selectors.budgetInput).fill("45000");

  await page.evaluate(() => window.dispatchEvent(new CustomEvent("app:navigate", {
    detail: { href: new URL("index.html", window.location.href).href },
  })));
  await expect(page.locator("#profileUnsavedModal")).toHaveClass(/is-open/);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("app:navigate", {
    detail: { href: new URL("guide.html", window.location.href).href },
  })));

  await page.locator("#profileDiscardBtn").click();
  await expect(page.locator("#guidePage")).toBeVisible();
  await expect(page).toHaveURL(/guide\.html$/);
});
