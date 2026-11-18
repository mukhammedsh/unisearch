// Cascade and token checks for frontend CSS. Run with `npm run check:stylelint`.
// The rules keep one effective rule per selector and context, and keep design values on tokens.
export default {
  plugins: [
    "stylelint-declaration-strict-value",
    "stylelint-value-no-unknown-custom-properties",
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
    // Every var(--token) must be defined in the CSS codebase (or explicitly passed via inline JS style).
    "csstools/value-no-unknown-custom-properties": [
      true,
      {
        importFrom: [
          "frontend/css/shared/01-foundation.css",
          "frontend/css/shared/02-shell-settings-feedback.css",
          "frontend/css/shared/06-motion-accessibility.css",
          "frontend/css/shared/08-device-responsive.css",
          "frontend/css/shared/10-admissions.css",
          "frontend/css/profile/01-shared-foundation.css",
          "frontend/css/profile/02-page.css",
          "frontend/css/universities/01-shell-controls.css",
          "frontend/css/universities/02-catalog.css",
          "frontend/css/universities/03-comparison.css",
          "frontend/css/universities/06-map.css",
          "frontend/css/universities/07-responsive.css",
          "frontend/css/universities/08-onboarding.css",
          "frontend/css/universities/09-reviewed-comparison.css",
          "frontend/css/university/01-shell-hero.css",
          "frontend/css/university/02-overview-programs.css",
          "frontend/css/university/03-admissions.css",
          "frontend/css/university/04-finance-aid.css",
          "frontend/css/university/05-admissions-reviewed.css",
        ],
      },
    ],
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
