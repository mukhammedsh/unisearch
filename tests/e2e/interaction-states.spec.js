const { test, expect } = require("./helpers/coverage-test.cjs");
const { markTourAsSeen } = require("./helpers/personas");

async function resolvedToken(page, token) {
  return page.evaluate((name) => {
    const probe = document.createElement("span");
    probe.style.color = `var(${name})`;
    document.body.appendChild(probe);
    const value = getComputedStyle(probe).color;
    probe.remove();
    return value;
  }, token);
}

async function resolvedBackgroundToken(page, token) {
  return page.evaluate((name) => {
    const probe = document.createElement("span");
    probe.style.backgroundColor = `var(${name})`;
    document.body.appendChild(probe);
    const value = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return value;
  }, token);
}

async function colorOf(locator) {
  return locator.evaluate((node) => getComputedStyle(node).color);
}

async function expectColor(locator, expected) {
  await expect.poll(() => colorOf(locator)).toBe(expected);
}

async function expectBackground(locator, expected) {
  await expect.poll(() => locator.evaluate((node) => getComputedStyle(node).backgroundColor)).toBe(expected);
}

async function expectFocusRing(locator, focusColor) {
  await locator.focus();
  if (!await locator.evaluate((node) => node.matches(":focus-visible"))) {
    await locator.page().keyboard.press("Shift+Tab");
    await locator.page().keyboard.press("Tab");
  }
  await expect.poll(() => locator.evaluate((node) => {
    const style = getComputedStyle(node);
    return `${style.outlineWidth} ${style.outlineStyle} ${style.outlineColor}`;
  })).toBe(`2px solid ${focusColor}`);
}

async function expectCompositeFocus(control, composite, focusColor) {
  await control.focus();
  await expect.poll(() => composite.evaluate((node) => {
    const style = getComputedStyle(node);
    return `${style.outlineWidth} ${style.outlineStyle} ${style.outlineColor}`;
  })).toBe(`2px solid ${focusColor}`);
}

test("shared controls use one hover, active, focus, pressed, and disabled contract", async ({ page }) => {
  await markTourAsSeen(page);
  await page.goto("/guide.html");

  const hoverColor = await resolvedToken(page, "--interaction-hover-text");
  const activeColor = await resolvedToken(page, "--interaction-active-text");
  const focusColor = await resolvedToken(page, "--focus-ring");

  const activeGuideLink = page.locator('.guide-nav a[aria-current="page"]');
  await expect(activeGuideLink).toBeVisible();
  await expectColor(activeGuideLink, activeColor);

  const inactiveGuideLink = page.locator('.guide-nav a:not([aria-current="page"])').first();
  await inactiveGuideLink.hover();
  await expectColor(inactiveGuideLink, hoverColor);

  await inactiveGuideLink.focus();
  const focusStyle = await inactiveGuideLink.evaluate((node) => {
    const style = getComputedStyle(node);
    return {
      color: style.outlineColor,
      style: style.outlineStyle,
      width: style.outlineWidth,
    };
  });
  expect(focusStyle).toEqual({ color: focusColor, style: "solid", width: "2px" });

  await page.evaluate(() => {
    const probe = document.createElement("button");
    probe.id = "interaction-state-probe";
    probe.textContent = "State probe";
    document.body.appendChild(probe);

    const disabledProbe = document.createElement("button");
    disabledProbe.id = "disabled-state-probe";
    disabledProbe.disabled = true;
    disabledProbe.textContent = "Disabled probe";
    document.body.appendChild(disabledProbe);
  });

  const pressedProbe = page.locator("#interaction-state-probe");
  await pressedProbe.scrollIntoViewIfNeeded();
  const box = await pressedProbe.boundingBox();
  expect(box).toBeTruthy();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  expect(await pressedProbe.evaluate((node) => getComputedStyle(node).translate)).toBe("none");
  expect(await pressedProbe.evaluate((node) => getComputedStyle(node).transform)).toBe("none");
  await page.mouse.up();

  const disabledStyle = await page.locator("#disabled-state-probe").evaluate((node) => {
    const style = getComputedStyle(node);
    return { cursor: style.cursor, opacity: style.opacity, pointerEvents: style.pointerEvents };
  });
  expect(disabledStyle).toEqual({ cursor: "not-allowed", opacity: "0.52", pointerEvents: "none" });
});

test("catalog, profile, and detail tabs share the same interaction colors", async ({ page }) => {
  await markTourAsSeen(page);
  await page.goto("/index.html");
  await expect(page.locator(".uni-card:not(.is-skeleton)").first()).toBeVisible();

  const hoverColor = await resolvedToken(page, "--interaction-hover-text");
  const activeColor = await resolvedToken(page, "--interaction-active-text");

  const inactiveView = page.locator(".view-btn:not(.active)").first();
  await inactiveView.hover();
  await expectColor(inactiveView, hoverColor);
  await expectColor(page.locator(".view-btn.active").first(), activeColor);

  await page.goto("/profile.html");
  const inactiveProfileTab = page.locator(".profile-section-tab:not(.is-active)").first();
  await inactiveProfileTab.hover();
  await expectColor(inactiveProfileTab, hoverColor);
  await expectColor(page.locator(".profile-section-tab.is-active").first(), activeColor);

  await page.goto("/university.html?id=mit-usa-cambridge");
  await expect(page.locator("#detailCard")).toBeVisible();
  const inactiveDetailTab = page.locator(".d-tab-btn:not(.active)").first();
  await inactiveDetailTab.hover();
  await expectColor(inactiveDetailTab, hoverColor);
  await expectColor(page.locator(".d-tab-btn.active").first(), activeColor);
});

test("catalog toolbar controls use --surface-control-on-bg in light and dark themes", async ({ page }) => {
  await markTourAsSeen(page);
  await page.goto("/index.html");
  await expect(page.locator(".uni-card:not(.is-skeleton)").first()).toBeVisible();

  const compareMode = page.locator("#compareModeBtn");
  const viewToggles = page.locator(".view-toggles");
  const lightToolbar = await resolvedBackgroundToken(page, "--surface-control-on-bg");
  expect(lightToolbar).toBe(await resolvedBackgroundToken(page, "--surface-solid"));
  await expectBackground(compareMode, lightToolbar);
  await expectBackground(viewToggles, lightToolbar);

  await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
  const darkToolbar = await resolvedBackgroundToken(page, "--surface-control-on-bg");
  expect(darkToolbar).toBe(await resolvedBackgroundToken(page, "--surface-soft"));
  await expectBackground(compareMode, darkToolbar);
  await expectBackground(viewToggles, darkToolbar);
});

test("logo, dropdowns, and previously quiet text actions show visible feedback in both themes", async ({ page }) => {
  await markTourAsSeen(page);
  await page.goto("/profile.html");
  await expect(page.locator(".profile-shell")).toBeVisible();

  for (const theme of ["light", "dark"]) {
    await page.evaluate((value) => document.documentElement.setAttribute("data-theme", value), theme);
    const hoverSurface = await resolvedBackgroundToken(page, "--interaction-hover-surface");
    const accentText = await resolvedToken(page, "--accent-text");

    const logo = page.locator(".navbar-logo-link");
    await logo.hover();
    await expectBackground(logo, hoverSurface);

    const dropdown = page.locator(".profile-shell .custom-select-trigger").first();
    await dropdown.hover();
    await expectBackground(dropdown, hoverSurface);
    await expect(dropdown).toHaveCSS("transition-property", /background-color/);

    await dropdown.click();
    await expect(dropdown).toHaveAttribute("aria-expanded", "true");
    await dropdown.hover();
    await expectBackground(dropdown, hoverSurface);
    await page.keyboard.press("Escape");
    await expect(dropdown).toHaveAttribute("aria-expanded", "false");

    const inlineAction = page.locator(".profile-inline-link").first();
    await inlineAction.hover();
    await expectColor(inlineAction, accentText);

    const reset = page.locator(".profile-delete--danger-soft");
    const baseBackground = await resolvedBackgroundToken(page, "--color-danger-bg");
    await expectBackground(reset, baseBackground);
    await reset.hover();
    await expect.poll(() => reset.evaluate((element) => getComputedStyle(element).backgroundColor)).not.toBe(baseBackground);
  }

  await page.goto("/guide.html#guide-unifit");
  const formula = page.locator("#guide-unifit .guide-formula-summary");
  await formula.hover();
  await expectColor(formula, await resolvedToken(page, "--accent-text"));
  await page.mouse.down();
  await expect(formula).toHaveCSS("text-decoration-line", "underline");
  await page.mouse.up();
  await expect(page.locator("#guide-unifit details")).toHaveAttribute("open", "");
});

test("reviewed program, comparison, and photo controls visibly respond on hover", async ({ page }) => {
  await page.goto("/university.html?id=mit-usa-cambridge");
  await expect(page.locator("#detailCard")).toHaveClass(/is-mounted/);
  const photo = page.locator(".d-gallery-preview");
  await expect(photo.locator("img:not([hidden])")).toBeVisible();
  await photo.hover({ position: { x: 100, y: 100 } });
  await expect.poll(() => photo.evaluate((element) => getComputedStyle(element, "::after").opacity)).toBe("0.12");

  await page.locator('[data-tab="tab-programs"]').click();
  const program = page.locator("#tab-programs .program-card__toggle").first();
  await program.hover();
  await expectColor(program.locator(".program-card__title"), await resolvedToken(page, "--accent-text"));

  await page.goto("/compare.html?ids=mit-usa-cambridge,imperial-college-london-uk");
  const identity = page.locator(".compare-reviewed__identity").first();
  await identity.hover();
  await expectColor(identity.locator("strong"), await resolvedToken(page, "--accent-text"));
});

test("profile controls follow the shared interaction contract in light and dark themes", async ({ page }) => {
  await markTourAsSeen(page);
  await page.goto("/profile.html");
  await expect(page.locator(".profile-shell")).toBeVisible();

  for (const theme of ["light", "dark"]) {
    await page.evaluate((value) => document.documentElement.setAttribute("data-theme", value), theme);

    const focusColor = await resolvedToken(page, "--focus-ring");
    const hoverColor = await resolvedToken(page, "--interaction-hover-text");
    const mutedColor = await resolvedToken(page, "--text-muted");
    const softSurface = await resolvedBackgroundToken(page, "--surface-soft");
    const hoverSurface = await resolvedBackgroundToken(page, "--interaction-hover-surface");

    const progressContrast = await page.locator(".profile-section-desc").first().evaluate((element) => {
      const channels = (color) => color.match(/[\d.]+/g).slice(0, 3).map(Number);
      const luminance = (color) => channels(color).map((value) => {
        const channel = value / 255;
        return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
      }).reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
      const foreground = luminance(getComputedStyle(element).color);
      const background = luminance(getComputedStyle(element.closest(".profile-shell")).backgroundColor);
      const [lighter, darker] = [foreground, background].sort((a, b) => b - a);
      return (lighter + 0.05) / (darker + 0.05);
    });
    expect(progressContrast).toBeGreaterThanOrEqual(4.5);

    const field = page.locator("#budgetInput");
    const fieldComposite = field.locator("xpath=..");
    await expectBackground(fieldComposite, softSurface);
    await field.hover();
    await expectBackground(fieldComposite, hoverSurface);
    await expectCompositeFocus(field, fieldComposite, focusColor);

    // Save is the secondary action and is only enabled once the draft changed.
    await field.fill(theme === "light" ? "15000" : "16000");
    const secondaryAction = page.locator(".profile-action-btn--secondary");
    await expect(secondaryAction).toBeEnabled();
    await expectBackground(secondaryAction, softSurface);
    await secondaryAction.hover();
    await expectBackground(secondaryAction, hoverSurface);
    await expectColor(secondaryAction, hoverColor);
    await expectFocusRing(secondaryAction, focusColor);

    // The budget unit is a plain "/ year" caption now; the currency choice is a separate select.
    const budgetUnit = page.locator("#profileBudgetUnit");
    await expectColor(budgetUnit, mutedColor);
    // The caption ignores pointer events, so the hover lands on the field beneath it.
    await budgetUnit.hover({ force: true });
    await expectBackground(fieldComposite, hoverSurface);

    await page.locator('[data-profile-tab="scores"]').click();
    const unitToggle = page.locator("#gpaUnit");
    const gpaComposite = unitToggle.locator("xpath=..");
    await expectColor(unitToggle, mutedColor);
    await unitToggle.hover();
    await expectBackground(gpaComposite, hoverSurface);
    await expectBackground(unitToggle, await resolvedBackgroundToken(page, "--interaction-active-surface"));
    await expectColor(unitToggle, hoverColor);
    await expectCompositeFocus(unitToggle, gpaComposite, focusColor);

    await expect(page.locator('[data-profile-section="scores"]')).toBeVisible();
    const infoButton = page.locator('[data-profile-section="scores"] .profile-info').first();
    await expect(infoButton).toBeVisible();
    await expectColor(infoButton, mutedColor);
    await infoButton.hover();
    await expectBackground(infoButton, hoverSurface);
    await expectColor(infoButton, hoverColor);
    await expectFocusRing(infoButton, focusColor);

    await page.locator('[data-profile-tab="basics"]').click();
  }
});

test("embedded actions preserve their composite field state", async ({ page }) => {
  await markTourAsSeen(page);
  await page.goto("/guide.html");

  const search = page.locator("#qInput");
  const searchComposite = page.locator(".navbar-search-field");
  const clearButton = page.locator("#searchClearBtn");
  await search.fill("mit");
  await expect(clearButton).toBeVisible();

  for (const theme of ["light", "dark"]) {
    await page.evaluate((value) => document.documentElement.setAttribute("data-theme", value), theme);
    const focusColor = await resolvedToken(page, "--focus-ring");
    const hoverSurface = await resolvedBackgroundToken(page, "--interaction-hover-surface");
    const activeSurface = await resolvedBackgroundToken(page, "--interaction-active-surface");

    await clearButton.hover();
    await expectBackground(searchComposite, hoverSurface);
    await expectBackground(clearButton, activeSurface);
    await expectCompositeFocus(clearButton, searchComposite, focusColor);
  }

  await page.setViewportSize({ width: 375, height: 667 });
  await page.reload();
  await page.locator("#navbarSearchToggle").click();
  await expect(searchComposite).toBeVisible();
  const mobileBounds = await searchComposite.boundingBox();
  expect(mobileBounds.x).toBeGreaterThanOrEqual(0);
  expect(mobileBounds.x + mobileBounds.width).toBeLessThanOrEqual(375);
});

test("toolbar press, selected toggle feedback, dark focus rings, and borderless card shadows stay consistent", async ({ page }) => {
  await markTourAsSeen(page);
  await page.addInitScript(() => localStorage.setItem("unisearch_theme", "dark"));
  await page.goto("/index.html");
  await expect(page.locator(".uni-card:not(.is-skeleton)").first()).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  const controlOnBgSurface = await resolvedBackgroundToken(page, "--surface-control-on-bg");
  const pressSurface = await resolvedBackgroundToken(page, "--interaction-press-surface");
  const hoverSurface = await resolvedBackgroundToken(page, "--interaction-hover-surface");
  const textColor = await resolvedToken(page, "--text");
  const selectedSurface = await resolvedBackgroundToken(page, "--accent-active-surface");
  const activeText = await resolvedToken(page, "--interaction-active-text");
  const selectedHoverSurface = await resolvedBackgroundToken(page, "--accent-active-hover-surface");
  const selectedPressSurface = await resolvedBackgroundToken(page, "--accent-active-press-surface");
  const focusColor = await resolvedToken(page, "--focus-ring");

  const lightnessOf = (color) => {
    const nums = color.match(/-?[\d.]+/g).map(Number);
    if (color.startsWith("oklab")) return nums[0];
    const [r, g, b] = nums.slice(0, 3).map((value) => {
      const channel = value / 255;
      return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };

  expect(lightnessOf(pressSurface)).toBeLessThan(lightnessOf(controlOnBgSurface));
  expect(lightnessOf(hoverSurface)).toBeGreaterThan(lightnessOf(controlOnBgSurface));

  const pressAndCheck = async (locator, expectedBg, expectedText) => {
    await locator.scrollIntoViewIfNeeded();
    const box = await locator.boundingBox();
    expect(box).toBeTruthy();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    try {
      await expectBackground(locator, expectedBg);
      if (expectedText) await expectColor(locator, expectedText);
    } finally {
      await page.mouse.up();
    }
  };

  const viewList = page.locator("#viewListBtn");
  const viewMap = page.locator("#viewMapBtn");
  await expect(viewList).toHaveAttribute("aria-pressed", "true");
  expect(await viewList.evaluate((node) => getComputedStyle(node).cursor)).toBe("default");

  const compareMode = page.locator("#compareModeBtn");
  // Neutral buttons stay neutral on press, and releasing the mouse toggles compare mode on.
  await pressAndCheck(compareMode, pressSurface, textColor);
  await expect(compareMode).toHaveAttribute("aria-pressed", "true");
  await page.mouse.move(1, 1);
  await expectBackground(compareMode, selectedSurface);
  await compareMode.hover();
  await expectBackground(compareMode, selectedHoverSurface);
  expect(lightnessOf(selectedHoverSurface)).toBeGreaterThan(lightnessOf(selectedSurface));
  expect(lightnessOf(selectedPressSurface)).toBeLessThan(lightnessOf(selectedSurface));
  await pressAndCheck(compareMode, selectedPressSurface, activeText);
  await expect(compareMode).toHaveAttribute("aria-pressed", "false");

  const langTrigger = page.locator(".navbar-right .lang-control .custom-select-trigger");
  await langTrigger.click();
  await expect(page.locator(".navbar-right .lang-control .custom-select-wrapper")).toHaveClass(/open/);
  await expectBackground(langTrigger, hoverSurface);
  await expectColor(langTrigger, textColor);
  await langTrigger.click();

  await expectFocusRing(page.locator("#resetFiltersBtn"), focusColor);

  const cardShadow = await page.locator(".uni-card:not(.is-skeleton)").first().evaluate((node) => getComputedStyle(node).boxShadow);
  expect(cardShadow).not.toContain("0px 0px 0px 1px");

  await pressAndCheck(viewMap, pressSurface, textColor);

  await page.goto("/guide.html");
  await expectFocusRing(page.locator('.guide-nav a:not([aria-current="page"])').first(), focusColor);

  await page.goto("/university.html?id=mit-usa-cambridge");
  await expect(page.locator("#detailCard")).toHaveClass(/is-mounted/);
  const detailShadow = await page.locator("#detailCard").evaluate((node) => getComputedStyle(node).boxShadow);
  expect(detailShadow).not.toContain("0px 0px 0px 1px");
});

test("recently viewed popover and search suggestions follow the shared dropdown contract in dark theme", async ({ page }) => {
  await markTourAsSeen(page);
  await page.addInitScript(() => localStorage.setItem("unisearch_theme", "dark"));

  await page.goto("/university.html?id=mit-usa-cambridge");
  await expect(page.locator("#detailCard")).toHaveClass(/is-mounted/);

  await page.goto("/index.html");
  await expect(page.locator(".uni-card:not(.is-skeleton)").first()).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  const dropdownSurface = await resolvedBackgroundToken(page, "--dropdown-surface");
  const hoverSurface = await resolvedBackgroundToken(page, "--interaction-hover-surface");

  const recentBtn = page.locator("#recentlyViewedBtn");
  await expect(recentBtn).toBeVisible();
  await recentBtn.click();

  const popover = page.locator("#recentlyViewedPopover");
  await expect(popover).toBeVisible();
  await expect(page.locator("#recentlyViewedTitle")).toHaveCount(0);
  await expect(popover).toHaveAttribute("aria-label", /.+/);
  await expectBackground(popover, dropdownSurface);

  await expect.poll(() => popover.evaluate((node) => getComputedStyle(node).boxShadow)).toContain("0px 0px 0px 1px");
  await expect.poll(() => recentBtn.evaluate((node) => getComputedStyle(node).boxShadow)).toContain("0px 0px 0px 1px");

  const recentChip = popover.locator(".u-recent__chip").first();
  await recentChip.hover();
  await expectBackground(recentChip, hoverSurface);

  await page.keyboard.press("Escape");

  await page.locator("#qInput").fill("Harvard");
  const suggestions = page.locator(".navbar-search-suggestions.is-open");
  await expect(suggestions.locator(".navbar-search-suggestion").first()).toBeVisible();
  await expectBackground(suggestions, dropdownSurface);
  await expect.poll(() => suggestions.evaluate((node) => getComputedStyle(node).boxShadow)).toContain("0px 0px 0px 1px");
});

test("shared .ui-switch controls unify size, label-left order, full-row clickability, and active pill states", async ({ page }) => {
  await markTourAsSeen(page);
  await page.goto("/index.html");
  await expect(page.locator(".uni-card:not(.is-skeleton)").first()).toBeVisible();

  const reviewedLabel = page.locator(".u-reviewed-toggle");
  const reviewedSwitch = page.locator("#reviewedOnlyToggle");
  await expect(reviewedSwitch).toHaveClass(/ui-switch/);
  expect(await reviewedSwitch.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    return { width: Math.round(rect.width), height: Math.round(rect.height) };
  })).toEqual({ width: 36, height: 20 });

  for (const theme of ["light", "dark"]) {
    await page.evaluate((value) => document.documentElement.setAttribute("data-theme", value), theme);
    const activeSurface = await resolvedBackgroundToken(page, "--accent-active-surface");
    const activeHoverSurface = await resolvedBackgroundToken(page, "--accent-active-hover-surface");

    await reviewedLabel.locator(".u-reviewed-toggle__text").click();
    await expect(reviewedSwitch).toBeChecked();
    await page.mouse.move(1, 1);
    await expectBackground(reviewedLabel, activeSurface);

    await reviewedLabel.hover();
    await expectBackground(reviewedLabel, activeHoverSurface);

    await reviewedLabel.click();
    await expect(reviewedSwitch).not.toBeChecked();
    await page.mouse.move(1, 1);
  }

  await page.click("#settingsBtn");
  await expect(page.locator("#settingsModal")).toHaveClass(/is-open/);
  const settingsRow = page.locator(".settings-row--switch").first();
  const settingsLabel = settingsRow.locator(".settings-switch");
  const settingsTitle = settingsRow.locator(".settings-copy__title");
  const settingsSwitch = settingsRow.locator("input.ui-switch");
  const initialChecked = await settingsSwitch.isChecked();
  expect(await settingsSwitch.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    return { width: Math.round(rect.width), height: Math.round(rect.height) };
  })).toEqual({ width: 36, height: 20 });

  const selectTitleBox = await page.locator(".settings-row .settings-copy h3").first().boundingBox();
  const switchTitleBox = await settingsTitle.boundingBox();
  expect(Math.abs(selectTitleBox.x - switchTitleBox.x)).toBeLessThanOrEqual(1);

  const settingsHoverSurface = await resolvedBackgroundToken(page, "--interaction-hover-surface");
  const settingsPressSurface = await resolvedBackgroundToken(page, "--interaction-press-surface");
  const switchAccentPress = await resolvedBackgroundToken(page, "--accent-press");

  await settingsTitle.hover();
  await expectBackground(settingsLabel, settingsHoverSurface);

  await page.mouse.move(switchTitleBox.x + switchTitleBox.width / 2, switchTitleBox.y + switchTitleBox.height / 2);
  await page.mouse.down();
  await expectBackground(settingsLabel, settingsPressSurface);
  if (initialChecked) {
    await expectBackground(settingsSwitch, switchAccentPress);
  }
  await page.mouse.up();
  await expect(settingsSwitch).toHaveJSProperty("checked", !initialChecked);

  await settingsTitle.click();
  await expect(settingsSwitch).toHaveJSProperty("checked", initialChecked);
  await page.keyboard.press("Escape");

  await page.goto("/compare.html?lang=eng&ids=abai-kazakh-national-pedagogical-university-kaz-almaty,al-farabi-kazakh-national-university-kaz-almaty&choices=abai_kaznpu_unt::abai_kaznpu_unt::abai_kaznpu_unt_paid,kaznu_unt::kaznu_unt::kaznu_unt_paid");
  const diffToggle = page.locator(".compare-diff-toggle");
  await expect(diffToggle).toBeVisible();
  const diffLayout = await diffToggle.evaluate((node) => {
    const labelRect = node.querySelector(".compare-diff-toggle__label").getBoundingClientRect();
    const switchEl = node.querySelector("input.ui-switch");
    const switchRect = switchEl.getBoundingClientRect();
    return {
      labelLeftOfSwitch: labelRect.right <= switchRect.left + 1,
      width: Math.round(switchRect.width),
      height: Math.round(switchRect.height),
    };
  });
  expect(diffLayout).toEqual({ labelLeftOfSwitch: true, width: 36, height: 20 });
});

test("shared .ui-btn and .ui-segmented primitives unify heights and radii across pages", async ({ page }) => {
  await markTourAsSeen(page);

  await page.goto("/index.html");
  await expect(page.locator(".uni-card:not(.is-skeleton)").first()).toBeVisible();
  const catalogMetrics = await page.evaluate(() => {
    const measure = (sel) => {
      const node = document.querySelector(sel);
      const rect = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      return { height: Math.round(rect.height), radius: style.borderTopLeftRadius };
    };
    return {
      reset: measure("#resetFiltersBtn"),
      compare: measure("#compareModeBtn"),
      toggles: measure("#viewToggles"),
      list: measure("#viewListBtn"),
    };
  });
  expect(catalogMetrics.reset).toEqual({ height: 32, radius: "8px" });
  expect(catalogMetrics.compare).toEqual({ height: 40, radius: "12px" });
  expect(catalogMetrics.toggles).toEqual({ height: 40, radius: "12px" });
  expect(catalogMetrics.list).toEqual({ height: 40, radius: "12px" });

  await page.goto("/guide.html");
  await expect(page.locator(".guide-start-actions .ui-btn").first()).toBeVisible();
  const guideMetrics = await page.locator(".guide-start-actions .ui-btn").evaluateAll((nodes) =>
    nodes.map((node) => ({
      height: Math.round(node.getBoundingClientRect().height),
      radius: getComputedStyle(node).borderTopLeftRadius,
    }))
  );
  expect(guideMetrics).toEqual([
    { height: 44, radius: "12px" },
    { height: 44, radius: "12px" },
  ]);

  await page.goto("/profile.html");
  await expect(page.locator(".profile-shell")).toBeVisible();
  const profileMetrics = await page.evaluate(() => ["#profileCloseBtn", "#saveProfileBtn", "#profileShowMatchesBtn"].map((sel) => {
    const node = document.querySelector(sel);
    return {
      height: Math.round(node.getBoundingClientRect().height),
      radius: getComputedStyle(node).borderTopLeftRadius,
    };
  }));
  expect(profileMetrics).toEqual([
    { height: 44, radius: "12px" },
    { height: 44, radius: "12px" },
    { height: 44, radius: "12px" },
  ]);

  await page.goto("/university.html?id=mit-usa-cambridge");
  await expect(page.locator("#detailCard")).toHaveClass(/is-mounted/);
  const detailMetrics = await page.locator("#detailWebsite, #detailSaveBtn").evaluateAll((nodes) =>
    nodes.map((node) => ({
      height: Math.round(node.getBoundingClientRect().height),
      radius: getComputedStyle(node).borderTopLeftRadius,
    }))
  );
  expect(detailMetrics).toEqual([
    { height: 44, radius: "12px" },
    { height: 44, radius: "12px" },
  ]);
});
