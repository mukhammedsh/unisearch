const { expect } = require("@playwright/test");

// shortcut: scans visible flex/grid children in the requested scope; add calls for new layout states.
async function expectNoStackedGapMargins(page, scopeSelector) {
  const stacks = await page.evaluate((selector) => {
    const visible = (element) => element instanceof HTMLElement && element.offsetParent !== null;
    const px = (value) => Number.parseFloat(value) || 0;
    const stacks = [];
    const scope = document.querySelector(selector);
    if (!scope) throw new Error(`Spacing audit scope not found: ${selector}`);

    for (const parent of [scope, ...scope.querySelectorAll("*")]) {
      if (!visible(parent)) continue;
      const parentStyle = getComputedStyle(parent);
      const isFlex = parentStyle.display.endsWith("flex");
      const isGrid = parentStyle.display.endsWith("grid");
      if (!isFlex && !isGrid) continue;

      const rowGap = px(parentStyle.rowGap);
      const columnGap = px(parentStyle.columnGap);
      const vertical = isGrid
        ? rowGap > 0
        : (parentStyle.flexDirection.startsWith("column") ? rowGap > 0 : parentStyle.flexWrap !== "nowrap" && rowGap > 0);
      const horizontal = isGrid
        ? columnGap > 0
        : (parentStyle.flexDirection.startsWith("row") ? columnGap > 0 : parentStyle.flexWrap !== "nowrap" && columnGap > 0);
      if (!vertical && !horizontal) continue;

      for (const child of parent.children) {
        if (!visible(child)) continue;
        const childStyle = getComputedStyle(child);
        const sides = [
          ...(vertical ? [["marginTop", childStyle.marginTop], ["marginBottom", childStyle.marginBottom]] : []),
          ...(horizontal ? [["marginLeft", childStyle.marginLeft], ["marginRight", childStyle.marginRight]] : []),
        ];
        const margins = sides.filter(([, value]) => px(value) > 0.5);
        if (margins.length) {
          stacks.push({
            parent: `${parent.tagName.toLowerCase()}.${Array.from(parent.classList).join(".")}`,
            child: `${child.tagName.toLowerCase()}.${Array.from(child.classList).join(".")}`,
            margins: Object.fromEntries(margins),
          });
        }
      }
    }

    return stacks;
  }, scopeSelector);

  expect(stacks).toEqual([]);
}

module.exports = { expectNoStackedGapMargins };
