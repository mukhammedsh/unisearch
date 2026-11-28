const fs = require("node:fs");
const path = require("node:path");
const AxePackage = require("@axe-core/playwright");
const { test, expect } = require("./helpers/coverage-test.cjs");
const { markTourAsSeen } = require("./helpers/personas");
const { openProfileTab } = require("./helpers/selectors");

const AxeBuilder = AxePackage.default || AxePackage.AxeBuilder || AxePackage;
const SHOWCASE_HTML = fs.readFileSync(
  path.resolve(__dirname, "fixtures", "design-system-showcase.html"),
  "utf8"
);

async function resolvedToken(page, name) {
  return page.evaluate((token) => {
    const probe = document.createElement("span");
    probe.style.color = `var(${token})`;
    document.body.appendChild(probe);
    const value = getComputedStyle(probe).color;
    probe.remove();
    return value;
  }, name);
}

test("design system showcase primitives share standardized geometry, states, and accessibility", async ({ page }) => {
  await page.route("**/__design-system-showcase.html", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/html; charset=utf-8",
      body: SHOWCASE_HTML,
    });
  });

  await page.goto("/__design-system-showcase.html");

  for (const theme of ["light", "dark"]) {
    await page.evaluate((value) => document.documentElement.setAttribute("data-theme", value), theme);

    const focusColor = await resolvedToken(page, "--focus-ring");
    const dangerColor = await resolvedToken(page, "--color-danger");

    const metrics = await page.evaluate(() => {
      const box = (sel) => {
        const node = document.querySelector(sel);
        const rect = node.getBoundingClientRect();
        const style = getComputedStyle(node);
        return {
          height: Math.round(rect.height),
          radius: style.borderTopLeftRadius,
          borderWidth: style.borderTopWidth,
          opacity: style.opacity,
          backgroundColor: style.backgroundColor,
          boxShadow: style.boxShadow,
        };
      };
      return {
        inputSm: box("#inputSm"),
        inputMd: box("#inputMd"),
        inputLg: box("#inputLg"),
        inputDisabled: box("#inputDisabled"),
        compositeMd: box("#compositeMd"),
        compositeLg: box("#compositeLg"),
        selectSm: box("#selectSm"),
        selectMd: box("#selectMd"),
        selectLg: box("#selectLg"),
        customSm: box("#customTriggerSm"),
        customMd: box("#customTriggerMd"),
        customLg: box("#customTriggerLg"),
        btnSm: box("#btnSm"),
        btnMd: box("#btnMd"),
        btnLg: box("#btnLg"),
        btnSubtle: box("#btnSubtle"),
        btnGhost: box("#btnGhost"),
        btnIcon: box("#btnIcon"),
        btnDisabled: box("#btnDisabled"),
        nestedBtn: box("#nestedBtn"),
      };
    });

    expect(metrics.inputSm).toMatchObject({ height: 32, radius: "8px", borderWidth: "0px" });
    expect(metrics.inputMd).toMatchObject({ height: 40, radius: "12px", borderWidth: "0px" });
    expect(metrics.inputLg).toMatchObject({ height: 44, radius: "12px", borderWidth: "0px" });
    expect(metrics.inputDisabled.opacity).toBe("0.52");
    await expect.poll(() => page.locator("#inputInvalid").evaluate((n) => getComputedStyle(n).boxShadow)).toContain(dangerColor);

    expect(metrics.compositeMd).toMatchObject({ height: 40, radius: "12px", borderWidth: "0px" });
    expect(metrics.compositeLg).toMatchObject({ height: 44, radius: "12px", borderWidth: "0px" });

    expect(metrics.selectSm).toMatchObject({ height: 32, radius: "8px", borderWidth: "0px" });
    expect(metrics.selectMd).toMatchObject({ height: 40, radius: "12px", borderWidth: "0px" });
    expect(metrics.selectLg).toMatchObject({ height: 44, radius: "12px", borderWidth: "0px" });

    expect(metrics.customSm).toMatchObject({ height: 36, radius: "12px", borderWidth: "0px" });
    expect(metrics.customMd).toMatchObject({ height: 40, radius: "12px", borderWidth: "0px" });
    expect(metrics.customLg).toMatchObject({ height: 44, radius: "12px", borderWidth: "0px" });

    expect(metrics.btnSm).toMatchObject({ height: 32, radius: "8px", borderWidth: "0px" });
    expect(metrics.btnMd).toMatchObject({ height: 40, radius: "12px", borderWidth: "0px", boxShadow: "none" });
    expect(metrics.btnLg).toMatchObject({ height: 44, radius: "12px", borderWidth: "0px" });
    expect(metrics.btnSubtle).toMatchObject({ height: 40, radius: "12px", borderWidth: "0px", boxShadow: "none" });
    expect(metrics.btnGhost).toMatchObject({
      height: 40,
      radius: "12px",
      borderWidth: "0px",
      backgroundColor: "rgba(0, 0, 0, 0)",
      boxShadow: "none",
    });
    expect(metrics.btnIcon).toMatchObject({ height: 40, radius: "12px", borderWidth: "0px" });
    expect(metrics.btnDisabled.opacity).toBe("0.52");
    expect(metrics.nestedBtn.boxShadow).not.toBe("none");

    await page.locator("#inputMd").focus();
    if (!await page.locator("#inputMd").evaluate((n) => n.matches(":focus-visible"))) {
      await page.keyboard.press("Shift+Tab");
      await page.keyboard.press("Tab");
    }
    await expect.poll(() => page.locator("#inputMd").evaluate((n) => {
      const s = getComputedStyle(n);
      return `${s.outlineWidth} ${s.outlineStyle} ${s.outlineColor}`;
    })).toBe(`2px solid ${focusColor}`);

    await page.locator("#inputCompositeMd").focus();
    await expect.poll(() => page.locator("#compositeMd").evaluate((n) => {
      const s = getComputedStyle(n);
      return `${s.outlineWidth} ${s.outlineStyle} ${s.outlineColor}`;
    })).toBe(`2px solid ${focusColor}`);

    await expect.poll(() => page.locator("#compositeInvalid").evaluate((n) => {
      const s = getComputedStyle(n);
      return `${s.outlineWidth} ${s.outlineStyle} ${s.outlineColor}`;
    })).toBe(`2px solid ${dangerColor}`);

    const axeResults = await new AxeBuilder({ page }).analyze();
    expect(axeResults.violations).toEqual([]);
  }
});

test("live inputs across catalog, profile, university, and compare picker share one borderless input contract", async ({ page }) => {
  await markTourAsSeen(page);
  await page.addInitScript(() => localStorage.setItem("unisearch_theme", "dark"));

  await page.goto("/index.html");
  await expect(page.locator(".uni-card:not(.is-skeleton)").first()).toBeVisible();
  const focusColor = await resolvedToken(page, "--focus-ring");

  const catalogCheck = await page.evaluate(() => {
    const minInput = document.querySelector("#minCostInput");
    const navComposite = document.querySelector(".navbar-search-field");
    return {
      minInput: {
        height: Math.round(minInput.getBoundingClientRect().height),
        radius: getComputedStyle(minInput).borderTopLeftRadius,
        borderWidth: getComputedStyle(minInput).borderTopWidth,
      },
      navComposite: {
        height: Math.round(navComposite.getBoundingClientRect().height),
        radius: getComputedStyle(navComposite).borderTopLeftRadius,
        borderWidth: getComputedStyle(navComposite).borderTopWidth,
      },
    };
  });
  expect(catalogCheck.minInput).toEqual({ height: 40, radius: "12px", borderWidth: "0px" });
  expect(catalogCheck.navComposite).toEqual({ height: 44, radius: "12px", borderWidth: "0px" });

  await page.goto("/profile.html");
  await expect(page.locator(".profile-shell")).toBeVisible();
  await openProfileTab(page, "preferences");
  const profileCheck = await page.evaluate(() => {
    const budgetComposite = document.querySelector("#budgetInput").closest(".ui-input-composite");
    const selectTrigger = document.querySelector("#profileSectionBudget .custom-select-trigger");
    return {
      budget: {
        height: Math.round(budgetComposite.getBoundingClientRect().height),
        radius: getComputedStyle(budgetComposite).borderTopLeftRadius,
        borderWidth: getComputedStyle(budgetComposite).borderTopWidth,
      },
      selectTrigger: {
        height: Math.round(selectTrigger.getBoundingClientRect().height),
        radius: getComputedStyle(selectTrigger).borderTopLeftRadius,
        borderWidth: getComputedStyle(selectTrigger).borderTopWidth,
      },
    };
  });
  expect(profileCheck.budget).toEqual({ height: 44, radius: "12px", borderWidth: "0px" });
  expect(profileCheck.selectTrigger).toEqual({ height: 44, radius: "12px", borderWidth: "0px" });

  await page.goto("/university.html?id=mit-usa-cambridge");
  await expect(page.locator("#detailCard")).toHaveClass(/is-mounted/);
  await page.locator('[data-tab="tab-programs"]').click();
  const programSearch = page.locator("#tab-programs .program-search");
  await expect(programSearch).toBeVisible();
  const programCheck = await programSearch.evaluate((node) => ({
    height: Math.round(node.getBoundingClientRect().height),
    radius: getComputedStyle(node).borderTopLeftRadius,
    borderWidth: getComputedStyle(node).borderTopWidth,
  }));
  expect(programCheck).toEqual({ height: 44, radius: "12px", borderWidth: "0px" });

  await page.goto("/compare.html?ids=mit-usa-cambridge,imperial-college-london-uk");
  const pickBtn = page.locator("[data-compare-pick]").first();
  await expect(pickBtn).toBeVisible();
  await pickBtn.click();
  const pickerSearch = page.locator(".compare-picker__search");
  await expect(pickerSearch).toBeVisible();
  const pickerInput = pickerSearch.locator("input");
  await pickerInput.focus();

  const pickerCheck = await pickerSearch.evaluate((node) => {
    const style = getComputedStyle(node);
    return {
      height: Math.round(node.getBoundingClientRect().height),
      radius: style.borderTopLeftRadius,
      borderWidth: style.borderTopWidth,
      outline: `${style.outlineWidth} ${style.outlineStyle} ${style.outlineColor}`,
    };
  });
  expect(pickerCheck).toEqual({
    height: 40,
    radius: "12px",
    borderWidth: "0px",
    outline: `2px solid ${focusColor}`,
  });
});
