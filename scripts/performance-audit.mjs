import { chromium } from "@playwright/test";

const targetUrl = process.env.UNISEARCH_AUDIT_URL || "http://127.0.0.1:5501/index.html";
const maxEntries = Number(process.env.UNISEARCH_AUDIT_LIMIT || 20);

function formatBytes(value) {
  const bytes = Number(value || 0);
  if (!Number.isFinite(bytes) || bytes <= 0) return "unknown";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function sameOriginPath(baseUrl, path) {
  const url = new URL(baseUrl);
  url.pathname = path;
  url.search = "";
  url.hash = "";
  return url.toString();
}

async function collectPage(page, url) {
  const requests = [];

  page.on("requestfinished", async (request) => {
    const response = await request.response();
    if (!response) return;
    const headers = response.headers();
    const length = Number(headers["content-length"] || 0);
    requests.push({
      url: request.url(),
      method: request.method(),
      type: request.resourceType(),
      status: response.status(),
      bytes: Number.isFinite(length) ? length : 0,
    });
  });

  const started = performance.now();
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
  const durationMs = Math.round(performance.now() - started);

  const totals = requests.reduce(
    (acc, row) => {
      acc.count += 1;
      acc.bytes += row.bytes || 0;
      acc.byType[row.type] = (acc.byType[row.type] || 0) + 1;
      return acc;
    },
    { count: 0, bytes: 0, byType: {} },
  );

  const largest = [...requests]
    .sort((a, b) => (b.bytes || 0) - (a.bytes || 0))
    .slice(0, maxEntries)
    .map((row) => ({
      status: row.status,
      type: row.type,
      bytes: formatBytes(row.bytes),
      url: row.url,
    }));

  return {
    url,
    durationMs,
    requests: totals.count,
    transferred: formatBytes(totals.bytes),
    byType: totals.byType,
    largest,
  };
}

const browser = await chromium.launch();
try {
  const context = await browser.newContext({ serviceWorkers: "block" });
  const home = await collectPage(await context.newPage(), targetUrl);
  const catalog = await collectPage(await context.newPage(), sameOriginPath(targetUrl, "/universities.html"));

  console.log(JSON.stringify({ targetUrl, home, catalog }, null, 2));
} finally {
  await browser.close();
}
