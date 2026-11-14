// Cascade and token checks for frontend CSS. Run with `npm run check:stylelint`.
// The rules keep one effective rule per selector and context, and keep design values on tokens.
export default {
  plugins: [
    "stylelint-declaration-strict-value",
    "./scripts/stylelint/no-overridden-declarations.mjs",
  ],
  rules: {
    // A selector defined twice in the same context splits its styles and hides the winning rule.
    "no-duplicate-selectors": true,
    // Repeating a property in one block is a mistake unless it is an intentional fallback.
    "declaration-block-no-duplicate-properties": [true, { ignore: ["consecutive-duplicates-with-different-syntaxes"] }],
    // A shorthand after its own longhand in the same block silently resets it.
    "declaration-block-no-shorthand-property-overrides": true,
    // A later rule for the same selector that always wins makes the earlier declaration dead code.
    "unisearch/no-overridden-declarations": true,
    // Colors, type sizes, weights and radii come from the tokens in shared/01-foundation.css.
    "scale-unlimited/declaration-strict-value": [
      ["/color$/", "fill", "stroke", "font-size", "font-weight", "/radius$/"],
      {
        ignoreValues: ["transparent", "currentColor", "currentcolor", "inherit", "initial", "unset", "revert", "none", "0", "0px", "50%", "100%", "inherit", "normal"],
        ignoreFunctions: true,
        disableFix: true,
      },
    ],
  },
  overrides: [
    {
      // Token definitions and font faces are where the raw values live.
      files: ["frontend/css/shared/01-foundation.css"],
      rules: { "scale-unlimited/declaration-strict-value": null },
    },
  ],
};
