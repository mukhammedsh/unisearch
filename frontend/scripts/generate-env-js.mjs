import fs from "node:fs";
import path from "node:path";

const apiBase = String(process.env.UNISEARCH_API_BASE_URL || "").trim();
const prettyRaw = String(process.env.UNISEARCH_USE_PRETTY_URLS || "").trim();

const payload = {
  API_BASE_URL: apiBase,
  APP_USE_PRETTY_URLS: prettyRaw,
};

const target = path.resolve(process.cwd(), "frontend", "env.js");
const content = `// Auto-generated at deploy time\nwindow.__UNISEARCH_ENV__ = ${JSON.stringify(payload, null, 2)};\n`;

fs.writeFileSync(target, content, "utf8");
console.log(`[generate-env-js] wrote ${target}`);
