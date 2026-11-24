// Bump this file when the imported worker logic changes; browsers update the
// service worker from the entry script first.
// oxlint-disable-next-line no-unused-vars -- cache-busting marker read by browsers on SW update
const UNISEARCH_SW_ENTRY_VERSION = "2026-11-24-1";

importScripts('./javascript/sw-worker.js');
