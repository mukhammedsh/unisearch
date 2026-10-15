const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { test: base, expect } = require("@playwright/test");

let coverageFileIndex = 0;

const test = base.extend({
  page: async ({ page, browserName }, use, testInfo) => {
    const coverageDirectory = process.env.CODECOV_BROWSER_COVERAGE_DIR;
    if (!coverageDirectory || browserName !== "chromium") {
      await use(page);
      return;
    }

    await page.coverage.startJSCoverage({ resetOnNavigation: false });
    try {
      await use(page);
    } finally {
      const origin = new URL(testInfo.project.use.baseURL).origin;
      const frontendRoot = path.resolve(process.cwd(), "frontend");
      const results = [];

      if (!page.isClosed()) {
        for (const entry of await page.coverage.stopJSCoverage()) {
          const scriptUrl = new URL(entry.url);
          if (scriptUrl.origin !== origin || !scriptUrl.pathname.startsWith("/javascript/") || !scriptUrl.pathname.endsWith(".js")) continue;

          const sourcePath = path.resolve(frontendRoot, `.${decodeURIComponent(scriptUrl.pathname)}`);
          const relativePath = path.relative(frontendRoot, sourcePath);
          if (relativePath === ".." || relativePath.startsWith(`..${path.sep}`) || path.isAbsolute(relativePath)) continue;

          results.push({
            scriptId: `${process.pid}-${testInfo.workerIndex}-${coverageFileIndex}-${entry.scriptId}`,
            url: pathToFileURL(sourcePath).href,
            functions: entry.functions,
          });
        }
      }

      if (!results.length) return;

      const tempDirectory = path.resolve(process.cwd(), coverageDirectory);
      fs.mkdirSync(tempDirectory, { recursive: true });
      fs.writeFileSync(
        path.join(tempDirectory, `browser-${process.pid}-${testInfo.workerIndex}-${coverageFileIndex++}.json`),
        JSON.stringify({ result: results }),
      );
    }
  },
});

module.exports = { test, expect };
