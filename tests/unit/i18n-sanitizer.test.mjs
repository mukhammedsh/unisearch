import "./setup.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";
import { sanitizeI18nHtml, applyTranslations } from "../../frontend/javascript/i18n.js";

test("sanitizeI18nHtml preserves safe formatting tags and removes dangerous attributes", () => {
  assert.equal(sanitizeI18nHtml("<b>bold</b>"), "<b>bold</b>");
  assert.equal(sanitizeI18nHtml("<strong>strong</strong>"), "<strong>strong</strong>");
  assert.equal(sanitizeI18nHtml("<em>em</em>"), "<em>em</em>");
  assert.equal(sanitizeI18nHtml("<i>italic</i>"), "<i>italic</i>");
  assert.equal(sanitizeI18nHtml("<br>"), "<br>");
  assert.equal(sanitizeI18nHtml("<span>span</span>"), "<span>span</span>");
  assert.equal(sanitizeI18nHtml("<code>console.log()</code>"), "<code>console.log()</code>");

  // Strips event handlers and inline styles
  assert.equal(sanitizeI18nHtml('<b onclick="alert(1)">bold</b>'), "<b>bold</b>");
  assert.equal(sanitizeI18nHtml('<span style="color:red" onmouseover="evil()">styled</span>'), "<span>styled</span>");
});

test("sanitizeI18nHtml eliminates scripts, styles, iframes, images and blocked elements", () => {
  assert.equal(sanitizeI18nHtml("<script>alert('xss')</script>"), "");
  assert.equal(sanitizeI18nHtml('<script src="https://evil.com/xss.js"></script>'), "");
  assert.equal(sanitizeI18nHtml("<style>body { display: none; }</style>safe text"), "safe text");
  assert.equal(sanitizeI18nHtml('<iframe src="https://evil.com"></iframe>'), "");
  assert.equal(sanitizeI18nHtml('<img src="x" onerror="alert(1)">'), "");
  assert.equal(sanitizeI18nHtml("<div>div content <strong>preserved</strong></div>"), "div content <strong>preserved</strong>");
});

test("sanitizeI18nHtml validates anchor href schemes strictly", () => {
  // Safe URLs
  assert.equal(sanitizeI18nHtml('<a href="https://example.com/admissions">Link</a>'), '<a href="https://example.com/admissions">Link</a>');
  assert.equal(sanitizeI18nHtml('<a href="http://example.com">Insecure HTTP</a>'), '<a href="http://example.com">Insecure HTTP</a>');
  assert.equal(sanitizeI18nHtml('<a href="mailto:info@mit.edu">Email</a>'), '<a href="mailto:info@mit.edu">Email</a>');
  assert.equal(sanitizeI18nHtml('<a href="/catalog/mit">Relative root</a>'), '<a href="/catalog/mit">Relative root</a>');
  assert.equal(sanitizeI18nHtml('<a href="./path">Relative dot</a>'), '<a href="./path">Relative dot</a>');
  assert.equal(sanitizeI18nHtml('<a href="#section">Anchor hash</a>'), '<a href="#section">Anchor hash</a>');

  // target="_blank" gets safe rel
  assert.equal(
    sanitizeI18nHtml('<a href="https://example.com" target="_blank">External</a>'),
    '<a href="https://example.com" target="_blank" rel="noopener noreferrer">External</a>'
  );

  // Dangerous URLs and schemes are stripped
  assert.equal(sanitizeI18nHtml('<a href="javascript:alert(1)">Click me</a>'), "Click me");
  assert.equal(sanitizeI18nHtml('<a href="javascript&colon;alert(1)">Click me</a>'), "Click me");
  assert.equal(sanitizeI18nHtml('<a href="&#106;avascript:alert(1)">Click me</a>'), "Click me");
  assert.equal(sanitizeI18nHtml('<a href="vbscript:msgbox(1)">Click me</a>'), "Click me");
  assert.equal(sanitizeI18nHtml('<a href="data:text/html,<script>alert(1)</script>">Click me</a>'), "Click me");
  assert.equal(sanitizeI18nHtml('<a href="//evil.com/phish">Protocol relative</a>'), "Protocol relative");
});

test("applyTranslations sanitizes [data-i18n-html] and leaves untouched when key is missing", () => {
  const elements = [
    {
      attrs: { "data-i18n-html": "nonexistent.key" },
      innerHTML: "<b>Original Unmodified</b>",
      getAttribute(k) { return this.attrs[k] || null; },
    },
  ];

  const fakeRoot = {
    querySelectorAll(selector) {
      if (selector === "[data-i18n-html]") return elements;
      return [];
    },
  };

  applyTranslations(fakeRoot);

  // Since nonexistent.key is not in dictionary and has no fallback attribute,
  // it must not be overwritten or re-evaluated
  assert.equal(elements[0].innerHTML, "<b>Original Unmodified</b>");
});
