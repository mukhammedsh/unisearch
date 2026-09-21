const { test, expect } = require("@playwright/test");
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

async function expectAccentFocus(locator, accentColor) {
  await locator.focus();
  if (!await locator.evaluate((node) => node.matches(":focus-visible"))) {
    await locator.page().keyboard.press("Shift+Tab");
    await locator.page().keyboard.press("Tab");
  }
  await expect.poll(() => locator.evaluate((node) => {
    const style = getComputedStyle(node);
    return `${style.outlineWidth} ${style.outlineStyle} ${style.outlineColor}`;
  })).toBe(`2px solid ${accentColor}`);
}

async function expectCompositeFocus(control, composite, accentColor) {
  await control.focus();
  await expect.poll(() => composite.evaluate((node) => {
    const style = getComputedStyle(node);
    return `${style.outlineWidth} ${style.outlineStyle} ${style.outlineColor}`;
  })).toBe(`2px solid ${accentColor}`);
}

test("shared controls use one hover, active, focus, pressed, and disabled contract", async ({ page }) => {
  await markTourAsSeen(page);
  await page.goto("/guide.html");

  const hoverColor = await resolvedToken(page, "--interaction-hover-text");
  const activeColor = await resolvedToken(page, "--interaction-active-text");
  const accentColor = await resolvedToken(page, "--accent");

  const activeGuideLink = page.locator(".guide-nav a.is-active").first();
  await expect(activeGuideLink).toBeVisible();
  await expectColor(activeGuideLink, activeColor);

  const inactiveGuideLink = page.locator(".guide-nav a:not(.is-active)").first();
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
  expect(focusStyle).toEqual({ color: accentColor, style: "solid", width: "2px" });

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
  expect(await pressedProbe.evaluate((node) => getComputedStyle(node).translate)).toBe("0px 1px");
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

test("compare mode uses the same neutral control surface in light and dark themes", async ({ page }) => {
  await markTourAsSeen(page);
  await page.goto("/index.html");
  await expect(page.locator(".uni-card:not(.is-skeleton)").first()).toBeVisible();

  const compareMode = page.locator("#compareModeBtn");
  await expect.poll(() => compareMode.evaluate((node) => getComputedStyle(node).backgroundColor))
    .toBe(await resolvedBackgroundToken(page, "--surface-soft"));

  await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
  await expect.poll(() => compareMode.evaluate((node) => getComputedStyle(node).backgroundColor))
    .toBe(await resolvedBackgroundToken(page, "--surface-soft"));
});

test("profile controls follow the shared interaction contract in light and dark themes", async ({ page }) => {
  await markTourAsSeen(page);
  await page.goto("/profile.html");
  await expect(page.locator(".profile-shell")).toBeVisible();

  for (const theme of ["light", "dark"]) {
    await page.evaluate((value) => document.documentElement.setAttribute("data-theme", value), theme);

    const accentColor = await resolvedToken(page, "--accent");
    const hoverColor = await resolvedToken(page, "--interaction-hover-text");
    const mutedColor = await resolvedToken(page, "--text-muted");
    const softSurface = await resolvedBackgroundToken(page, "--surface-soft");
    const hoverSurface = await resolvedBackgroundToken(page, "--interaction-hover-surface");

    const field = page.locator("#budgetInput");
    const fieldComposite = field.locator("xpath=..");
    await expectBackground(fieldComposite, softSurface);
    await field.hover();
    await expectBackground(fieldComposite, hoverSurface);
    await expectCompositeFocus(field, fieldComposite, accentColor);

    const secondaryAction = page.locator(".profile-action-btn--secondary");
    await expectBackground(secondaryAction, softSurface);
    await secondaryAction.hover();
    await expectBackground(secondaryAction, hoverSurface);
    await expectColor(secondaryAction, hoverColor);
    await expectAccentFocus(secondaryAction, accentColor);

    await page.locator('[data-profile-tab="scores"]').click();
    const unitToggle = page.locator(".profile-unit--toggle");
    const gpaComposite = unitToggle.locator("xpath=..");
    await expectColor(unitToggle, mutedColor);
    await unitToggle.hover();
    await expectBackground(gpaComposite, hoverSurface);
    await expectBackground(unitToggle, await resolvedBackgroundToken(page, "--interaction-active-surface"));
    await expectColor(unitToggle, hoverColor);
    await expectCompositeFocus(unitToggle, gpaComposite, accentColor);

    const infoButton = page.locator(".profile-info").first();
    await expectColor(infoButton, mutedColor);
    await infoButton.hover();
    await expectBackground(infoButton, hoverSurface);
    await expectColor(infoButton, hoverColor);
    await expectAccentFocus(infoButton, accentColor);

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
    const accentColor = await resolvedToken(page, "--accent");
    const hoverSurface = await resolvedBackgroundToken(page, "--interaction-hover-surface");
    const activeSurface = await resolvedBackgroundToken(page, "--interaction-active-surface");

    await clearButton.hover();
    await expectBackground(searchComposite, hoverSurface);
    await expectBackground(clearButton, activeSurface);
    await expectCompositeFocus(clearButton, searchComposite, accentColor);
  }

  await page.setViewportSize({ width: 375, height: 667 });
  await page.reload();
  await page.locator("#navbarSearchToggle").click();
  await expect(searchComposite).toBeVisible();
  const mobileBounds = await searchComposite.boundingBox();
  expect(mobileBounds.x).toBeGreaterThanOrEqual(0);
  expect(mobileBounds.x + mobileBounds.width).toBeLessThanOrEqual(375);
});
