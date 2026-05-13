// Bump this file when the imported worker logic changes; browsers update the
// service worker from the entry script first.
const UNISEARCH_SW_ENTRY_VERSION = "2026-05-05-1";

importScripts('./javascript/sw-worker.js');
