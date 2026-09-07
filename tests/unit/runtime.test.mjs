import "./setup.mjs";
import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";

import {
  aiName,
  frontendStaticAsset,
  prefersReducedMotion,
  AI_DEFAULTS,
} from "../../frontend/javascript/utils/runtime.js";

describe("runtime.js", () => {
  beforeEach(() => {
    window.location = {
      protocol: "http:",
      hostname: "localhost",
      pathname: "/",
    };
  });

  describe("aiName", () => {
    it("resolves default AI names correctly", () => {
      assert.equal(aiName("fit"), "UniFit");
      assert.equal(aiName("chance"), "UniChance");
      assert.equal(aiName("  FIT  "), "UniFit");
      assert.equal(aiName("CHANCE"), "UniChance");
    });

    it("falls back to generic label for unknown keys", () => {
      assert.equal(aiName("unknown"), "AI Function");
      assert.equal(aiName(""), "AI Function");
      assert.equal(aiName(null), "AI Function");
    });
  });

  describe("frontendStaticAsset", () => {
    it("returns clean path when served from root", () => {
      window.location.pathname = "/universities.html";
      assert.equal(frontendStaticAsset("images/logo.png"), "/images/logo.png");
      assert.equal(frontendStaticAsset("/images/logo.png"), "/images/logo.png");
      assert.equal(frontendStaticAsset("///images///logo.png"), "/images/logo.png");
    });

    it("prepends /frontend prefix when app is running under /frontend subpath", () => {
      window.location.pathname = "/frontend/universities.html";
      assert.equal(frontendStaticAsset("images/logo.png"), "/frontend/images/logo.png");
      assert.equal(frontendStaticAsset("/css/style.css"), "/frontend/css/style.css");
    });
  });

  describe("prefersReducedMotion", () => {
    it("returns false when matchMedia does not match", () => {
      window.matchMedia = () => ({ matches: false });
      assert.equal(prefersReducedMotion(), false);
    });

    it("returns true when matchMedia matches reduced motion", () => {
      window.matchMedia = (query) => ({
        matches: query.includes("prefers-reduced-motion: reduce"),
      });
      assert.equal(prefersReducedMotion(), true);
    });
  });
});
