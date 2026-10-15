import assert from "node:assert/strict";
import fs from "node:fs";

import { generateFrontendEnvFile } from "../frontend/scripts/generate-env-js.mjs";

const productionConfig = {
  API_BASE_URL: "https://unisearch-backend-8cet.onrender.com",
  API_PORT: "8000",
  APP_USE_PRETTY_URLS: "1",
  APP_DEBUG: "",
};

process.env.UNISEARCH_API_BASE_URL = productionConfig.API_BASE_URL;
process.env.UNISEARCH_API_PORT = productionConfig.API_PORT;
process.env.UNISEARCH_USE_PRETTY_URLS = productionConfig.APP_USE_PRETTY_URLS;
process.env.UNISEARCH_APP_DEBUG = productionConfig.APP_DEBUG;

const target = generateFrontendEnvFile();
const generated = fs.readFileSync(target, "utf8");
for (const [key, value] of Object.entries(productionConfig)) {
  assert.ok(
    generated.includes(`${JSON.stringify(key)}: ${JSON.stringify(value)}`),
    `Firebase env is missing ${key}`,
  );
}

console.log(`[build-firebase-env] wrote ${target}`);
