import "./setup.mjs";
import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";

import {
  usePrettyUrls,
  routeUniversities,
  routeCompare,
  routeCompareSelection,
  routeCompareResults,
  routeGuide,
  routeGuideSection,
  applyRouteLinks,
  routeAbout,
  routePrivacy,
  routeTerms,
  routeProfile,
  routeUniversityDetail,
  isUniversitiesListPath,
  isUniversityDetailPath,
  isComparePath,
  isGuidePath,
  isAboutPath,
  isPrivacyPath,
  isTermsPath,
  isProfilePath,
  getUniversityIdFromPath,
  extractUniversityIdFromLocation,
  resolveAppBasePath,
  resolveAppBaseUrl,
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
      assert.equal(routeCompareSelection(), "index.html?tab=compare");
      assert.equal(routeCompare(["mit", "harvard"]), "compare.html?ids=mit%2Charvard");
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
      assert.match(url, /^compare\.html\?/);
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
      assert.equal(routeCompareSelection(), "/?tab=compare");
      assert.equal(routeCompare(["mit", "harvard"]), "/compare?ids=mit%2Charvard");
      assert.equal(routeGuide(), "/guide");
      assert.equal(routeGuideSection("guide-unifit-budget"), "/guide#guide-unifit-budget");
      assert.equal(routeAbout(), "/about");
      assert.equal(routeProfile(), "/profile");
      assert.equal(routeUniversityDetail("mit-usa-cambridge"), "/universities/mit-usa-cambridge");
    });

    it("keeps a route link's fragment when rewriting it", () => {
      const attributes = { "data-route": "guide", href: "guide.html#guide-academic-exams" };
      const link = {
        search: "",
        hash: "#guide-academic-exams",
        getAttribute: (name) => attributes[name] ?? null,
        setAttribute: (name, value) => { attributes[name] = value; },
      };
      applyRouteLinks({ querySelectorAll: () => [link] });
      assert.equal(attributes.href, "/guide#guide-academic-exams");
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
      assert.equal(isComparePath("/compare.html"), true);
      assert.equal(isComparePath("/compare"), true);
      assert.equal(isComparePath("/"), false);
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

  describe("App asset base resolution", () => {
    it("resolves nested pretty routes back to the app root path", () => {
      assert.equal(resolveAppBasePath("/"), "/");
      assert.equal(resolveAppBasePath("/index.html"), "/");
      assert.equal(resolveAppBasePath("/universities/johns-hopkins-university-usa-baltimore"), "/");
      assert.equal(resolveAppBasePath("/universities/johns-hopkins-university-usa-baltimore/"), "/");
      assert.equal(resolveAppBasePath("/compare/"), "/");
      assert.equal(resolveAppBasePath("/frontend"), "/frontend/");
      assert.equal(resolveAppBasePath("/frontend/universities/mit-usa-cambridge"), "/frontend/");
      assert.equal(resolveAppBasePath("/frontend/guide/"), "/frontend/");
      assert.equal(resolveAppBasePath("/subpath/universities/mit-usa-cambridge"), "/subpath/");
    });

    it("resolves relative university stylesheets against the app root instead of /universities/", () => {
      const base = resolveAppBaseUrl("https://unisearch.web.app/universities/johns-hopkins-university-usa-baltimore");
      assert.equal(base, "https://unisearch.web.app/");
      assert.equal(
        new URL("css/university/01-shell-hero.css", base).href,
        "https://unisearch.web.app/css/university/01-shell-hero.css"
      );

      const frontendMountBase = resolveAppBaseUrl("http://127.0.0.1:5510/frontend/universities/mit-usa-cambridge/");
      assert.equal(frontendMountBase, "http://127.0.0.1:5510/frontend/");
      assert.equal(
        new URL("css/university/01-shell-hero.css", frontendMountBase).href,
        "http://127.0.0.1:5510/frontend/css/university/01-shell-hero.css"
      );
    });
  });
});
