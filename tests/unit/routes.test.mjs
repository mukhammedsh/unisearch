import "./setup.mjs";
import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";

import {
  usePrettyUrls,
  routeUniversities,
  routeCompareSelection,
  routeCompareResults,
  routeGuide,
  routeAbout,
  routePrivacy,
  routeTerms,
  routeProfile,
  routeUniversityDetail,
  isUniversitiesListPath,
  isUniversityDetailPath,
  isGuidePath,
  isAboutPath,
  isPrivacyPath,
  isTermsPath,
  isProfilePath,
  getUniversityIdFromPath,
  extractUniversityIdFromLocation,
} from "../../frontend/javascript/routes.js";

describe("routes.js", () => {
  beforeEach(() => {
    delete window.APP_USE_PRETTY_URLS;
    delete window.IS_LOCAL_DEV;
    window.location = {
      protocol: "http:",
      hostname: "localhost",
      port: "5510",
      pathname: "/",
      search: "",
    };
  });

  describe("usePrettyUrls", () => {
    it("respects window.APP_USE_PRETTY_URLS when set", () => {
      window.APP_USE_PRETTY_URLS = true;
      assert.equal(usePrettyUrls(), true);
      window.APP_USE_PRETTY_URLS = false;
      assert.equal(usePrettyUrls(), false);
    });

    it("respects IS_LOCAL_DEV fallback when present", () => {
      window.IS_LOCAL_DEV = true;
      assert.equal(usePrettyUrls(), false);
      window.IS_LOCAL_DEV = false;
      assert.equal(usePrettyUrls(), true);
    });

    it("detects local development hosts and ports as non-pretty", () => {
      window.location.hostname = "localhost";
      assert.equal(usePrettyUrls(), false);

      window.location.hostname = "127.0.0.1";
      assert.equal(usePrettyUrls(), false);
    });

    it("enables pretty URLs on production hosts", () => {
      window.location.hostname = "unisearch.edu";
      window.location.port = "";
      assert.equal(usePrettyUrls(), true);
    });
  });

  describe("Route generators in local/file mode", () => {
    beforeEach(() => {
      window.APP_USE_PRETTY_URLS = false;
    });

    it("generates correct html filenames for main views", () => {
      assert.equal(routeUniversities(), "index.html");
      assert.equal(routeCompareSelection(), "index.html?tab=compare&compare=select");
      assert.equal(routeGuide(), "guide.html");
      assert.equal(routeAbout(), "about.html");
      assert.equal(routePrivacy(), "privacy.html");
      assert.equal(routeTerms(), "terms.html");
      assert.equal(routeProfile(), "profile.html");
    });

    it("generates university detail with id in query param", () => {
      assert.equal(routeUniversityDetail("mit-usa-cambridge"), "university.html?id=mit-usa-cambridge");
      assert.equal(
        routeUniversityDetail("mit-usa-cambridge", { tab: "admission" }),
        "university.html?tab=admission&id=mit-usa-cambridge"
      );
    });

    it("generates compare results route with ids and choices", () => {
      const url = routeCompareResults(["mit", "harvard"], ["mit::sat::paid"], { lang: "eng" });
      assert.match(url, /tab=compare/);
      assert.match(url, /compare=results/);
      assert.match(url, /ids=mit%2Charvard/);
      assert.match(url, /choices=mit%3A%3Asat%3A%3Apaid/);
      assert.match(url, /lang=eng/);
    });

    it("falls back to routeUniversities when universityId is empty", () => {
      assert.equal(routeUniversityDetail(""), "index.html");
      assert.equal(routeUniversityDetail(null), "index.html");
    });
  });

  describe("Route generators in pretty URLs mode", () => {
    beforeEach(() => {
      window.APP_USE_PRETTY_URLS = true;
    });

    it("generates clean paths without .html extensions", () => {
      assert.equal(routeUniversities(), "/");
      assert.equal(routeCompareSelection(), "/?tab=compare&compare=select");
      assert.equal(routeGuide(), "/guide");
      assert.equal(routeAbout(), "/about");
      assert.equal(routeProfile(), "/profile");
      assert.equal(routeUniversityDetail("mit-usa-cambridge"), "/universities/mit-usa-cambridge");
    });

    it("appends query parameters cleanly to pretty routes", () => {
      assert.equal(routeUniversities({ ref: "banner" }), "/?ref=banner");
      assert.equal(routeUniversities("sort=uni_ai"), "/?sort=uni_ai");
      assert.equal(
        routeUniversityDetail("mit-usa-cambridge", { lang: "rus" }),
        "/universities/mit-usa-cambridge?lang=rus"
      );
    });
  });

  describe("Path matching helpers", () => {
    it("isUniversitiesListPath matches universities views", () => {
      assert.equal(isUniversitiesListPath("/"), true);
      assert.equal(isUniversitiesListPath("/index.html"), true);
      assert.equal(isUniversitiesListPath("/universities"), false);
      assert.equal(isUniversitiesListPath("/university.html"), false);
    });

    it("isUniversityDetailPath matches both detail pages and subpaths", () => {
      assert.equal(isUniversityDetailPath("/university.html"), true);
      assert.equal(isUniversityDetailPath("/universities/mit-usa-cambridge"), true);
      assert.equal(isUniversityDetailPath("/universities"), false);
    });

    it("matches other top-level section routes", () => {
      assert.equal(isGuidePath("/guide.html"), true);
      assert.equal(isAboutPath("/about.html"), true);
      assert.equal(isPrivacyPath("/privacy.html"), true);
      assert.equal(isTermsPath("/terms.html"), true);
      assert.equal(isProfilePath("/profile.html"), true);
    });
  });

  describe("University ID extraction", () => {
    it("getUniversityIdFromPath extracts slug from pretty path", () => {
      assert.equal(getUniversityIdFromPath("/universities/mit-usa-cambridge"), "mit-usa-cambridge");
      assert.equal(getUniversityIdFromPath("/universities/aitu-kaz-astana/"), "aitu-kaz-astana");
      assert.equal(getUniversityIdFromPath("/other/path"), "");
    });

    it("extractUniversityIdFromLocation extracts id from search query or pathname", () => {
      assert.equal(
        extractUniversityIdFromLocation({ pathname: "/university.html", search: "?id=harvard-usa-cambridge" }),
        "harvard-usa-cambridge"
      );
      assert.equal(
        extractUniversityIdFromLocation({ pathname: "/universities/oxford-uk-oxford", search: "" }),
        "oxford-uk-oxford"
      );
      assert.equal(
        extractUniversityIdFromLocation({ pathname: "/universities.html", search: "" }),
        ""
      );
    });
  });
});
