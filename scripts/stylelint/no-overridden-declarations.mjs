// Stylelint rule: report a declaration that a later rule with the same selector always overrides.
//
// The later rule must apply wherever the earlier one does: the same at-rule context, a wider
// max-width media query, or the top level. It must set the same property, or a shorthand that
// covers it, with at least the same importance. Such a declaration can never take effect, so it
// only hides which rule really styles the element.
import stylelint from "stylelint";

const ruleName = "unisearch/no-overridden-declarations";
const messages = stylelint.utils.ruleMessages(ruleName, {
  overridden: (prop, selector, line) => `"${prop}" is always overridden by the later "${selector}" rule on line ${line}; remove it or merge the rules.`,
});

const SIDES = ["top", "right", "bottom", "left"];
const SHORTHANDS = {
  padding: [...SIDES.map((side) => `padding-${side}`), "padding-inline", "padding-block", "padding-inline-start", "padding-inline-end", "padding-block-start", "padding-block-end"],
  "padding-inline": ["padding-left", "padding-right", "padding-inline-start", "padding-inline-end"],
  "padding-block": ["padding-top", "padding-bottom", "padding-block-start", "padding-block-end"],
  margin: [...SIDES.map((side) => `margin-${side}`), "margin-inline", "margin-block", "margin-inline-start", "margin-inline-end", "margin-block-start", "margin-block-end"],
  "margin-inline": ["margin-left", "margin-right", "margin-inline-start", "margin-inline-end"],
  "margin-block": ["margin-top", "margin-bottom", "margin-block-start", "margin-block-end"],
  inset: [...SIDES, "inset-inline", "inset-block"],
  gap: ["row-gap", "column-gap", "grid-gap", "grid-row-gap", "grid-column-gap"],
  overflow: ["overflow-x", "overflow-y"],
  "border-radius": ["border-top-left-radius", "border-top-right-radius", "border-bottom-right-radius", "border-bottom-left-radius"],
  background: ["background-color", "background-image", "background-position", "background-size", "background-repeat", "background-clip", "background-origin", "background-attachment"],
  flex: ["flex-grow", "flex-shrink", "flex-basis"],
  "flex-flow": ["flex-direction", "flex-wrap"],
  "grid-template": ["grid-template-rows", "grid-template-columns", "grid-template-areas"],
  "grid-area": ["grid-row-start", "grid-row-end", "grid-column-start", "grid-column-end", "grid-row", "grid-column"],
  "grid-row": ["grid-row-start", "grid-row-end"],
  "grid-column": ["grid-column-start", "grid-column-end"],
  font: ["font-style", "font-variant", "font-weight", "font-stretch", "font-size", "line-height", "font-family"],
  border: [...SIDES.flatMap((side) => [`border-${side}`, `border-${side}-width`, `border-${side}-style`, `border-${side}-color`]), "border-width", "border-style", "border-color"],
  "border-width": SIDES.map((side) => `border-${side}-width`),
  "border-style": SIDES.map((side) => `border-${side}-style`),
  "border-color": SIDES.map((side) => `border-${side}-color`),
  outline: ["outline-width", "outline-style", "outline-color"],
  transition: ["transition-property", "transition-duration", "transition-timing-function", "transition-delay"],
  animation: ["animation-name", "animation-duration", "animation-timing-function", "animation-delay", "animation-iteration-count", "animation-direction", "animation-fill-mode", "animation-play-state"],
  "text-decoration": ["text-decoration-line", "text-decoration-color", "text-decoration-style", "text-decoration-thickness"],
  "place-items": ["align-items", "justify-items"],
  "place-content": ["align-content", "justify-content"],
  "place-self": ["align-self", "justify-self"],
  "list-style": ["list-style-type", "list-style-position", "list-style-image"],
};
for (const side of SIDES) SHORTHANDS[`border-${side}`] = [`border-${side}-width`, `border-${side}-style`, `border-${side}-color`];

// Values a browser may reject; a later rule using one is not a guaranteed override.
const MAY_BE_UNSUPPORTED = /dvh|svh|lvh|dvw|color-mix|-webkit-|-moz-|env\(|anchor|light-dark|text-wrap|field-sizing|interpolate-size|calc-size/i;

function touchedLonghands(prop) {
  const out = new Set([prop]);
  const stack = [prop];
  while (stack.length) for (const next of SHORTHANDS[stack.pop()] || []) if (!out.has(next)) { out.add(next); stack.push(next); }
  return out;
}
// `later` overrides `earlier` when it touches every longhand `earlier` touches.
function covers(later, earlier) {
  if (earlier.startsWith("--")) return later === earlier;
  const touched = touchedLonghands(later);
  for (const longhand of touchedLonghands(earlier)) if (!touched.has(longhand)) return false;
  return true;
}

function contextOf(node) {
  const parts = [];
  for (let parent = node.parent; parent && parent.type !== "root"; parent = parent.parent) {
    if (parent.type === "atrule") parts.unshift(`@${parent.name} ${parent.params.replace(/\s+/g, " ").trim()}`);
  }
  return parts;
}
const maxWidth = (context) => { const match = /^@media \(max-width: (\d+)px\)(?: and \(min-width: \d+px\))?$/.exec(context); return match ? Number(match[1]) : null; };
// The later context applies whenever the earlier one does.
function contextImplies(earlier, later) {
  if (later.length === 0) return true;
  if (later.some((part) => part.startsWith("@supports")) && JSON.stringify(earlier) !== JSON.stringify(later)) return false;
  if (earlier.length !== later.length) return false;
  return earlier.every((part, index) => {
    if (part === later[index]) return true;
    const earlierWidth = maxWidth(part);
    const laterWidth = /^@media \(max-width: \d+px\)$/.test(later[index]) ? maxWidth(later[index]) : null;
    return earlierWidth != null && laterWidth != null && laterWidth >= earlierWidth;
  });
}
const normalizeSelector = (selector) => selector.split(",").map((part) => part.replace(/\s+/g, " ").trim()).sort().join(", ");

const ruleFunction = (primary) => (root, result) => {
  if (!stylelint.utils.validateOptions(result, ruleName, { actual: primary, possible: [true] })) return;
  const bySelector = new Map();
  root.walkRules((rule) => {
    if (rule.parent?.type === "atrule" && /keyframes$/i.test(rule.parent.name)) return;
    const key = normalizeSelector(rule.selector);
    if (!bySelector.has(key)) bySelector.set(key, []);
    bySelector.get(key).push({ rule, context: contextOf(rule) });
  });
  for (const list of bySelector.values()) {
    if (list.length < 2) continue;
    list.forEach((earlier, index) => {
      earlier.rule.each((decl) => {
        if (decl.type !== "decl") return;
        for (const later of list.slice(index + 1)) {
          if (!contextImplies(earlier.context, later.context)) continue;
          const winner = later.rule.nodes.find((other) => other.type === "decl"
            && covers(other.prop, decl.prop)
            && (!decl.important || other.important)
            && !MAY_BE_UNSUPPORTED.test(other.value)
            && !MAY_BE_UNSUPPORTED.test(other.prop));
          if (!winner) continue;
          stylelint.utils.report({
            ruleName,
            result,
            node: decl,
            word: decl.prop,
            message: messages.overridden(decl.prop, later.rule.selector.replace(/\s+/g, " "), later.rule.source?.start?.line ?? 0),
          });
          return;
        }
      });
    });
  }
};

ruleFunction.ruleName = ruleName;
ruleFunction.messages = messages;
ruleFunction.meta = { url: "https://github.com/mukhammedsh/unisearch/blob/main/docs/design-system.md" };

export default stylelint.createPlugin(ruleName, ruleFunction);
