import "./setup.mjs";
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";

import {
  WAKE_FIRST_PROBE_TIMEOUT_MS,
  WAKE_MAX_ATTEMPTS,
  WAKE_RETRY_DELAY_MS,
  WAKE_SLOW_NOTICE_MS,
  wakeBackend,
} from "../../frontend/javascript/components/backend-wake.js";

const flush = () => new Promise((resolve) => setImmediate(resolve));

/** A fetch whose calls the test settles by hand; it honours AbortSignal like the real one. */
function controllableFetch() {
  const calls = [];
  const fetchImpl = (url, init) => new Promise((resolve, reject) => {
    const call = { url, init, resolve, reject };
    calls.push(call);
    init.signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
  });
  return { fetchImpl, calls };
}

describe("backend-wake.js", () => {
  let notices;
  let recovered;
  const deps = (fetchImpl) => ({
    fetchImpl,
    notify: (status) => notices.push(status),
    onRecovered: () => { recovered += 1; },
  });

  beforeEach(() => {
    notices = [];
    recovered = 0;
    navigator.onLine = true;
    mock.timers.enable({ apis: ["setTimeout"] });
  });

  afterEach(() => {
    mock.timers.reset();
  });

  it("stays silent when the API answers quickly", async () => {
    const { fetchImpl, calls } = controllableFetch();
    const pending = wakeBackend(deps(fetchImpl));
    await flush();

    assert.match(calls[0].url, /\/health$/);
    assert.equal(calls[0].init.priority, "low");
    calls[0].resolve({ ok: true });

    assert.equal(await pending, true);
    assert.deepEqual(notices, []);
    assert.equal(recovered, 0);
  });

  it("explains a slow wake-up and confirms when the API is ready", async () => {
    const { fetchImpl, calls } = controllableFetch();
    const pending = wakeBackend(deps(fetchImpl));
    await flush();

    mock.timers.tick(WAKE_SLOW_NOTICE_MS);
    assert.deepEqual(notices, ["waking"]);
    calls[0].resolve({ ok: true });

    assert.equal(await pending, true);
    assert.deepEqual(notices, ["waking", "ready"]);
    assert.equal(recovered, 0, "the page requests are already in flight, so no extra refetch");
  });

  it("reports an unresponsive API, retries, and asks pages to refetch after recovery", async () => {
    const { fetchImpl, calls } = controllableFetch();
    const pending = wakeBackend(deps(fetchImpl));
    await flush();

    calls[0].reject(new TypeError("Failed to fetch"));
    await flush();
    assert.deepEqual(notices, ["unavailable"]);

    mock.timers.tick(WAKE_RETRY_DELAY_MS);
    await flush();
    assert.equal(calls.length, 2);
    calls[1].resolve({ ok: true });

    assert.equal(await pending, true);
    assert.deepEqual(notices, ["unavailable", "ready"]);
    assert.equal(recovered, 1);
  });

  it("treats a probe that never answers as unavailable after its timeout", async () => {
    const { fetchImpl, calls } = controllableFetch();
    const pending = wakeBackend({ ...deps(fetchImpl), notify: (status) => notices.push(status) });
    await flush();

    mock.timers.tick(WAKE_FIRST_PROBE_TIMEOUT_MS);
    await flush();
    assert.equal(calls[0].init.signal.aborted, true);
    assert.deepEqual(notices, ["waking", "unavailable"]);

    pending.catch(() => {});
  });

  it("treats a non-success status as not awake", async () => {
    const { fetchImpl, calls } = controllableFetch();
    const pending = wakeBackend(deps(fetchImpl));
    await flush();

    calls[0].resolve({ ok: false, status: 503 });
    await flush();
    assert.deepEqual(notices, ["unavailable"]);
    pending.catch(() => {});
  });

  it("does not blame the server when the browser is offline", async () => {
    navigator.onLine = false;
    const { fetchImpl, calls } = controllableFetch();
    const pending = wakeBackend(deps(fetchImpl));
    await flush();

    calls[0].reject(new TypeError("Failed to fetch"));
    assert.equal(await pending, false);
    assert.deepEqual(notices, []);
  });

  it("gives up after the configured number of attempts", async () => {
    const { fetchImpl, calls } = controllableFetch();
    const pending = wakeBackend(deps(fetchImpl));

    for (let attempt = 0; attempt < WAKE_MAX_ATTEMPTS; attempt += 1) {
      await flush();
      calls[attempt].reject(new TypeError("Failed to fetch"));
      await flush();
      mock.timers.tick(WAKE_RETRY_DELAY_MS);
    }

    assert.equal(await pending, false);
    assert.equal(calls.length, WAKE_MAX_ATTEMPTS);
    assert.deepEqual(notices, Array(WAKE_MAX_ATTEMPTS).fill("unavailable"));
    assert.equal(recovered, 0);
  });

  it("returns false when fetch is unavailable", async () => {
    assert.equal(await wakeBackend({ ...deps(undefined), fetchImpl: null }), false);
  });
});
