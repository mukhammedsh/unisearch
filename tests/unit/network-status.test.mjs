import "./setup.mjs";
import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";

import {
  checkConnectivity,
  classifyError,
  isOnline,
  showNetworkStatusBanner,
} from "../../frontend/javascript/components/network-status.js";

import {
  renderErrorScreen,
  renderNoConnection,
  renderServerError,
  renderGenericError,
} from "../../frontend/javascript/components.js";

describe("network-status.js", () => {
  beforeEach(() => {
    navigator.onLine = true;
  });

  describe("classifyError", () => {
    it("classifies offline when navigator.onLine is false", () => {
      navigator.onLine = false;
      const result = classifyError(new Error("Generic failure"));
      assert.equal(result.type, "offline");
      assert.equal(result.isOffline, true);
      assert.equal(result.isServer, false);
    });

    it("classifies offline for fetch NetworkError / TypeError even if navigator was nominally true", () => {
      navigator.onLine = true;
      const fetchError = new TypeError("Failed to fetch");
      const result = classifyError(fetchError);
      assert.equal(result.type, "offline");
      assert.equal(result.isOffline, true);
    });

    it("classifies abort errors correctly", () => {
      const abortError = new Error("The user aborted a request.");
      abortError.name = "AbortError";
      const result = classifyError(abortError);
      assert.equal(result.type, "abort");
      assert.equal(result.isAbort, true);
    });

    it("classifies 5xx HTTP server errors as server type", () => {
      const serverErr500 = new Error("API Error");
      serverErr500.status = 500;
      const res500 = classifyError(serverErr500);
      assert.equal(res500.type, "server");
      assert.equal(res500.isServer, true);

      const serverErr503 = new Error("503 Service Unavailable");
      const res503 = classifyError(serverErr503);
      assert.equal(res503.type, "server");
      assert.equal(res503.isServer, true);
    });

    it("classifies 404 HTTP errors as not_found type", () => {
      const notFoundErr = new Error("404 Not Found");
      notFoundErr.status = 404;
      const result = classifyError(notFoundErr);
      assert.equal(result.type, "not_found");
      assert.equal(result.isNotFound, true);
    });

    it("classifies unspecified / code bugs as generic errors", () => {
      const bugError = new TypeError("Cannot read properties of undefined");
      const result = classifyError(bugError);
      assert.equal(result.type, "generic");
      assert.equal(result.isGeneric, true);
    });

    it("handles null/undefined safely", () => {
      const result = classifyError(null);
      assert.equal(result.type, "generic");
    });
  });

  describe("isOnline", () => {
    it("returns true when navigator reports online", () => {
      navigator.onLine = true;
      assert.equal(isOnline(), true);
    });

    it("returns false when navigator reports offline", () => {
      navigator.onLine = false;
      assert.equal(isOnline(), false);
    });
  });

  describe("checkConnectivity", () => {
    it("returns false immediately when navigator.onLine is false", async () => {
      navigator.onLine = false;
      const result = await checkConnectivity({ force: true });
      assert.equal(result, false);
    });

    it("probes /health endpoint and returns true on successful 200 response", async () => {
      navigator.onLine = true;
      const originalFetch = global.fetch;
      let queriedUrl = "";
      global.fetch = async (url) => {
        queriedUrl = String(url);
        return { ok: true, status: 200 };
      };

      try {
        const result = await checkConnectivity({ force: true });
        assert.equal(result, true);
        assert.ok(queriedUrl.endsWith("/health"));
      } finally {
        global.fetch = originalFetch;
      }
    });

    it("returns false when probe fails with a network exception", async () => {
      navigator.onLine = true;
      const originalFetch = global.fetch;
      global.fetch = async () => {
        throw new TypeError("Failed to fetch");
      };

      try {
        const result = await checkConnectivity({ force: true });
        assert.equal(result, false);
      } finally {
        global.fetch = originalFetch;
      }
    });

    it("returns false when probe returns 500 status", async () => {
      navigator.onLine = true;
      const originalFetch = global.fetch;
      global.fetch = async () => {
        return { ok: false, status: 500 };
      };

      try {
        const result = await checkConnectivity({ force: true });
        assert.equal(result, false);
      } finally {
        global.fetch = originalFetch;
      }
    });
  });

  describe("renderErrorScreen and helpers", () => {
    it("generates offline error screen html", () => {
      const html = renderNoConnection();
      assert.ok(html.includes("error-screen--offline"));
      assert.ok(html.includes("error.no_connection.title"));
      assert.ok(html.includes("error.no_connection.desc"));
      assert.ok(html.includes("role=\"alert\""));
    });

    it("generates server error screen html", () => {
      const html = renderServerError();
      assert.ok(html.includes("error-screen--server"));
      assert.ok(html.includes("error.server_error.title"));
      assert.ok(html.includes("error.server_error.desc"));
    });

    it("generates generic error screen html", () => {
      const html = renderGenericError();
      assert.ok(html.includes("error-screen--generic"));
      assert.ok(html.includes("error.generic.title"));
    });

    it("supports custom title and onRetry button generation", () => {
      const html = renderErrorScreen({
        type: "server",
        title: "Custom Server Down",
        onRetry: () => {},
      });
      assert.ok(html.includes("Custom Server Down"));
      assert.ok(html.includes("id=\"errorRetryBtn\""));
    });

    it("escapes HTML in custom error titles and descriptions", () => {
      const html = renderErrorScreen({
        type: "generic",
        title: "<img src=x onerror=alert(1)>",
        desc: "<script>alert(2)</script>",
      });
      assert.ok(!html.includes("<img "));
      assert.ok(!html.includes("<script>"));
      assert.ok(html.includes("&lt;img src=x onerror=alert(1)&gt;"));
      assert.ok(html.includes("&lt;script&gt;alert(2)&lt;/script&gt;"));
    });

    it("renders offline and online network status banner using DOM replaceChildren", () => {
      const origDoc = global.document;
      const origTimeout = global.window.setTimeout;
      const origClearTimeout = global.window.clearTimeout;
      const elements = new Map();
      const createNode = () => {
        const attrs = {};
        const classes = new Set();
        const node = {
          id: "",
          className: "",
          children: [],
          innerHTML: "",
          textContent: "",
          attrs,
          classList: {
            add: (...names) => names.forEach((n) => classes.add(n)),
            remove: (...names) => names.forEach((n) => classes.delete(n)),
            contains: (name) => classes.has(name),
          },
          setAttribute: (k, v) => { attrs[k] = String(v); },
          appendChild: (child) => {
            if (child.id) elements.set(child.id, child);
            node.children.push(child);
          },
          replaceChildren: (...nodes) => { node.children = nodes; },
        };
        return node;
      };
      global.window.setTimeout = (cb) => { cb(); return 1; };
      global.window.clearTimeout = () => {};
      global.document = {
        ...origDoc,
        body: createNode(),
        getElementById: (id) => elements.get(id) || null,
        createElement: () => createNode(),
      };
      try {
        showNetworkStatusBanner("offline");
        const banner = elements.get("networkStatusBanner");
        assert.ok(banner);
        assert.equal(banner.children.length, 2);
        assert.equal(banner.children[1].className, "network-status-banner__text");
        assert.ok(banner.classList.contains("network-status-banner--offline"));

        showNetworkStatusBanner("online");
        assert.ok(banner.classList.contains("network-status-banner--online"));
        assert.equal(banner.classList.contains("network-status-banner--offline"), false);
        assert.equal(banner.classList.contains("is-visible"), false);

        // Server wake-up states: problems stay visible, the positive state dismisses itself.
        showNetworkStatusBanner("waking");
        assert.ok(banner.classList.contains("network-status-banner--waking"));
        assert.equal(banner.classList.contains("network-status-banner--online"), false);
        assert.ok(banner.classList.contains("is-visible"));

        showNetworkStatusBanner("unavailable");
        assert.ok(banner.classList.contains("network-status-banner--unavailable"));
        assert.equal(banner.classList.contains("network-status-banner--waking"), false);
        assert.ok(banner.classList.contains("is-visible"));

        showNetworkStatusBanner("ready");
        assert.ok(banner.classList.contains("network-status-banner--ready"));
        assert.equal(banner.classList.contains("is-visible"), false);

        showNetworkStatusBanner("not-a-state");
        assert.ok(banner.classList.contains("network-status-banner--online"));
      } finally {
        global.document = origDoc;
        global.window.setTimeout = origTimeout;
        global.window.clearTimeout = origClearTimeout;
      }
    });
  });
});
